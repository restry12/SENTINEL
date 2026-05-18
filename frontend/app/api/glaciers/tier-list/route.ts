import { NextRequest } from "next/server";
import type { Glacier, GlimsFeature } from "@/lib/glacier-types";
import { getCat } from "@/lib/glacier-score";

export const runtime = "edge";

const GLIMS_POINTS_WFS_BASE =
  "https://www.glims.org/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GLIMS:GLIMS_Points&outputFormat=application/json";

const TIER_BBOX: [number, number, number, number] = [-180, -80, 180, 84];
const TIER_TOP_N = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function splitBBox(bbox: [number, number, number, number], cols: number, rows: number): [number, number, number, number][] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonStep = (maxLon - minLon) / cols;
  const latStep = (maxLat - minLat) / rows;
  const cells: [number, number, number, number][] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cellMinLon = minLon + lonStep * col;
      const cellMaxLon = col === cols - 1 ? maxLon : minLon + lonStep * (col + 1);
      const cellMinLat = minLat + latStep * row;
      const cellMaxLat = row === rows - 1 ? maxLat : minLat + latStep * (row + 1);
      cells.push([cellMinLon, cellMinLat, cellMaxLon, cellMaxLat]);
    }
  }
  return cells;
}

async function fetchCell(cell: [number, number, number, number], maxFeatures: number): Promise<GlimsFeature[]> {
  const bbox = `${cell[0]},${cell[1]},${cell[2]},${cell[3]},EPSG:4326`;
  const url = `${GLIMS_POINTS_WFS_BASE}&bbox=${bbox}&maxFeatures=${maxFeatures}&sortBy=${encodeURIComponent("db_area D")}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GLIMS ${response.status}`);
  const payload = (await response.json()) as { features?: GlimsFeature[] };
  return payload.features ?? [];
}

function getCoords(feature: GlimsFeature): { lon: number; lat: number } | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

function ageYears(srcDate?: string): number {
  if (!srcDate) return 0;
  const t = Date.parse(srcDate);
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 365.25);
}

function computeRisk(areaKm2: number, lat: number, srcDate?: string): number {
  const area = Math.max(0.001, areaKm2);
  const areaScore =
    area < 0.1 ? 94 :
    area < 0.5 ? 86 :
    area < 1 ? 78 :
    area < 5 ? 64 :
    area < 20 ? 50 :
    area < 100 ? 38 : 24;
  const latitudeScore = clamp(65 - Math.abs(lat), 0, 65);
  const ageScore = clamp(ageYears(srcDate) * 2.2, 0, 55);
  return Math.round(clamp(areaScore * 0.6 + latitudeScore * 0.2 + ageScore * 0.2, 0, 100));
}

function buildGlacier(feature: GlimsFeature): Glacier | null {
  const coords = getCoords(feature);
  if (!coords) return null;
  const properties = feature.properties;
  const glimsId = properties.glac_id ?? properties.glims_id;
  if (!glimsId) return null;

  const areaValue = Number(properties.db_area ?? properties.area ?? NaN);
  const area = Number.isFinite(areaValue) && areaValue > 0 ? areaValue : 0.05;
  const rawName = (properties.glac_name ?? properties.glacier_name ?? "").trim();
  const name = rawName.length > 0 ? rawName : `GLIMS ${glimsId}`;
  const srcDate = properties.src_date ?? undefined;
  const risk = computeRisk(area, coords.lat, srcDate);
  const cat = getCat(risk);
  const trend =
    risk >= 70 ? "Retroceso acelerado" :
    risk >= 40 ? "Retroceso lento" :
    "Estable";

  return {
    id: glimsId.toLowerCase().replace(/[^a-z0-9]/g, ""),
    glimsId,
    name,
    region: `Lat ${coords.lat.toFixed(2)} / Lon ${coords.lon.toFixed(2)}`,
    lat: coords.lat,
    lon: coords.lon,
    area,
    srcDate,
    lastReleaseDate: properties.release_date ?? undefined,
    tempAnomaly: 0,
    tempHistory: [0],
    massHistory: [0],
    areaHistory: [100],
    riesgo: risk,
    cat,
    trend,
    deltaShort: "N/D",
    deltaYear: "N/D",
    masaVar: "N/D",
    riskHistory: Array.from({ length: 12 }, () => risk),
    cuenca: "N/D",
    poblacion: "N/D",
    infra: [],
  };
}

function dedupeById(features: GlimsFeature[]): GlimsFeature[] {
  const byId = new Map<string, GlimsFeature>();
  for (const feature of features) {
    const id = feature.properties.glac_id ?? feature.properties.glims_id;
    if (!id) continue;
    const area = Number(feature.properties.db_area ?? feature.properties.area ?? 0);
    const current = byId.get(id);
    const currentArea = current ? Number(current.properties.db_area ?? current.properties.area ?? 0) : -1;
    if (!current || area > currentArea) byId.set(id, feature);
  }
  return Array.from(byId.values());
}

export async function GET(_req: NextRequest) {
  try {
    const cells = splitBBox(TIER_BBOX, 4, 2);
    const batches = await Promise.all(cells.map((cell) => fetchCell(cell, 1500)));
    const deduped = dedupeById(batches.flat());

    const glaciers = deduped
      .map((feature) => buildGlacier(feature))
      .filter((value): value is Glacier => Boolean(value));

    const byArea = [...glaciers]
      .sort((a, b) => b.area - a.area)
      .slice(0, TIER_TOP_N);

    const byRisk = [...glaciers]
      .sort((a, b) => b.riesgo - a.riesgo || b.area - a.area)
      .slice(0, TIER_TOP_N);

    const byRetreat = [...glaciers]
      .filter((g) => g.srcDate)
      .sort((a, b) => {
        const composite = (g: Glacier) => g.riesgo * 0.55 + ageYears(g.srcDate) * 1.5 + Math.log10(Math.max(0.1, g.area)) * 4;
        return composite(b) - composite(a);
      })
      .slice(0, TIER_TOP_N);

    return new Response(
      JSON.stringify({ byArea, byRisk, byRetreat, total: glaciers.length }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=21600, stale-while-revalidate=86400",
          "X-Glacier-Source": "tier-list",
        },
      }
    );
  } catch (error) {
    console.error("[/api/glaciers/tier-list]", error);
    return new Response(
      JSON.stringify({
        error: "tier-list failed",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
