import { NextRequest } from 'next/server'
import type { Glacier, GlacierAI } from '@/lib/glacier-types'

export const runtime = 'edge'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

function buildPrompt(g: Glacier): string {
  return `Eres el sistema de inteligencia glaciológica de SENTINEL, plataforma de monitoreo ambiental de Chile.

Datos reales del glaciar:
- Nombre: ${g.name}
- Región: ${g.region}
- Coordenadas: ${g.lat.toFixed(4)}°S, ${Math.abs(g.lon).toFixed(4)}°W
- Área actual: ${g.area} km²
- Cuenca: ${g.cuenca}
- Anomalía de temperatura: +${g.tempAnomaly}°C sobre baseline ERA5
- Balance de masa reciente: ${g.masaVar}
- Tendencia: ${g.trend}
- Variación de superficie: ${g.deltaShort} (${g.deltaYear})
- Índice de riesgo calculado: ${g.riesgo}/100 (${g.cat})
- Población dependiente: ${g.poblacion}

Genera un análisis JSON con exactamente este formato, sin texto extra:
{
  "diag": "2-3 oraciones de diagnóstico técnico basadas en los datos reales",
  "urgency": "CRÍTICA" | "ALTA" | "MEDIA" | "BAJA",
  "impact": "1-2 oraciones sobre impacto hídrico concreto para la cuenca y población",
  "recT": "Recomendación técnica de monitoreo o medición específica",
  "recR": "Recomendación de acción institucional o territorial"
}

Responde SOLO con el JSON. Sin markdown, sin explicaciones.`
}

export async function POST(req: NextRequest) {
  try {
    const { glacier } = await req.json() as { glacier: Glacier }

    if (!glacier?.id) {
      return new Response(JSON.stringify({ error: 'glacier required' }), { status: 400 })
    }

    if (!OPENROUTER_KEY) {
      const fallback: GlacierAI = {
        diag: `${glacier.name} registra una anomalía térmica de +${glacier.tempAnomaly}°C sobre el baseline ERA5. La variación de masa de ${glacier.masaVar} indica ${glacier.trend.toLowerCase()} en la última década.`,
        urgency: glacier.riesgo >= 76 ? 'CRÍTICA' : glacier.riesgo >= 51 ? 'ALTA' : glacier.riesgo >= 26 ? 'MEDIA' : 'BAJA',
        impact: `La cuenca ${glacier.cuenca} muestra dependencia hídrica de ${glacier.poblacion}. El retroceso glaciar reduce la regulación estacional del caudal.`,
        recT: 'Implementar monitoreo satelital mensual con imágenes Sentinel-2. Instalar estación nivometeorológica en la zona de acumulación.',
        recR: 'Coordinar con DGA y gobierno regional para actualizar el inventario de glaciares y revisar concesiones de agua en la cuenca.',
      }
      return new Response(JSON.stringify(fallback), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinel.vercel.app',
        'X-Title': 'SENTINEL Glaciares',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large',
        messages: [{ role: 'user', content: buildPrompt(glacier) }],
        temperature: 0.3,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!upstream.ok) throw new Error(`OpenRouter ${upstream.status}`)

    const json = await upstream.json() as { choices: { message: { content: string } }[] }
    const content = json.choices[0]?.message?.content ?? '{}'
    const match = content.match(/\{[\s\S]*\}/)
    const ai = JSON.parse(match?.[0] ?? content) as GlacierAI

    return new Response(JSON.stringify(ai), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[/api/glaciers/analyze]', err)
    return new Response(JSON.stringify({ error: 'analysis failed' }), { status: 500 })
  }
}
