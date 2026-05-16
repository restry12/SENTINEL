import type { WindData } from "./types"

export interface SmokeSource {
  id: string
  x: number        // pixel position
  y: number        // pixel position
  intensity: number
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
  sources: SmokeSource[],
  wind: WindData,
  elapsed: number
): void {
  const { dx, dy } = windCanvasVec(wind)
  const windMag = wind.speed / 24

  sources.forEach(src => {
    const ox = src.x
    const oy = src.y

    // ── Smoke puffs ──────────────────────────────────────────────
    for (let i = 0; i < PUFF_COUNT; i++) {
      const phaseMs = (i / PUFF_COUNT) * PUFF_DURATION
      const t = ((elapsed + phaseMs) % PUFF_DURATION) / PUFF_DURATION

      const drift  = t * MAX_DRIFT_PX * windMag
      const wobX   = Math.sin(t * Math.PI * 4 + i * 1.3) * 15
      const wobY   = Math.cos(t * Math.PI * 3 + i * 0.9) * 10

      const sx     = ox + dx * drift + wobX
      const sy     = oy + dy * drift + wobY
      const radius = (15 + t * 100) * src.intensity
      const alpha  = Math.sin(t * Math.PI) * 0.22 * src.intensity

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

    // ── Emission point glow (neutral, no fire color) ─────────────
    const pulse = 0.3 + Math.sin(elapsed / 600) * 0.08
    const glow  = ctx.createRadialGradient(ox, oy, 0, ox, oy, 40)
    glow.addColorStop(0,   `rgba(180,170,160,${pulse.toFixed(3)})`)
    glow.addColorStop(0.5, `rgba(130,125,120,${(pulse * 0.4).toFixed(3)})`)
    glow.addColorStop(1,   "rgba(80,80,80,0)")

    ctx.beginPath()
    ctx.arc(ox, oy, 40, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()
  })
}
