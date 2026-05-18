import { NextRequest } from "next/server";
import type { Glacier, GlimsFeature } from "@/lib/glacier-types";
import { getCat } from "@/lib/glacier-score";

export const runtime = "edge";

const GLIMS_POINTS_WFS_BASE =
  "https://www.glims.org/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GLIMS:GLIMS_Points&outputFormat=application/json";

type BBox = [number, number, number, number];

const DEFAULT_BBOX: BBox = [-180, -80, 180, 84];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseBboxParam(raw: string | null): BBox {
  if (!raw) return DEFAULT_BBOX;
  const parsed = raw.split(",").map((value) => Number(value.trim()));
  if (parsed.length !== 4 || parsed.some((value) => Number.isNaN(value))) return DEFAULT_BBOX;

  let [minLon, minLat, maxLon, maxLat] = parsed as BBox;
  minLon = clamp(minLon, -180, 180);
  maxLon = clamp(maxLon, -180, 180);
  minLat = clamp(minLat, -85, 85);
  maxLat = clamp(maxLat, -85, 85);

  if (minLon >= maxLon || minLat >= maxLat) return DEFAULT_BBOX;
  return [minLon, minLat, maxLon, maxLat];
}

function parseZoom(raw: string | null): number {
  const parsed = Number(raw ?? "2");
  if (!Number.isFinite(parsed)) return 2;
  return clamp(parsed, 1, 14);
}

function splitBBox(bbox: BBox, cols: number, rows: number): BBox[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const lonStep = (maxLon - minLon) / cols;
  const latStep = (maxLat - minLat) / rows;
  const cells: BBox[] = [];

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

function buildQueryPlan(bbox: BBox, zoom: number): { cells: BBox[]; maxFeaturesPerCell: number } {
  const lonSpan = bbox[2] - bbox[0];
  const latSpan = bbox[3] - bbox[1];
  const veryWide = lonSpan >= 160 || latSpan >= 70 || zoom <= 2.2;
  const wide = lonSpan >= 90 || latSpan >= 45 || zoom <= 3.4;

  if (veryWide) {
    return { cells: splitBBox(bbox, 4, 2), maxFeaturesPerCell: 1600 };
  }
  if (wide) {
    return { cells: splitBBox(bbox, 3, 2), maxFeaturesPerCell: 1800 };
  }
  return { cells: [bbox], maxFeaturesPerCell: zoom >= 7 ? 9000 : 5000 };
}

async function fetchPointsCell(cell: BBox, maxFeatures: number): Promise<GlimsFeature[]> {
  const bbox = `${cell[0]},${cell[1]},${cell[2]},${cell[3]},EPSG:4326`;
  const url = `${GLIMS_POINTS_WFS_BASE}&bbox=${bbox}&maxFeatures=${maxFeatures}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`GLIMS points ${response.status}`);

  const payload = (await response.json()) as { features?: GlimsFeature[] };
  return payload.features ?? [];
}

function getFeatureCoordinates(feature: GlimsFeature): { lon: number; lat: number } | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

function computeHeuristicRisk(areaKm2: number, lat: number, srcDate?: string): number {
  const area = Math.max(0.001, areaKm2);
  const areaScore =
    area < 0.1 ? 94 :
    area < 0.5 ? 86 :
    area < 1 ? 78 :
    area < 5 ? 64 :
    area < 20 ? 50 :
    area < 100 ? 38 : 24;

  const absLat = Math.abs(lat);
  const latitudeScore = clamp(65 - absLat, 0, 65);

  let ageScore = 20;
  if (srcDate) {
    const date = new Date(srcDate);
    if (!Number.isNaN(date.getTime())) {
      const years = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      ageScore = clamp(years * 2.2, 0, 55);
    }
  }

  return Math.round(clamp(areaScore * 0.6 + latitudeScore * 0.2 + ageScore * 0.2, 0, 100));
}

function buildSummary(feature: GlimsFeature): Glacier | null {
  const coords = getFeatureCoordinates(feature);
  if (!coords) return null;

  const properties = feature.properties;
  const glimsId = properties.glac_id ?? properties.glims_id;
  if (!glimsId) return null;

  const areaValue = Number(properties.db_area ?? properties.area ?? NaN);
  const area = Number.isFinite(areaValue) && areaValue > 0 ? areaValue : 0.05;

  const rawName = (properties.glac_name ?? properties.glacier_name ?? "").trim();
  const name = rawName.length > 0 ? rawName : `GLIMS ${glimsId}`;
  const srcDate = properties.src_date ?? undefined;
  const risk = computeHeuristicRisk(area, coords.lat, srcDate);
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

function dedupeByGlacierId(features: GlimsFeature[]): GlimsFeature[] {
  const byId = new Map<string, GlimsFeature>();

  for (const feature of features) {
    const id = feature.properties.glac_id ?? feature.properties.glims_id;
    if (!id) continue;
    const area = Number(feature.properties.db_area ?? feature.properties.area ?? 0);
    const current = byId.get(id);
    const currentArea = current ? Number(current.properties.db_area ?? current.properties.area ?? 0) : -1;

    if (!current || area > currentArea) {
      byId.set(id, feature);
    }
  }

  return Array.from(byId.values());
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const bbox = parseBboxParam(url.searchParams.get("bbox"));
    const zoom = parseZoom(url.searchParams.get("zoom"));
    const { cells, maxFeaturesPerCell } = buildQueryPlan(bbox, zoom);

    const batches = await Promise.all(cells.map((cell) => fetchPointsCell(cell, maxFeaturesPerCell)));
    const deduped = dedupeByGlacierId(batches.flat());

    const glaciers = deduped
      .map((feature) => buildSummary(feature))
      .filter((value): value is Glacier => Boolean(value))
      .sort((a, b) => b.area - a.area);

    return new Response(JSON.stringify(glaciers), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=600, stale-while-revalidate=1200",
        "X-Glacier-Source": "glims-points",
      },
    });
  } catch (error) {
    console.error("[/api/glaciers]", error);
    return new Response(
      JSON.stringify({
        error: "GLIMS glacier fetch failed",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }
    );
  }
}
