import { NextRequest } from 'next/server'

// Edge runtime — supports long-running streaming responses and avoids
// the 10s serverless timeout on Vercel Hobby. Compatible: only uses
// fetch, Web Streams, and process.env (all available on Edge).
export const runtime = 'edge'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface FireData {
  lat: number
  lon: number
  frp: number
  brightness: number
  timestamp: string
}

interface SentinelSnapshot {
  timestamp: string
  fires: FireData[]
  airQuality: { pm25: number; aqi: number; category: string }
  riskLevel: string
  riskAssessment?: { zona_afectada: string; resumen: string }
  report?: {
    nivel_emergencia: string
    poblacion_en_riesgo_estimada: number
    resumen_ejecutivo: string
    acciones_inmediatas: string[]
    zonas_evacuacion_prioritaria: string[]
  }
  naturalRoutes?: {
    punto_encuentro_principal: string
    rutas: Array<{ nombre: string; estado: string; distancia_km: number }>
  }
  prediction?: {
    analisis_6h: string
    analisis_24h: string
    analisis_72h: string
    confianza: string
  }
}

interface NewsArticle {
  title: string
  snippet?: string
  source: string
  publishedAt: string
}

interface ChatRequest {
  message: string
  history: ChatMessage[]
  sentinelSnapshot: SentinelSnapshot | null
  newsArticles: NewsArticle[]
}

function buildSystemPrompt(snapshot: SentinelSnapshot | null, news: NewsArticle[]): string {
  let prompt = `Eres SENTINEL AI, asistente del sistema SENTINEL de monitoreo de incendios forestales en CHILE. Respondes exclusivamente en español.

## REGLA ANTI-INVENCIÓN (CRÍTICA)
Solo puedes citar datos específicos (coordenadas, FRP en MW, hectáreas, nombres de focos, AQI numérico, comunas afectadas, viento en km/h) si aparecen LITERALMENTE en la sección "DATOS EN VIVO" más abajo. Si esa sección dice que no hay datos, o si el dato específico no está listado:
- NO inventes números, ubicaciones ni nombres de agencias.
- NO menciones lugares fuera de Chile (México, CONAFOR, Sierra de Coalcomán, etc. están prohibidos).
- Responde: "No tengo datos en vivo de ese foco/métrica en este momento." y ofrece información general útil (qué hacer, protocolos, cómo interpretar AQI/FRP en general) SIN inventar valores concretos.
- Si el usuario pide ranking o "el más peligroso" y no hay focos en la lista, dilo explícitamente.

## ÁMBITO
Solo Chile. Agencias: CONAF, ONEMI, SENAPRED, Bomberos (132). Nunca menciones CONAFOR ni agencias de otros países.

## TONO — REGLA DE ADAPTACIÓN
Lees el nivel técnico de la pregunta y respondes en el mismo nivel:
- Si la pregunta usa términos técnicos (FRP, AQI, PM2.5, MW, hectáreas), responde técnico y conciso, como oficial de emergencias.
- Si la pregunta es coloquial ("¿corro peligro?", "¿qué hago?", "¿es grave?"), responde simple, cálido y empático, como vecino informado. Traduce siglas a lenguaje cotidiano: AQI → "calidad del aire", PM2.5 → "partículas en el aire", FRP → "intensidad del fuego".
- Frases cortas siempre. Sin saludos innecesarios. Sin rodeos. Usa listas solo cuando ayudan.

## EJEMPLOS DE ADAPTACIÓN

P: ¿Cuál es el FRP máximo actual?
R: 142.3 MW en el foco de Quilpué. Tres focos sobre 80 MW. Propagación esperada hacia el norte por viento de 18 km/h.

P: ¿Hay peligro en mi zona?
R: Hay tres focos activos cerca de Valparaíso. Si el viento se mantiene, el humo puede llegar en 2-3 horas. No es emergencia inmediata, pero conviene cerrar ventanas y tener mascarillas a mano, sobre todo si hay niños chicos o alguien con asma.

P: ¿Qué tan grave es un AQI de 145?
R: Calidad del aire mala. Es parecido a estar al lado de alguien fumando, todo el rato. Si eres sano, sentirás molestia en la garganta. Si tienes asma o eres adulto mayor, mejor quédate adentro y evita hacer deporte hoy.

P: ¿Qué hago si veo humo cerca?
R: Tres cosas: 1) Cierra puertas y ventanas. 2) Si tienes mascarilla N95 o KN95, úsala. 3) No salgas a menos que sea necesario. Si el humo es denso o ves fuego cercano, llama al 132 (Bomberos) y prepárate para evacuar.`

  if (snapshot) {
    const frpMax = snapshot.fires.length > 0
      ? Math.max(...snapshot.fires.map(f => f.frp)).toFixed(1)
      : '0'

    prompt += `\n\n## DATOS EN VIVO [${snapshot.timestamp}]\n`
    prompt += `- Focos activos: ${snapshot.fires.length}\n`
    prompt += `- FRP máximo: ${frpMax} MW\n`
    prompt += `- AQI: ${snapshot.airQuality.aqi} — ${snapshot.airQuality.category}\n`
    prompt += `- PM2.5: ${snapshot.airQuality.pm25} µg/m³\n`
    prompt += `- Nivel de riesgo: ${snapshot.riskLevel.toUpperCase()}\n`

    if (snapshot.riskAssessment) {
      prompt += `- Zona afectada: ${snapshot.riskAssessment.zona_afectada}\n`
      prompt += `- Evaluación: ${snapshot.riskAssessment.resumen}\n`
    }

    if (snapshot.report) {
      prompt += `\n## REPORTE DE AUTORIDAD\n`
      prompt += `- Nivel emergencia: ${snapshot.report.nivel_emergencia}\n`
      prompt += `- Población en riesgo: ${snapshot.report.poblacion_en_riesgo_estimada?.toLocaleString('es-CL')}\n`
      prompt += `- Resumen ejecutivo: ${snapshot.report.resumen_ejecutivo}\n`
      if (snapshot.report.acciones_inmediatas?.length) {
        prompt += `- Acciones inmediatas: ${snapshot.report.acciones_inmediatas.join(' | ')}\n`
      }
      if (snapshot.report.zonas_evacuacion_prioritaria?.length) {
        prompt += `- Zonas evacuación: ${snapshot.report.zonas_evacuacion_prioritaria.join(', ')}\n`
      }
    }

    if (snapshot.naturalRoutes) {
      prompt += `\n## RUTAS DE EVACUACIÓN\n`
      prompt += `- Punto de encuentro: ${snapshot.naturalRoutes.punto_encuentro_principal}\n`
      snapshot.naturalRoutes.rutas.slice(0, 4).forEach(r => {
        prompt += `- ${r.nombre}: ${r.estado} (${r.distancia_km} km)\n`
      })
    }

    if (snapshot.prediction) {
      prompt += `\n## PREDICCIÓN DE RIESGO\n`
      prompt += `- 6h: ${snapshot.prediction.analisis_6h}\n`
      prompt += `- 24h: ${snapshot.prediction.analisis_24h}\n`
      prompt += `- 72h: ${snapshot.prediction.analisis_72h}\n`
      prompt += `- Confianza: ${snapshot.prediction.confianza}\n`
    }
  } else {
    prompt += `\n\n## DATOS EN VIVO\n**NO HAY DATOS EN VIVO DISPONIBLES.** El sistema no recibió snapshot del backend.

Reglas para esta situación:
- Si el usuario pregunta por focos específicos, AQI actual, ubicaciones, FRP o cualquier métrica concreta: di literalmente "No tengo datos en vivo en este momento" y NO inventes números, coordenadas ni nombres.
- Sí puedes responder preguntas generales: protocolos de evacuación, cómo interpretar AQI, qué hacer ante humo, números de emergencia chilenos (132 Bomberos, 133 Carabineros, 134 PDI), buenas prácticas.
- Sugiere recargar la página o esperar próxima actualización del backend si el usuario insiste en datos en vivo.`
  }

  if (news.length > 0) {
    prompt += `\n\n## NOTICIAS RECIENTES (Chile)\n`
    news.slice(0, 8).forEach((n, i) => {
      prompt += `${i + 1}. [${n.source}] ${n.title}${n.snippet ? ` — ${n.snippet}` : ''}\n`
    })
  }

  return prompt
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!OPENROUTER_KEY) {
    console.error('OPENROUTER_API_KEY is not set')
    return new Response(JSON.stringify({ error: 'service not configured' }), { status: 500 })
  }

  try {
    const body: ChatRequest = await req.json()
    const { message, history, sentinelSnapshot, newsArticles } = body

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message required' }), { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(sentinelSnapshot, newsArticles ?? [])

    // Cap history to last 20 messages to avoid runaway token cost from a buggy / hostile client.
    const safeHistory = (history ?? []).slice(-20)

    const messages: ChatMessage[] = [
      ...safeHistory,
      { role: 'user', content: message },
    ]

    // Forward client cancellation + 60s hard timeout so a hanging OpenRouter call
    // doesn't keep burning tokens after the user closes the tab. AbortSignal.any
    // is gated because Edge runtime support is inconsistent across Next versions.
    const timeoutSignal = AbortSignal.timeout(60_000)
    const signal = typeof (AbortSignal as { any?: unknown }).any === 'function'
      ? AbortSignal.any([req.signal, timeoutSignal])
      : timeoutSignal

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinel.vercel.app',
        'X-Title': 'SENTINEL',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.3,
        stream: true,
      }),
      signal,
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      console.error('OpenRouter error:', err)
      return new Response(JSON.stringify({ error: 'upstream error' }), { status: 502 })
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('Chat route error:', err)
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500 })
  }
}
