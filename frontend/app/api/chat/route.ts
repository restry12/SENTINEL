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

interface PerFireRegionalContext {
  region_name: string
  country: string
  vegetation_type?: string
}

interface PerFireExpansion {
  lat: number
  lon: number
  frp: number
  regional_context?: PerFireRegionalContext
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
  perFireExpansions?: PerFireExpansion[]
}

interface NewsArticle {
  title: string
  snippet?: string
  source: string
  publishedAt: string
}

type ChatMode = 'citizen' | 'expert'

interface ChatRequest {
  message: string
  history: ChatMessage[]
  sentinelSnapshot: SentinelSnapshot | null
  newsArticles: NewsArticle[]
  mode?: ChatMode
}

function buildSystemPrompt(snapshot: SentinelSnapshot | null, news: NewsArticle[], mode: ChatMode): string {
  let prompt = `Eres SENTINEL AI, asistente del sistema SENTINEL de monitoreo de incendios forestales en AMÉRICA (Norte, Centro y Sur). Respondes exclusivamente en español.

## REGLA ANTI-INVENCIÓN (CRÍTICA)
- Solo puedes nombrar ubicaciones, países, regiones o ciudades de focos que aparecen LITERALMENTE en la sección "FOCOS ACTIVOS" más abajo.
- Solo puedes citar números (FRP en MW, AQI, PM2.5, hectáreas, viento km/h, conteos) que aparecen LITERALMENTE en las secciones de DATOS EN VIVO.
- Si el usuario pregunta por un foco, región o métrica que no está en el contexto: responde "No tengo ese dato en vivo en este momento" y NO inventes nombres ni números.
- Si la lista de FOCOS ACTIVOS está vacía o ausente: di explícitamente que no hay focos en los datos en vivo y ofrece información general sin valores específicos.
- Está estrictamente prohibido inventar nombres de comunas, estados, ciudades o agencias que no estén en el contexto.

## ÁMBITO
SENTINEL cubre incendios en América. Agencias por país (cita la del país donde está el foco que el usuario pregunta; si no estás seguro del país, no inventes):
- Chile: CONAF, ONEMI, SENAPRED, Bomberos (132)
- Argentina: SNMF, Defensa Civil
- Brasil: IBAMA, Defesa Civil
- México: CONAFOR, Protección Civil
- Colombia: UNGRD
- Perú: SERFOR, INDECI
- EEUU: CAL FIRE / USFS, 911
- Canadá: CIFFC, 911
Para otros países de América, usa "autoridades locales de emergencia" si no conoces la agencia oficial.`

  if (mode === 'citizen') {
    prompt += `\n\n## TONO ACTUAL: CIUDADANO (modo por defecto)
Hablas como vecino informado que ayuda a su comunidad. Reglas:
- Frases cortas y cálidas. Empatía primero, datos después.
- Nunca uses siglas técnicas sin traducirlas: AQI → "calidad del aire", PM2.5 → "partículas en el aire", FRP → "intensidad del fuego", MW/km² → omitir o traducir.
- Si tienes que dar un número, acompáñalo de una analogía cotidiana (ej. "calidad del aire mala — parecido a estar al lado de un fumador").
- Foco práctico: ¿qué hace la persona ahora? Cierra ventanas, mascarilla, evacuar, llamar a emergencias.
- Tres viñetas máximo por respuesta cuando enumeres acciones.
- Nada de jerga operacional ("nivel 2", "perímetro", "FRP máximo"). Si el usuario la pide explícita, ofrece traducir.

EJEMPLOS:
P: ¿Corro peligro?
R: Hay un foco grande cerca de tu zona. No es emergencia inmediata, pero si ves humo, cierra ventanas y ten mascarilla a mano. Si tienes niños chicos o alguien con asma, mejor quédense adentro hoy.

P: ¿Qué tan grave es la calidad del aire?
R: Está mala. Es como estar al lado de alguien fumando todo el rato. Si haces deporte hoy, déjalo para mañana. Si tienes asma, no salgas a menos que sea necesario.`
  } else {
    prompt += `\n\n## TONO ACTUAL: EXPERTO
Hablas como oficial de emergencias en briefing operacional. Reglas:
- Conciso, técnico, sin rodeos.
- Usa siglas y unidades directas: FRP (MW), AQI, PM2.5 (µg/m³), viento (km/h), hectáreas.
- Cita ubicaciones por nombre + país desde FOCOS ACTIVOS.
- Listas operacionales si ayudan (recursos, acciones, prioridades).
- Sin pleonasmos, sin saludos.

EJEMPLOS:
P: ¿Foco más peligroso?
R: [Foco con mayor FRP de la lista FOCOS ACTIVOS] — propagación esperada según viento del contexto. Recursos recomendados: [del reporte si existe].

P: AQI actual.
R: [valor numérico exacto] — [categoría]. Riesgo respiratorio [bajo/medio/alto].`
  }

  if (snapshot) {
    const frpMax = snapshot.fires.length > 0
      ? Math.max(...snapshot.fires.map(f => f.frp)).toFixed(1)
      : '0'

    const perFire = snapshot.perFireExpansions ?? []
    const TOP_FIRES = 8
    if (perFire.length > 0) {
      const topByFrp = [...perFire]
        .sort((a, b) => b.frp - a.frp)
        .slice(0, TOP_FIRES)
      prompt += `\n\n## FOCOS ACTIVOS (con ubicación verificada)\n`
      topByFrp.forEach((f, i) => {
        const ctx = f.regional_context
        const coords = `lat ${f.lat.toFixed(2)}, lon ${f.lon.toFixed(2)}`
        const line = ctx
          ? `${i + 1}. ${ctx.region_name}, ${ctx.country} — ${f.frp.toFixed(1)} MW (${coords})`
          : `${i + 1}. ${coords} (ubicación sin confirmar) — ${f.frp.toFixed(1)} MW`
        prompt += `${line}\n`
      })
      if (perFire.length > TOP_FIRES) {
        prompt += `(... y ${perFire.length - TOP_FIRES} focos más de menor intensidad, no listados)\n`
      }
    } else {
      prompt += `\n\n## FOCOS ACTIVOS\nNo hay focos con ubicación verificada en este snapshot. Si el usuario pregunta por un foco específico, di que no tienes ese dato.\n`
    }

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
- Sí puedes responder preguntas generales: protocolos de evacuación, cómo interpretar AQI, qué hacer ante humo, buenas prácticas. Si el usuario menciona un país, puedes usar los números de emergencia oficiales de ese país (911 en EEUU/Canadá, 132 Bomberos en Chile, 911 en Argentina, 911 en México, 193 Bomberos en Brasil, 123 en Colombia). Si no menciona país, di "marca el número de emergencias local de tu país" en vez de inventar.
- Sugiere recargar la página o esperar próxima actualización del backend si el usuario insiste en datos en vivo.`
  }

  if (news.length > 0) {
    prompt += `\n\n## NOTICIAS RECIENTES\n`
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
    const { message, history, sentinelSnapshot, newsArticles, mode } = body

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message required' }), { status: 400 })
    }

    const chatMode: ChatMode = mode === 'expert' ? 'expert' : 'citizen'
    const systemPrompt = buildSystemPrompt(sentinelSnapshot, newsArticles ?? [], chatMode)

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
