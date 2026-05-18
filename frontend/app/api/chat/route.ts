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
  weather?: { speed: number; deg: number; humidity: number; temp?: number }
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

interface GlacierSummary {
  name: string
  glimsId: string
  area: number
  riesgo: number
  cat: string
  lat: number
  lon: number
  trend: string
  srcDate?: string
}

interface GlacierForecastSnapshot {
  trajectory: string
  confidence: number
  horizon6m: { areaPctChange: number; massBalance: number }
  horizon12m: { areaPctChange: number; massBalance: number }
  horizon24m: { areaPctChange: number; massBalance: number }
  rationale?: string
}

interface SelectedGlacierSnapshot extends GlacierSummary {
  tempAnomaly?: number
  deltaShort?: string
  deltaYear?: string
  masaVar?: string
  forecast?: GlacierForecastSnapshot
  diag?: string
}

interface GlaciersBlock {
  total: number
  byRisk: GlacierSummary[]
  byArea: GlacierSummary[]
  byRetreat: GlacierSummary[]
  selected?: SelectedGlacierSnapshot
}

interface SevereWeatherTopPoint {
  lat: number
  lon: number
  score: number
  risk_level: string
  country_iso?: string | null
  wind_gusts_10m: number | null
}

interface SevereWeatherBlock {
  timestamp?: string
  total: number
  critical: number
  high: number
  moderate: number
  top: SevereWeatherTopPoint[]
}

interface ChatRequest {
  message: string
  history: ChatMessage[]
  sentinelSnapshot: SentinelSnapshot | null
  newsArticles: NewsArticle[]
  mode?: ChatMode
  glaciers?: GlaciersBlock | null
  severeWeather?: SevereWeatherBlock | null
}

function buildSystemPrompt(
  snapshot: SentinelSnapshot | null,
  news: NewsArticle[],
  mode: ChatMode,
  glaciers: GlaciersBlock | null,
  severeWeather: SevereWeatherBlock | null,
): string {
  let prompt = `Eres SENTINEL AI, asistente del sistema SENTINEL de monitoreo ambiental: incendios forestales en AMÉRICA, glaciares del mundo (GLIMS/Open-Meteo), y eventos meteorológicos severos / tornados (SSPI). Respondes exclusivamente en español.

## REGLA ANTI-INVENCIÓN (CRÍTICA)
- Solo puedes nombrar ubicaciones, países, regiones, glaciares o ciudades que aparecen LITERALMENTE en las secciones de DATOS EN VIVO más abajo (FOCOS ACTIVOS, GLACIARES, EVENTOS SEVEROS).
- Solo puedes citar números (FRP en MW, AQI, PM2.5, hectáreas, viento km/h, conteos, área km², riesgo /100, anomalía térmica, SSPI score) que aparecen LITERALMENTE en el contexto.
- Si el usuario pregunta por algo que no está en el contexto: responde "No tengo ese dato en vivo en este momento" y NO inventes nombres ni números.
- Si una sección está vacía o ausente: di explícitamente que no hay datos vivos para ese dominio.
- Está estrictamente prohibido inventar nombres de comunas, estados, ciudades, glaciares, GLIMS IDs o agencias que no estén en el contexto.
- **CLIMA:** Los datos de viento, humedad y temperatura que aparecen en DATOS EN VIVO o CLIMA pertenecen ÚNICAMENTE a la zona de análisis (punto donde se disparó el sistema). NO corresponden a focos de otros países o regiones. Nunca atribuyas ese clima a un foco, glaciar o tornado de otro país.

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
- **EXTREMADAMENTE CONCISO:** Respuestas de máximo 2-3 oraciones breves. No te extiendas.
- Frases cortas y cálidas. Empatía primero, datos después.
- Nunca uses siglas técnicas sin traducirlas: AQI → "calidad del aire", PM2.5 → "partículas en el aire", FRP → "intensidad del fuego", MW/km² → omitir o traducir.
- Si tienes que dar un número, acompáñalo de una analogía cotidiana (ej. "calidad del aire mala — parecido a estar al lado de un fumador").
- Foco práctico: ¿qué hace la persona ahora? Cierra ventanas, mascarilla, evacuar, llamar a emergencias.
- Una o dos viñetas máximo por respuesta si es necesario enumerar.
- Nada de jerga operacional ("nivel 2", "perímetro", "FRP máximo"). Si el usuario la pide explícita, ofrece traducir.

EJEMPLOS:
P: ¿Corro peligro?
R: Hay un incendio activo cerca. Si ves humo, cierra ventanas y usa mascarilla. No es emergencia inmediata, pero mantente alerta.

P: ¿Qué tan grave es la calidad del aire?
R: La calidad es mala, similar a estar cerca de un fumador. Evita el deporte al aire libre y mantén a niños dentro.`
  } else {
    prompt += `\n\n## TONO ACTUAL: EXPERTO
Hablas como oficial de emergencias en briefing operacional. Reglas:
- **BREVEDAD MÁXIMA:** Respuestas directas al punto. Sin saludos ni despedidas.
- Conciso, técnico, sin rodeos.
- Usa siglas y unidades directas: FRP (MW), AQI, PM2.5 (µg/m³), viento (km/h), hectáreas.
- Cita ubicaciones por nombre + país desde FOCOS ACTIVOS.
- Sin pleonasmos.

EJEMPLOS:
P: ¿Foco más peligroso?
R: Foco en [Ubicación] ([País]) con [X] MW. Riesgo de propagación por viento de [X] km/h.

P: AQI actual.
R: [Valor] — [Categoría]. Riesgo respiratorio [nivel].`
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
      const zona = snapshot.riskAssessment.zona_afectada
      prompt += `- Zona de análisis (punto donde se disparó el sistema): ${zona}\n`
      prompt += `- Evaluación de riesgo (específica para ${zona}): ${snapshot.riskAssessment.resumen}\n`
    }

    if (snapshot.weather) {
      const zona = snapshot.riskAssessment?.zona_afectada ?? 'zona de análisis'
      const windKmh = (snapshot.weather.speed * 3.6).toFixed(1)
      prompt += `\n## CLIMA EN ZONA DE ANÁLISIS (${zona})\n`
      prompt += `⚠️ Estos datos climáticos son EXCLUSIVOS de ${zona}. NO aplican a focos en otros países o regiones.\n`
      prompt += `- Viento: ${windKmh} km/h\n`
      prompt += `- Humedad: ${snapshot.weather.humidity}%\n`
      if (snapshot.weather.temp != null) prompt += `- Temperatura: ${snapshot.weather.temp}°C\n`
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

  if (glaciers && (glaciers.byRisk.length > 0 || glaciers.byArea.length > 0)) {
    prompt += `\n\n## GLACIARES (GLIMS · universo: ${glaciers.total.toLocaleString('es-CL')})\n`
    prompt += `Fuentes: GLIMS Glacier Database (NSIDC) + Open-Meteo Archive. Score interno 0-100.\n`

    const top = glaciers.byRisk.slice(0, 6)
    if (top.length > 0) {
      prompt += `\n### Top riesgo global:\n`
      top.forEach((g, i) => {
        prompt += `${i + 1}. ${g.name} (${g.glimsId}) — riesgo ${g.riesgo}/100 [${g.cat}], área ${g.area.toFixed(2)} km², trend ${g.trend}, lat ${g.lat.toFixed(2)} lon ${g.lon.toFixed(2)}\n`
      })
    }

    const topArea = glaciers.byArea.slice(0, 5)
    if (topArea.length > 0) {
      prompt += `\n### Top tamaño:\n`
      topArea.forEach((g, i) => {
        prompt += `${i + 1}. ${g.name} (${g.glimsId}) — área ${g.area.toFixed(2)} km², riesgo ${g.riesgo}/100\n`
      })
    }

    const topRetreat = glaciers.byRetreat.slice(0, 5)
    if (topRetreat.length > 0) {
      prompt += `\n### Top retroceso (composite riesgo+edad+area):\n`
      topRetreat.forEach((g, i) => {
        prompt += `${i + 1}. ${g.name} (${g.glimsId}) — última obs ${g.srcDate ?? 'N/D'}, riesgo ${g.riesgo}/100, área ${g.area.toFixed(2)} km²\n`
      })
    }

    if (glaciers.selected) {
      const s = glaciers.selected
      prompt += `\n### Glaciar seleccionado por el usuario:\n`
      prompt += `- ${s.name} (${s.glimsId}) — lat ${s.lat.toFixed(4)}, lon ${s.lon.toFixed(4)}\n`
      prompt += `- Área: ${s.area.toFixed(3)} km², riesgo ${s.riesgo}/100 [${s.cat}], trend ${s.trend}\n`
      if (s.tempAnomaly != null) prompt += `- Anomalía térmica: ${s.tempAnomaly > 0 ? '+' : ''}${s.tempAnomaly.toFixed(2)} °C\n`
      if (s.deltaShort) prompt += `- Δ corto: ${s.deltaShort}, Δ anual: ${s.deltaYear ?? 'N/D'}, masa: ${s.masaVar ?? 'N/D'}\n`
      if (s.diag) prompt += `- Diagnóstico IA previo: ${s.diag}\n`
      if (s.forecast) {
        const f = s.forecast
        prompt += `- Pronóstico IA: trayectoria ${f.trajectory} (confianza ${f.confidence}%). 6m: ${f.horizon6m.areaPctChange > 0 ? '+' : ''}${f.horizon6m.areaPctChange.toFixed(1)}% área / ${f.horizon6m.massBalance.toFixed(2)} m EH. 12m: ${f.horizon12m.areaPctChange.toFixed(1)}% / ${f.horizon12m.massBalance.toFixed(2)}. 24m: ${f.horizon24m.areaPctChange.toFixed(1)}% / ${f.horizon24m.massBalance.toFixed(2)}.\n`
        if (f.rationale) prompt += `- Razonamiento forecast: ${f.rationale}\n`
      }
    }
  } else {
    prompt += `\n\n## GLACIARES\nNo hay datos en vivo de glaciares en este snapshot. Si el usuario pregunta por glaciares puntuales: di "No tengo ese dato en vivo" y sugiere abrir la pestaña Glaciares para cargar el ranking global.\n`
  }

  if (severeWeather && severeWeather.top.length > 0) {
    prompt += `\n\n## EVENTOS METEOROLÓGICOS SEVEROS (SSPI · ${severeWeather.timestamp ?? 'sin timestamp'})\n`
    prompt += `Total puntos escaneados: ${severeWeather.total} · CRÍTICO ${severeWeather.critical} · ALTO ${severeWeather.high} · MODERADO ${severeWeather.moderate}.\n`
    prompt += `\n### Top puntos por SSPI score (riesgo tornado/severo):\n`
    severeWeather.top.forEach((p, i) => {
      const country = p.country_iso ? ` [${p.country_iso}]` : ''
      const gusts = p.wind_gusts_10m != null ? `, ráfagas ${p.wind_gusts_10m} km/h` : ''
      prompt += `${i + 1}. lat ${p.lat.toFixed(2)} lon ${p.lon.toFixed(2)}${country} — SSPI ${p.score.toFixed(2)} [${p.risk_level}]${gusts}\n`
    })
    prompt += `\nSSPI = Severe Storm Potential Index. CRITICAL ≥ alta probabilidad de tornado/granizo/vientos destructivos. Recomendar refugio, monitoreo meteorológico oficial.\n`
  } else {
    prompt += `\n\n## EVENTOS METEOROLÓGICOS SEVEROS\nNo hay datos en vivo del agente severe-weather. Si el usuario pregunta por tornados o tormentas severas: di "No tengo escaneo activo en vivo" y sugiere abrir la pestaña Tornados.\n`
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
    const { message, history, sentinelSnapshot, newsArticles, mode, glaciers, severeWeather } = body

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message required' }), { status: 400 })
    }

    const chatMode: ChatMode = mode === 'expert' ? 'expert' : 'citizen'
    const systemPrompt = buildSystemPrompt(
      sentinelSnapshot,
      newsArticles ?? [],
      chatMode,
      glaciers ?? null,
      severeWeather ?? null,
    )

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
