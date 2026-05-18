import { NextRequest } from "next/server";
import type { Glacier, GlacierAI, GlacierForecast, Trajectory } from "@/lib/glacier-types";

export const runtime = "edge";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";
const MODEL = process.env.OPENROUTER_GLACIER_MODEL ?? "mistralai/mistral-large";

interface SeriesStats {
  n: number;
  first: number;
  last: number;
  min: number;
  max: number;
  mean: number;
  delta: number;
  slope: number;
}

function computeStats(values: number[]): SeriesStats | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const cleaned = values.filter((v) => Number.isFinite(v));
  if (cleaned.length === 0) return null;

  const n = cleaned.length;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  const min = Math.min(...cleaned);
  const max = Math.max(...cleaned);
  const mean = cleaned.reduce((sum, v) => sum + v, 0) / n;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  cleaned.forEach((y, i) => {
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  });
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;

  return { n, first, last, min, max, mean, delta: last - first, slope };
}

function formatStats(label: string, stats: SeriesStats | null, unit: string): string {
  if (!stats) return `- ${label}: sin serie historica`;
  return `- ${label} [n=${stats.n} ${unit}] last=${stats.last.toFixed(2)} first=${stats.first.toFixed(2)} delta=${stats.delta >= 0 ? "+" : ""}${stats.delta.toFixed(2)} min=${stats.min.toFixed(2)} max=${stats.max.toFixed(2)} mean=${stats.mean.toFixed(2)} slope/step=${stats.slope >= 0 ? "+" : ""}${stats.slope.toFixed(3)}`;
}

function formatRawSeries(label: string, values: number[]): string {
  const tail = values.filter((v) => Number.isFinite(v)).slice(-12);
  if (tail.length === 0) return `- ${label}: []`;
  return `- ${label}: [${tail.map((v) => v.toFixed(2)).join(", ")}]`;
}

function buildPrompt(glacier: Glacier): string {
  const tempStats = computeStats(glacier.tempHistory);
  const massStats = computeStats(glacier.massHistory);
  const areaStats = computeStats(glacier.areaHistory);
  const riskStats = computeStats(glacier.riskHistory);

  const anomalyLabel = Number.isFinite(glacier.tempAnomaly)
    ? `${glacier.tempAnomaly > 0 ? "+" : ""}${glacier.tempAnomaly.toFixed(2)} C`
    : "N/D";

  const recent3vsPrev3 = (() => {
    const series = glacier.tempHistory.filter((v) => Number.isFinite(v));
    if (series.length < 6) return "N/D";
    const recent = series.slice(-3);
    const prev = series.slice(-6, -3);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const diff = avg(recent) - avg(prev);
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} C`;
  })();

  return `Eres el sistema de inteligencia glaciologica de SENTINEL. Estas analizando un glaciar REAL con datos cuantitativos verificados de GLIMS (NSIDC) y Open-Meteo Archive.

REGLAS ESTRICTAS:
- Usa SOLO los datos provistos. Prohibido inventar cifras, nombres, fechas o ubicaciones no listadas.
- En el diagnostico e impacto, CITA al menos 2 valores numericos concretos del set (e.g., "anomalia +0.84 C", "balance -0.32 m EH/anio", "delta -1.4% area").
- Si una serie esta vacia o = N/D, escribe "sin serie disponible" en lugar de inventar.
- Espanol tecnico glaciologico. JSON valido sin markdown ni texto adicional.
- Urgencia debe ser coherente con el score de riesgo provisto.

IDENTIFICACION:
- Nombre: ${glacier.name}
- GLIMS ID: ${glacier.glimsId}
- Coordenadas: ${glacier.lat.toFixed(4)}, ${glacier.lon.toFixed(4)}
- Region: ${glacier.region}
- Cuenca: ${glacier.cuenca}
- Poblacion expuesta: ${glacier.poblacion}

MORFOMETRIA GLIMS:
- Area: ${glacier.area.toFixed(3)} km^2
- Fecha de observacion (src_date): ${glacier.srcDate ?? "N/D"}
- Release date: ${glacier.lastReleaseDate ?? "N/D"}
- Elevacion estimada: ${glacier.elevation ?? "N/D"}

INDICADORES SENTINEL:
- Score de riesgo: ${glacier.riesgo}/100 -> categoria ${glacier.cat}
- Tendencia clasificada: ${glacier.trend}
- Delta area corto plazo: ${glacier.deltaShort}
- Delta anual: ${glacier.deltaYear}
- Variacion de masa: ${glacier.masaVar}

CLIMA (Open-Meteo, temperature_2m_mean diario agregado mensual):
- Anomalia termica actual: ${anomalyLabel}
- Cambio 3 meses recientes vs 3 meses previos: ${recent3vsPrev3}

ESTADISTICAS DE SERIES:
${formatStats("Anomalia termica mensual (C)", tempStats, "meses")}
${formatStats("Balance de masa (m EH)", massStats, "meses")}
${formatStats("Area normalizada (%)", areaStats, "meses")}
${formatStats("Riesgo historico", riskStats, "puntos")}

VALORES CRUDOS (ultimos 12 puntos):
${formatRawSeries("temp_anom", glacier.tempHistory)}
${formatRawSeries("mass_balance", glacier.massHistory)}
${formatRawSeries("area_norm", glacier.areaHistory)}

PRONOSTICO (forecast):
- Proyecta el comportamiento futuro extrapolando: slope termico, slope de masa, slope de area, anomalia actual y categoria de riesgo.
- "areaPctChange" = cambio porcentual de area esperado (negativo = retroceso, positivo = crecimiento). Rango razonable: -25 a +5.
- "massBalance" = balance de masa esperado en m EH (metros equivalente de agua). Tipico: -3 a +0.5.
- "confidence" = 0-100, mas alto cuanto mas series con n >= 6 esten disponibles.
- "trajectory" debe ser coherente con los slopes: slope termico positivo + slope area negativo => Retroceso (lento o acelerado segun magnitud).

Devuelve UNICAMENTE JSON con este formato exacto:
{
  "diag": "2-3 oraciones que CITEN al menos 2 valores numericos del set (anomalia, balance, slope, delta o riesgo). Sin generalidades.",
  "urgency": "CRITICA" | "ALTA" | "MEDIA" | "BAJA",
  "impact": "1-2 oraciones sobre impacto hidrico citando area en km^2 y delta o slope observado",
  "recT": "recomendacion tecnica concreta de monitoreo basada en los datos (frecuencia, sensor, variable)",
  "recR": "recomendacion territorial/institucional concreta acorde a poblacion expuesta y cuenca",
  "forecast": {
    "trajectory": "Crecimiento" | "Estable" | "Retroceso lento" | "Retroceso acelerado" | "Colapso",
    "confidence": 0-100,
    "horizon6m":  { "areaPctChange": number, "massBalance": number },
    "horizon12m": { "areaPctChange": number, "massBalance": number },
    "horizon24m": { "areaPctChange": number, "massBalance": number },
    "rationale": "1-2 oraciones explicando el pronostico citando slopes y anomalia"
  }
}`;
}

const TRAJECTORIES: Trajectory[] = ["Crecimiento", "Estable", "Retroceso lento", "Retroceso acelerado", "Colapso"];

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseForecastPoint(raw: unknown): { areaPctChange: number; massBalance: number } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    areaPctChange: clampNum(obj.areaPctChange, -50, 20, 0),
    massBalance: clampNum(obj.massBalance, -8, 2, 0),
  };
}

function parseForecast(raw: unknown): GlacierForecast | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const trajectory = TRAJECTORIES.includes(obj.trajectory as Trajectory)
    ? (obj.trajectory as Trajectory)
    : "Estable";
  return {
    trajectory,
    confidence: clampNum(obj.confidence, 0, 100, 50),
    horizon6m: parseForecastPoint(obj.horizon6m),
    horizon12m: parseForecastPoint(obj.horizon12m),
    horizon24m: parseForecastPoint(obj.horizon24m),
    rationale: typeof obj.rationale === "string" ? obj.rationale.trim() : "",
  };
}

function parseAI(content: string): GlacierAI {
  const block = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  const parsed = JSON.parse(block) as Partial<GlacierAI> & { forecast?: unknown };

  const urgency =
    parsed.urgency === "CRITICA" || parsed.urgency === "ALTA" || parsed.urgency === "MEDIA" || parsed.urgency === "BAJA"
      ? parsed.urgency
      : "MEDIA";

  return {
    diag: parsed.diag?.trim() || "Sin diagnostico",
    urgency,
    impact: parsed.impact?.trim() || "Sin evaluacion de impacto",
    recT: parsed.recT?.trim() || "Sin recomendacion tecnica",
    recR: parsed.recR?.trim() || "Sin recomendacion territorial",
    forecast: parseForecast(parsed.forecast),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { glacier?: Glacier };
    const glacier = body.glacier ?? null;

    if (!glacier?.id) {
      return new Response(JSON.stringify({ error: "glacier required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!OPENROUTER_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY required for real AI analysis" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(glacier);

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sentinel.vercel.app",
        "X-Title": "SENTINEL Glaciares",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Eres un glaciologo senior. Analizas datos cuantitativos reales. Nunca inventas. Citas valores numericos en cada oracion. Respondes solo JSON valido.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.15,
        response_format: { type: "json_object" },
        stream: false,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`OpenRouter ${upstream.status} ${text.slice(0, 200)}`);
    }

    const payload = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    const ai = parseAI(content);

    return new Response(JSON.stringify(ai), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[/api/glaciers/analyze]", error);
    return new Response(
      JSON.stringify({
        error: "real AI analysis failed",
        detail: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
