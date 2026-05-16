import type { SentinelUpdate } from '@sentinel/types'

function windDegToDir(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

function buildWebhookPayload(update: SentinelUpdate, centroidLat: number, centroidLon: number) {
  const frpMax = update.fires.reduce((max, f) => Math.max(max, f.frp), 0)
  const firstRoute = update.naturalRoutes?.rutas?.[0]
  const zonas = update.report?.zonas_evacuacion_prioritaria?.slice(0, 3).join(', ') ?? null
  const acciones = update.report?.acciones_inmediatas?.slice(0, 2).join(' / ') ?? null

  return {
    // Contexto general
    risk_level: update.riskLevel,
    timestamp: update.timestamp,
    zona_afectada: update.riskAssessment?.zona_afectada ?? 'Zona no identificada',
    resumen_riesgo: update.riskAssessment?.resumen ?? null,

    // Ubicación
    centroid_lat: centroidLat,
    centroid_lon: centroidLon,
    google_maps_url: `https://maps.google.com/?q=${centroidLat},${centroidLon}`,

    // Focos
    fire_count: update.fires.length,
    frp_max_mw: Math.round(frpMax * 10) / 10,

    // Clima
    wind_speed_ms: update.weather.speed,
    wind_direction: windDegToDir(update.weather.deg),
    humidity_pct: update.weather.humidity,

    // Calidad del aire
    aqi: update.airQuality.aqi,
    aqi_category: update.airQuality.category,
    pm25: update.airQuality.pm25,

    // Expansión del fuego
    expansion_direction: update.expansion?.direccion_principal ?? null,
    expansion_speed_kmh: update.expansion?.velocidad_propagacion_kmh ?? null,
    expansion_12h_km2: update.expansion?.expansion_12h?.area_km2 ?? null,

    // Evacuación
    ruta_evacuacion: firstRoute ? `${firstRoute.nombre} — ${firstRoute.origen} → ${firstRoute.destino} (${firstRoute.estado})` : null,
    punto_encuentro: update.naturalRoutes?.punto_encuentro_principal ?? null,
    mensaje_alerta: update.naturalRoutes?.mensaje_alerta ?? null,

    // Reporte de autoridades
    nivel_emergencia: update.report?.nivel_emergencia ?? null,
    poblacion_en_riesgo: update.report?.poblacion_en_riesgo_estimada ?? null,
    zonas_evacuar: zonas,
    acciones_inmediatas: acciones,
    resumen_ejecutivo: update.report?.resumen_ejecutivo ?? null,
  }
}

export async function triggerMakeWebhook(update: SentinelUpdate, centroidLat: number, centroidLon: number): Promise<void> {
  const url = process.env.MAKE_WEBHOOK_URL
  if (!url) return

  const payload = buildWebhookPayload(update, centroidLat, centroidLon)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[alert] Make.com webhook failed: ${res.status}`)
    } else {
      console.log(`[alert] webhook enviado — zona: ${payload.zona_afectada}, nivel: ${payload.nivel_emergencia ?? payload.risk_level}`)
    }
  } catch (err) {
    console.error('[alert] Make.com webhook error:', err)
  }
}
