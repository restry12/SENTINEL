import { NextRequest } from "next/server";
import type { Glacier, GlacierAI } from "@/lib/glacier-types";

export const runtime = "edge";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";

function buildPrompt(glacier: Glacier): string {
  const anomalyLabel = Number.isFinite(glacier.tempAnomaly)
    ? `${glacier.tempAnomaly > 0 ? "+" : ""}${glacier.tempAnomaly.toFixed(2)} C`
    : "N/D";

  return `Eres el sistema de inteligencia glaciologica de SENTINEL.

Usa SOLO los datos entregados:
- Nombre: ${glacier.name}
- GLIMS ID: ${glacier.glimsId}
- Coordenadas: ${glacier.lat.toFixed(4)}, ${glacier.lon.toFixed(4)}
- Area GLIMS: ${glacier.area.toFixed(3)} km2
- Fecha de observacion: ${glacier.srcDate ?? "N/D"}
- Anomalia termica (Open-Meteo): ${anomalyLabel}
- Riesgo operativo: ${glacier.riesgo}/100 (${glacier.cat})
- Tendencia: ${glacier.trend}

Devuelve SOLO JSON valido, sin markdown, con este formato exacto:
{
  "diag": "2-3 oraciones tecnicas, concretas y sin inventar datos no provistos",
  "urgency": "CRITICA" | "ALTA" | "MEDIA" | "BAJA",
  "impact": "1-2 oraciones sobre impacto hidrico potencial",
  "recT": "recomendacion tecnica de monitoreo",
  "recR": "recomendacion territorial/institucional"
}`;
}

function parseAI(content: string): GlacierAI {
  const block = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
  const parsed = JSON.parse(block) as Partial<GlacierAI>;

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

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sentinel.vercel.app",
        "X-Title": "SENTINEL Glaciares",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-large",
        messages: [{ role: "user", content: buildPrompt(glacier) }],
        temperature: 0.2,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!upstream.ok) throw new Error(`OpenRouter ${upstream.status}`);

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
