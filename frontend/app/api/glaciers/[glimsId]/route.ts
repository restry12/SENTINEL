import { NextRequest } from "next/server";
import type { Glacier, GlimsFeature, OpenMeteoResponse } from "@/lib/glacier-types";
import { calcRiesgo, getCat } from "@/lib/glacier-score";

export const runtime = "edge";

const GLIMS_POINTS_WFS_BASE =
  "https://www.glims.org/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GLIMS:GLIMS_Points&outputFormat=application/json";

const GLIMS_OUTLINES_WFS_BASE =
  "https://www.glims.org/geoserver/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=GLIMS:GLIMS_Glacier_Outlines&outputFormat=application/json";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function openMeteoUrl(lat: number, lon: number): string {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 12);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${fmt(start)}&end_date=${fmt(end)}&daily=temperature_2m_mean&timezone=auto`;
}

function aggregateDailyToMonthly(payload: OpenMeteoResponse): number[] {
  const days = payload.daily?.time ?? [];
  const values = payload.daily?.temperature_2m_mean ?? [];
  const monthly = new Map<string, number[]>();

  days.forEach((day, index) => {
    const value = values[index];
    if (typeof value !== "number") return;
    const key = day.slice(0, 7);
    monthly.set(key, [...(monthly.get(key) ?? []), value]);
  });

  return Array.from(monthly.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, monthValues]) => monthValues.reduce((sum, value) => sum + value, 0) / monthValues.length);
}

function computeAnomalies(monthlyTemps: number[]): { history: number[]; anomaly: number } {
  if (monthlyTemps.length === 0) return { history: [0], anomaly: 0 };
  const mean = monthlyTemps.reduce((sum, value) => sum + value, 0) / monthlyTemps.length;
  const history = monthlyTemps.map((value) => Number((value - mean).toFixed(2)));
  const anomaly = history.at(-1) ?? 0;
  return { history, anomaly };
}

function getFeatureCoordinates(feature: GlimsFeature): { lon: number; lat: number } | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  return { lon, lat };
}

function latestByDate(features: GlimsFeature[]): GlimsFeature | null {
  if (features.length === 0) return null;

  return features.reduce((current, candidate) => {
    const currentDate = Date.parse(current.properties.src_date ?? "");
    const candidateDate = Date.parse(candidate.properties.src_date ?? "");
    if (Number.isNaN(currentDate)) return candidate;
    if (Number.isNaN(candidateDate)) return current;
    return candidateDate > currentDate ? candidate : current;
  });
}

async function fetchByGlimsId(layerBaseUrl: string, glimsId: string, maxFeatures: number): Promise<GlimsFeature[]> {
  const safeId = glimsId.replace(/'/g, "''");
  const cql = encodeURIComponent(`glac_id='${safeId}'`);
  const sortBy = encodeURIComponent("src_date D");
  const url = `${layerBaseUrl}&cql_filter=${cql}&maxFeatures=${maxFeatures}&sortBy=${sortBy}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GLIMS ${response.status}`);

  const payload = (await response.json()) as { features?: GlimsFeature[] };
  return payload.features ?? [];
}

async function fetchClimate(lat: number, lon: number): Promise<{ tempHistory: number[]; anomaly: number }> {
  const response = await fetch(openMeteoUrl(lat, lon), { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);

  const payload = (await response.json()) as OpenMeteoResponse;
  const monthly = aggregateDailyToMonthly(payload);
  if (monthly.length === 0) return { tempHistory: [0], anomaly: 0 };

  const { history, anomaly } = computeAnomalies(monthly.slice(-12));
  return { tempHistory: history, anomaly };
}

function buildDetail(point: GlimsFeature, outline: GlimsFeature | null, tempHistory: number[], tempAnomaly: number): Glacier {
  const coords = getFeatureCoordinates(point) ?? { lon: 0, lat: 0 };
  const pointProps = point.properties;
  const outlineProps = outline?.properties ?? {};

  const glimsId = pointProps.glac_id ?? pointProps.glims_id ?? "unknown";
  const area = Number(outlineProps.db_area ?? outlineProps.area ?? pointProps.db_area ?? pointProps.area ?? 0);
  const normalizedArea = Number.isFinite(area) && area > 0 ? area : 0.01;

  const riesgo = calcRiesgo({
    areaNow: normalizedArea,
    areaRef: normalizedArea * 1.03,
    tempAnomaly,
    elevation: 3000,
    cuencaFactor: 45,
  });

  const cat = getCat(riesgo);
  const trend =
    tempAnomaly > 0.9 ? "Retroceso acelerado" :
    tempAnomaly > 0.3 ? "Retroceso lento" :
    "Estable";

  const currentMass = Number((-0.18 - Math.max(0, tempAnomaly) * 0.22).toFixed(2));
  const massHistory = Array.from({ length: Math.max(12, tempHistory.length) }, (_, index) =>
    Number((currentMass - (11 - index) * 0.01).toFixed(2))
  ).slice(-12);

  const areaHistory = Array.from({ length: 12 }, (_, index) =>
    Number((100 - (11 - index) * Math.max(0.05, Math.min(0.6, Math.abs(currentMass) * 0.25))).toFixed(2))
  );

  const name = (pointProps.glac_name ?? outlineProps.glac_name ?? "").trim() || `GLIMS ${glimsId}`;
  const srcDate = outlineProps.src_date ?? pointProps.src_date ?? undefined;
  const releaseDate = pointProps.release_date ?? undefined;
  const riskHistory = Array.from({ length: 12 }, (_, index) =>
    clamp(Math.round(riesgo - (11 - index) * 0.6), 0, 100)
  );

  return {
    id: glimsId.toLowerCase().replace(/[^a-z0-9]/g, ""),
    glimsId,
    name,
    region: `Lat ${coords.lat.toFixed(2)} / Lon ${coords.lon.toFixed(2)}`,
    lat: coords.lat,
    lon: coords.lon,
    area: normalizedArea,
    srcDate,
    lastReleaseDate: releaseDate,
    tempAnomaly: Number(tempAnomaly.toFixed(2)),
    tempHistory: tempHistory.length > 0 ? tempHistory : [0],
    massHistory,
    areaHistory,
    riesgo,
    cat,
    trend,
    deltaShort: areaHistory.length > 1 ? `-${Math.max(0, Math.round(100 - (areaHistory.at(-1) ?? 100)))}%` : "N/D",
    deltaYear: `${Math.abs(currentMass).toFixed(2)}%/anio`,
    masaVar: `${currentMass.toFixed(2)} m EH/anio`,
    riskHistory,
    cuenca: "N/D",
    poblacion: "N/D",
    infra: [],
  };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ glimsId: string }> }) {
  try {
    const { glimsId } = await context.params;
    if (!glimsId) {
      return new Response(JSON.stringify({ error: "glimsId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pointFeatures = await fetchByGlimsId(GLIMS_POINTS_WFS_BASE, glimsId, 10);
    const point = latestByDate(pointFeatures);
    if (!point) {
      return new Response(JSON.stringify({ error: "Glacier not found in GLIMS points" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const outlineFeatures = await fetchByGlimsId(GLIMS_OUTLINES_WFS_BASE, glimsId, 20);
    const outline = latestByDate(outlineFeatures);
    const coords = getFeatureCoordinates(point);
    if (!coords) {
      return new Response(JSON.stringify({ error: "Invalid glacier coordinates" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const climate = await fetchClimate(coords.lat, coords.lon);
    const glacier = buildDetail(point, outline, climate.tempHistory, climate.anomaly);

    return new Response(JSON.stringify(glacier), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=172800",
        "X-Glacier-Source": "glims-detail",
      },
    });
  } catch (error) {
    console.error("[/api/glaciers/[glimsId]]", error);
    return new Response(
      JSON.stringify({
        error: "Failed to load glacier detail",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      }
    );
  }
}
