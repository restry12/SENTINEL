import type { WindData } from "./types"

export interface SmokeSource {
  id:        string
  x:         number
  y:         number
  intensity: number
}

const PUFF_COUNT    = 28
const PUFF_DURATION = 5000
const MAX_DRIFT_PX  = 420

function windCanvasVec(wind: WindData): { dx: number; dy: number } {
  const toRad = ((wind.fromDeg + 180) % 360) * (Math.PI / 180)
  return { dx: Math.sin(toRad), dy: -Math.cos(toRad) }
}

function drawHaze(
  ctx:     CanvasRenderingContext2D,
  sources: SmokeSource[],
  wind:    WindData,
  elapsed: number
): void {
  const { dx, dy } = windCanvasVec(wind)
  const windMag    = wind.speed / 24

  sources.forEach(src => {
    for (let i = 0; i < 6; i++) {
      const t     = ((elapsed * 0.28 + i * 900) % 7000) / 7000
      const drift = t * 700 * windMag
      const hx    = src.x + dx * drift
      const hy    = src.y + dy * drift
      const r     = (90 + t * 280) * src.intensity
      const alpha = Math.sin(t * Math.PI) * 0.055 * src.intensity

      if (alpha < 0.002) continue

      const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, r)
      grad.addColorStop(0, `rgba(110,108,118,${alpha.toFixed(3)})`)
      grad.addColorStop(1, "rgba(70,70,80,0)")
      ctx.beginPath()
      ctx.arc(hx, hy, r, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }
  })
}

export function drawFrame(
  ctx:     CanvasRenderingContext2D,
  sources: SmokeSource[],
  wind:    WindData,
  elapsed: number
): void {
  const { dx, dy } = windCanvasVec(wind)
  const windMag    = wind.speed / 24

  // Background atmospheric haze layer
  drawHaze(ctx, sources, wind, elapsed)

  sources.forEach(src => {
    const ox = src.x
    const oy = src.y

    // Smoke puffs
    for (let i = 0; i < PUFF_COUNT; i++) {
      const phaseMs = (i / PUFF_COUNT) * PUFF_DURATION
      const t       = ((elapsed + phaseMs) % PUFF_DURATION) / PUFF_DURATION

      const drift = t * MAX_DRIFT_PX * windMag
      const wobX  = Math.sin(t * Math.PI * 3.5 + i * 1.3) * 18
      const wobY  = Math.cos(t * Math.PI * 2.8 + i * 0.9) * 12

      const sx     = ox + dx * drift + wobX
      const sy     = oy + dy * drift + wobY
      const radius = (18 + t * 120) * src.intensity
      const alpha  = Math.sin(t * Math.PI) * 0.20 * src.intensity

      if (alpha < 0.005 || radius < 1) continue

      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(Math.atan2(dy, dx))
      ctx.scale(1.5, 1)

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      grad.addColorStop(0,   `rgba(155,152,168,${alpha.toFixed(3)})`)
      grad.addColorStop(0.4, `rgba(115,112,128,${(alpha * 0.65).toFixed(3)})`)
      grad.addColorStop(0.8, `rgba(80,78,92,${(alpha * 0.25).toFixed(3)})`)
      grad.addColorStop(1,   "rgba(60,60,72,0)")

      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // Emission point glow — neutral gray
    const pulse = 0.28 + Math.sin(elapsed / 550) * 0.07
    const glow  = ctx.createRadialGradient(ox, oy, 0, ox, oy, 48)
    glow.addColorStop(0,   `rgba(185,175,165,${pulse.toFixed(3)})`)
    glow.addColorStop(0.5, `rgba(135,128,122,${(pulse * 0.4).toFixed(3)})`)
    glow.addColorStop(1,   "rgba(80,80,80,0)")

    ctx.beginPath()
    ctx.arc(ox, oy, 48, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  })
}
