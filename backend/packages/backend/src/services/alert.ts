type ProximityFire = { lat: number; lon: number; frp: number; brightness: number }

export async function triggerCitizenProximityAlert(
  phone: string,
  fire: ProximityFire,
  distanceKm: number,
  userLat: number,
  userLon: number,
): Promise<void> {
  const url = process.env.MAKE_WEBHOOK_URL
  if (!url) return

  const payload = {
    to: phone,
    fire_lat: fire.lat,
    fire_lon: fire.lon,
    fire_frp_mw: Math.round(fire.frp * 10) / 10,
    fire_brightness: fire.brightness,
    distance_km: Math.round(distanceKm * 100) / 100,
    user_lat: userLat,
    user_lon: userLon,
    google_maps_fire_url: `https://maps.google.com/?q=${fire.lat},${fire.lon}`,
    timestamp: new Date().toISOString(),
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[alert] citizen proximity webhook failed: ${res.status}`)
    } else {
      console.log(`[alert] citizen WA → ${phone} — foco a ${distanceKm.toFixed(2)} km, FRP ${fire.frp} MW`)
    }
  } catch (err) {
    console.error('[alert] citizen proximity webhook error:', err)
  }
}
