// frontend/components/air/smoke-engine.ts
import type { FirePoint, WindData } from "./types"

interface MapLike {
  latLngToContainerPoint(latlng: [number, number]): { x: number; y: number }
}

const PUFF_COUNT    = 15
const PUFF_DURATION = 4000
const MAX_DRIFT_PX  = 350

function windCanvasVec(wind: WindData): { dx: number; dy: number } {
  const toRad = ((wind.fromDeg + 180) % 360) * (Math.PI / 180)
  return {
    dx:  Math.sin(toRad),
    dy: -Math.cos(toRad),
  }
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  map: MapLike,
  fires: FirePoint[],
  wind: WindData,
  elapsed: number
): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  const { dx, dy } = windCanvasVec(wind)
  const windMag = wind.speed / 24

  fires.forEach(fire => {
    const pt = map.latLngToContainerPoint([fire.lat, fire.lng])
    const ox = pt.x
    const oy = pt.y

    // ── Smoke puffs ──────────────────────────────────────────────
    for (let i = 0; i < PUFF_COUNT; i++) {
      const phaseMs = (i / PUFF_COUNT) * PUFF_DURATION
      const t = ((elapsed + phaseMs) % PUFF_DURATION) / PUFF_DURATION

      const drift  = t * MAX_DRIFT_PX * windMag
      const wobX   = Math.sin(t * Math.PI * 4 + i * 1.3) * 15
      const wobY   = Math.cos(t * Math.PI * 3 + i * 0.9) * 10

      const sx     = ox + dx * drift + wobX
      const sy     = oy + dy * drift + wobY
      const radius = (15 + t * 100) * fire.intensity
      const alpha  = Math.sin(t * Math.PI) * 0.22 * fire.intensity

      if (alpha < 0.005 || radius < 1) continue

      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(Math.atan2(dy, dx))
      ctx.scale(1.4, 1)

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      grad.addColorStop(0,   `rgba(150,150,165,${alpha.toFixed(3)})`)
      grad.addColorStop(0.5, `rgba(110,110,125,${(alpha * 0.6).toFixed(3)})`)
      grad.addColorStop(1,   "rgba(70,70,85,0)")

      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // ── Fire glow ─────────────────────────────────────────────────
    const pulse  = 0.45 + Math.sin(elapsed / 400) * 0.12
    const gGlow  = ctx.createRadialGradient(ox, oy, 0, ox, oy, 65)
    gGlow.addColorStop(0,    `rgba(255,160,0,${pulse.toFixed(3)})`)
    gGlow.addColorStop(0.35, `rgba(255,80,0,${(pulse * 0.55).toFixed(3)})`)
    gGlow.addColorStop(0.7,  `rgba(200,30,0,${(pulse * 0.18).toFixed(3)})`)
    gGlow.addColorStop(1,    "rgba(150,0,0,0)")

    ctx.beginPath()
    ctx.arc(ox, oy, 65, 0, Math.PI * 2)
    ctx.fillStyle = gGlow
    ctx.fill()

    // ── Ember particles ───────────────────────────────────────────
    for (let e = 0; e < 5; e++) {
      const et = ((elapsed / 900 + e * 0.4) % 1)
      const ex = ox + dx * et * 70 + Math.sin(et * 18 + e) * 10
      const ey = oy + dy * et * 70 - et * 25 + Math.cos(et * 14 + e) * 7
      const ea = (1 - et) * 0.85
      const er = 1.5 + (1 - et) * 1.5

      ctx.beginPath()
      ctx.arc(ex, ey, er, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,${Math.floor(160 * (1 - et))},0,${ea.toFixed(3)})`
      ctx.fill()
    }
  })
}
