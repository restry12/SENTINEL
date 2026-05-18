"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { SentinelMap } from './sentinel-map'
import type { ScreenRisk, NaturalRoute } from '@/lib/citizen-mock-data'

// ── Shared components ─────────────────────────────────────────────────────

interface StatusStripProps { riskLevel?: ScreenRisk }

export function SentinelStatusStrip({ riskLevel = 'critical' }: StatusStripProps) {
  const tone = {
    critical: { dot: 'var(--critical)', label: 'ALERTA CRÍTICA' },
    high:     { dot: 'var(--warning)',  label: 'ALERTA ALTA' },
    medium:   { dot: 'var(--warning)',  label: 'AVISO' },
    low:      { dot: 'var(--info)',     label: 'INFORME' },
  }[riskLevel] ?? { dot: 'var(--critical)', label: 'ALERTA CRÍTICA' }

  return (
    <div style={{
      position: 'absolute', top: 54, left: 0, right: 0,
      paddingLeft: 18, paddingRight: 18, paddingBottom: 6,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 12, zIndex: 25,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <SentinelLogo size={16} />
        <span className="font-mono" style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em' }}>SENTINEL</span>
      </div>
      <div className="font-mono" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em',
      }}>
        <span>ALR–14:18</span>
        <span style={{
          width: 6, height: 6, borderRadius: 999, background: tone.dot,
          boxShadow: `0 0 6px ${tone.dot}`,
          animation: 'pulse-strong 1.1s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

function SentinelLogo({ size = 18 }: { size?: number }) {
  return (
    <img
      src="/sentinel-logo.png"
      alt="SENTINEL"
      style={{ height: size, width: 'auto', objectFit: 'contain', display: 'block' }}
    />
  )
}

interface AlertBannerProps { riskLevel?: ScreenRisk }

export function AlertBanner({ riskLevel = 'critical' }: AlertBannerProps) {
  const palette = {
    critical: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.35)', fg: 'var(--critical)', label: 'INCENDIO · ACCIÓN INMEDIATA' },
    high:     { bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.35)', fg: 'var(--warning)',  label: 'INCENDIO · RIESGO ALTO' },
    medium:   { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.30)', fg: 'var(--warning)',  label: 'INCENDIO CERCANO · ATENCIÓN' },
    low:      { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.30)', fg: 'var(--info)',     label: 'INFORME · MANTENTE INFORMADO' },
  }[riskLevel]

  return (
    <div style={{
      margin: '0 14px', borderRadius: 12,
      background: palette.bg, border: `1px solid ${palette.border}`,
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: 999,
        background: palette.fg, boxShadow: `0 0 12px ${palette.fg}`,
        animation: 'pulse-strong 1.1s ease-in-out infinite', flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: palette.fg, fontWeight: 600, textTransform: 'uppercase' }}>
          {palette.label}
        </div>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.05em', color: 'var(--text-dim)', marginTop: 2 }}>
          F-2041 · 0.74 KM AL NO · DETECTADO 14:18
        </div>
      </div>
      <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
        ETA<br/><span style={{ color: palette.fg, fontWeight: 600, fontSize: 13 }}>18m</span>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="font-mono" style={{ fontSize: 8.5, letterSpacing: '0.1em', color: 'var(--foreground)' }}>{label}</span>
    </div>
  )
}

// ── Screen 01: Locating GPS ────────────────────────────────────────────────

interface ScreenLocatingProps {
  onLocated?: (coords?: { lat: number; lon: number }) => void
  onDemo?: () => Promise<string>
  riskLevel?: ScreenRisk
}

// phase: 0 = waiting for user tap, 1 = requesting GPS, 2 = done
export function ScreenLocating({ onLocated, onDemo, riskLevel = 'critical' }: ScreenLocatingProps) {
  const [phase, setPhase] = useState(0)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [demoState, setDemoState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const doneRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout)
  }, [])

  const finish = useCallback((coords?: { lat: number; lon: number }) => {
    if (doneRef.current) return
    doneRef.current = true
    setPhase(2)
    const t = setTimeout(() => onLocated?.(coords), 700)
    timersRef.current.push(t)
  }, [onLocated])

  const requestGps = useCallback(() => {
    if (doneRef.current || phase !== 0) return
    setGeoError(null)
    setPhase(1)

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización.')
      setPhase(0)
      return
    }

    // Safety net in case GPS never responds
    const safety = setTimeout(() => finish(), 9000)
    timersRef.current.push(safety)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(safety)
        finish({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      (err) => {
        clearTimeout(safety)
        console.warn('[Sentinel GPS] error', err.code, err.message)
        if (err.code === 1) {
          // PERMISSION_DENIED — let user fix it, don't auto-advance
          setGeoError('Permiso de ubicación bloqueado. Actívalo en los ajustes de tu navegador y vuelve a intentarlo.')
          setPhase(0)
          doneRef.current = false
        } else {
          // POSITION_UNAVAILABLE or TIMEOUT — fall through to mock
          setGeoError('No se pudo obtener tu posición. Continuando con datos de ejemplo.')
          finish()
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    )
  }, [phase, finish])

  const steps = [
    { l: 'PERMISO DE UBICACIÓN',   done: phase >= 1 },
    { l: 'TRIANGULANDO GPS',       done: phase >= 1 },
    { l: 'CALCULANDO RUTA SEGURA', done: phase >= 2 },
  ]

  return (
    <div className="screen scanlines" style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse 90% 60% at 50% 40%, rgba(239,68,68,0.10) 0%, var(--background) 60%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <SentinelStatusStrip riskLevel={riskLevel} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 28 }}>
        {/* Radar */}
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <svg viewBox="-100 -100 200 200" width="200" height="200">
            {[88, 64, 40, 18].map((r, i) => (
              <circle key={r} cx="0" cy="0" r={r} fill="none"
                stroke={i === 3 ? 'var(--critical)' : 'rgba(232,230,224,0.18)'}
                strokeWidth={i === 3 ? 1.2 : 0.7} strokeDasharray={i === 3 ? '0' : '2 4'}
              />
            ))}
            <g style={{ transformOrigin: '0 0', animation: 'radar-sweep 2.4s linear infinite' }}>
              <defs>
                <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="-1">
                  <stop offset="0%" stopColor="rgba(239,68,68,0)" />
                  <stop offset="100%" stopColor="rgba(239,68,68,0.6)" />
                </linearGradient>
              </defs>
              <path d="M 0 0 L -36 -82 A 90 90 0 0 1 36 -82 Z" fill="url(#sweep)" />
            </g>
            <circle cx="0" cy="0" r="6" fill="var(--info)" />
            <circle cx="0" cy="0" r="14" fill="none" stroke="var(--info)" strokeWidth="1" style={{ transformOrigin: '0 0', animation: 'ping 1.8s ease-out infinite' }} />
            <text x="0" y="-92" textAnchor="middle" style={{ font: '600 8px monospace' } as React.CSSProperties} fill="rgba(232,230,224,0.6)">N</text>
          </svg>
        </div>

        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--critical)', marginBottom: 12, textTransform: 'uppercase' }}>
            SENTINEL · ALERTA RECIBIDA
          </div>
          <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15, marginBottom: 14 }}>
            {phase === 0 ? 'Comparte tu ubicación' : 'Obteniendo tu ubicación'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.45 }}>
            Necesitamos saber dónde estás para calcular tu ruta de escape más segura.
          </div>
        </div>

        {phase === 0 ? (
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {geoError && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)',
                fontSize: 12, color: 'var(--critical)', lineHeight: 1.45, textAlign: 'center',
              }}>
                {geoError}
              </div>
            )}
            <button
              onClick={requestGps}
              style={{
                width: '100%', minHeight: 66, borderRadius: 14, border: 'none',
                background: 'var(--foreground)', color: '#0a0a0a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 12, cursor: 'pointer', fontSize: 17, fontWeight: 700,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="4" fill="#0a0a0a" />
                <circle cx="11" cy="11" r="8" stroke="#0a0a0a" strokeWidth="1.6" />
                <line x1="11" y1="1" x2="11" y2="4" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="11" y1="18" x2="11" y2="21" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="1" y1="11" x2="4" y2="11" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="18" y1="11" x2="21" y2="11" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {geoError?.includes('bloqueado') ? 'Reintentar' : 'Activar ubicación GPS'}
            </button>
            <button
              onClick={() => finish()}
              style={{
                width: '100%', minHeight: 44, borderRadius: 14,
                background: 'transparent', color: 'var(--text-dim)',
                border: '1px solid rgba(255,255,255,0.12)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Continuar sin ubicación
            </button>
            <button
              onClick={async () => {
                if (demoState !== 'idle' || !onDemo) return
                setDemoState('sending')
                const result = await onDemo()
                if (result === 'no_phone') {
                  setGeoError('Inicia sesión con un número registrado para recibir el SMS de demo.')
                  setDemoState('idle')
                  return
                }
                setDemoState('sent')
              }}
              style={{
                width: '100%', minHeight: 44, borderRadius: 14,
                background: demoState === 'sent' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                color: demoState === 'sent' ? 'var(--safe)' : 'var(--critical)',
                border: `1px solid ${demoState === 'sent' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.30)'}`,
                fontSize: 12, fontWeight: 600, cursor: demoState !== 'idle' ? 'default' : 'pointer',
                letterSpacing: '0.08em', fontFamily: 'monospace',
              }}
            >
              {demoState === 'idle' ? '⚡ DEMO — Simular foco cercano + SMS' : demoState === 'sending' ? 'Enviando alerta...' : '✓ SMS enviado — cargando pantalla'}
            </button>
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {steps.map((s, i) => (
              <div key={i} className="font-mono" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: s.done ? 'var(--foreground)' : 'var(--text-muted)',
                opacity: phase >= i ? 1 : 0.4,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: s.done ? 'var(--safe)' : 'var(--text-muted)',
                  animation: !s.done && phase === 1 && i === 1 ? 'pulse-strong 0.9s ease-in-out infinite' : 'none',
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{s.l}</span>
                <span style={{ color: s.done ? 'var(--safe)' : 'var(--text-muted)' }}>{s.done ? 'OK' : '···'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Screen 02: Alert + Escape Route ───────────────────────────────────────

function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'N-E', 'E', 'S-E', 'S', 'S-O', 'O', 'N-O']
  return dirs[Math.round(deg / 45) % 8]
}

interface ScreenAlertProps {
  riskLevel?: ScreenRisk
  route: NaturalRoute
  user: { lat: number; lon: number; accuracy_m: number; heading_deg: number }
  fires: { id: string; lat: number; lon: number; frp: number; dist_km: number }[]
  expansion: { direccion_principal_deg: number; velocidad_propagacion_kmh: number }
  weather: { wind_speed_kmh: number; wind_dir_deg: number; humidity_pct: number; temp_c: number }
  onCompass?: () => void
  onTrapped?: () => void
}

function formatCoords(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'O'
  const aLat = Math.abs(lat)
  const aLon = Math.abs(lon)
  const deg = Math.floor(aLat)
  const min = Math.floor((aLat % 1) * 60)
  const sec = Math.floor(((aLat % 1) * 60 % 1) * 60)
  const ldeg = Math.floor(aLon)
  const lmin = Math.floor((aLon % 1) * 60)
  const lsec = Math.floor(((aLon % 1) * 60 % 1) * 60)
  return `${deg}°${min}'${sec}"${latDir} · ${ldeg}°${lmin}'${lsec}"${lonDir}`
}

export function ScreenAlert({ riskLevel = 'critical', route, user, fires, expansion, onCompass, onTrapped }: ScreenAlertProps) {
  return (
    <div className="screen scanlines" style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', position: 'relative',
      background: 'var(--background)',
    }}>
      <SentinelStatusStrip riskLevel={riskLevel} />
      <div style={{ height: 86 }} />
      <AlertBanner riskLevel={riskLevel} />

      {/* Map */}
      <div style={{
        position: 'relative', margin: '12px 14px 0',
        borderRadius: 14, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <SentinelMap size={374} user={user} fires={fires} route={route} expansion={expansion} />
        <div className="font-mono" style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.12em',
          background: 'rgba(10,10,10,0.55)', padding: '3px 7px', borderRadius: 4,
        }}>
          {formatCoords(user.lat, user.lon)}
        </div>
        <div style={{
          position: 'absolute', bottom: 8, right: 10,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'rgba(10,10,10,0.7)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, padding: '6px 8px',
        }}>
          <LegendDot color="var(--info)"     label="TÚ" />
          <LegendDot color="var(--critical)" label="FOCO" />
          <LegendDot color="var(--safe)"     label="ESCAPE" />
        </div>
      </div>

      {/* Route card */}
      <div style={{
        margin: '14px 14px 0', padding: '14px 16px 16px', borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.03) 100%)',
        border: '1px solid rgba(34,197,94,0.3)',
      }}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--safe)', fontWeight: 600, textTransform: 'uppercase' }}>
          ESCAPA HACIA
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          {route.label}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline', marginTop: 8, flexWrap: 'wrap' }}>
          <span className="font-mono" style={{ fontSize: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 18 }}>{route.distancia_km.toFixed(1)}</span>
            <span style={{ color: 'var(--text-dim)', marginLeft: 2 }}>km</span>
          </span>
          <span className="font-mono" style={{ fontSize: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 18 }}>{route.eta_min}</span>
            <span style={{ color: 'var(--text-dim)', marginLeft: 2 }}>min</span>
          </span>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
            RUMBO {String(Math.round(route.bearing_deg)).padStart(3, '0')}° · {degreesToCardinal(route.bearing_deg)}
          </span>
        </div>
        <div className="font-mono" style={{ 
          marginTop: 10, fontSize: 10.5, letterSpacing: '0.08em', 
          color: route.estado === 'LIBRE' ? 'var(--safe)' : 'var(--critical)', 
          display: 'flex', alignItems: 'center', gap: 6 
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: route.estado === 'LIBRE' ? 'var(--safe)' : 'var(--critical)' }} />
          {route.estado === 'LIBRE' ? 'RUTA LIBRE' : 'RUTA BLOQUEADA'} · {
            Math.abs((route.bearing_deg - weather.wind_dir_deg + 360) % 360 - 180) < 45 
              ? 'A FAVOR DEL VIENTO' 
              : 'CONTRA EL VIENTO'
          }
        </div>
      </div>

      {/* Buttons */}
      <div style={{ marginTop: 'auto', padding: '14px 14px 36px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onCompass}
          style={{
            width: '100%', minHeight: 66, borderRadius: 14, border: 'none',
            background: 'var(--foreground)', color: '#0a0a0a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, cursor: 'pointer',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="10.5" stroke="#0a0a0a" strokeWidth="1.6" />
            <path d="M 13 5 L 16 13 L 13 11 L 10 13 Z" fill="#0a0a0a" />
            <path d="M 13 21 L 16 13 L 13 15 L 10 13 Z" fill="#0a0a0a" opacity="0.35" />
          </svg>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Iniciar brújula</div>
            <div className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.1em', opacity: 0.6, textTransform: 'uppercase' }}>GUÍA PASO A PASO</div>
          </div>
        </button>

        <button
          onClick={onTrapped}
          style={{
            width: '100%', minHeight: 52, borderRadius: 14,
            background: 'transparent', color: 'var(--critical)',
            border: '1px solid rgba(239,68,68,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M 8 1.5 L 14.5 13 L 1.5 13 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M 8 6 L 8 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.9" fill="currentColor" />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em' }}>ESTOY ATRAPADO · NO PUEDO ESCAPAR</span>
        </button>
      </div>
    </div>
  )
}

// ── Screen 04a: Trapped Confirm ────────────────────────────────────────────

interface ScreenTrappedConfirmProps {
  onCancel?: () => void
  onConfirm?: () => void
}

export function ScreenTrappedConfirm({ onCancel, onConfirm }: ScreenTrappedConfirmProps) {
  const [holdProgress, setHoldProgress] = useState(0)
  const holdingRef = useRef(false)
  const firedRef = useRef(false)

  useEffect(() => {
    let raf: number
    const tick = () => {
      // Pure updater — no side effects (firing onConfirm here would setState
      // on the parent during render).
      setHoldProgress(p =>
        holdingRef.current
          ? Math.min(1, p + 1 / 60)
          : Math.max(0, p - 1 / 30),
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Fire the confirm callback exactly once, after the hold completes.
  useEffect(() => {
    if (holdProgress >= 1 && !firedRef.current) {
      firedRef.current = true
      onConfirm?.()
    }
  }, [holdProgress, onConfirm])

  return (
    <div className="screen scanlines" style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(239,68,68,0.16) 0%, var(--background) 65%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <SentinelStatusStrip riskLevel="critical" />
      <div style={{ height: 86 }} />

      <button onClick={onCancel} style={{
        position: 'absolute', top: 96, right: 14, zIndex: 50,
        width: 36, height: 36, borderRadius: 999,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
        color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M 2 2 L 12 12 M 12 2 L 2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>

      <div style={{ padding: '8px 22px 0' }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--critical)', fontWeight: 600, textTransform: 'uppercase' }}>
          SOS · ÚLTIMO RECURSO
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.05, marginTop: 10, letterSpacing: '-0.02em' }}>
          ¿No puedes<br/>escapar?
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 12 }}>
          Esto enviará tu ubicación en tiempo real a CONAF y Bomberos. Sólo úsalo si{' '}
          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>físicamente no puedes</span> seguir la ruta de escape.
        </div>
      </div>

      <div style={{ margin: '20px 22px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { t: 'Tu ubicación GPS',       s: 'Actualizada cada 5s' },
          { t: 'Tu nivel de batería',    s: 'Para priorizar el rescate' },
          { t: 'Estado de la conexión',  s: 'Aviso si pierdes señal' },
        ].map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11"><path d="M 2 5.5 L 4.5 8 L 9 3" stroke="var(--critical)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{it.t}</div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.05em', marginTop: 1, textTransform: 'uppercase' }}>{it.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '14px 22px 36px' }}>
        <button
          onMouseDown={() => { holdingRef.current = true }}
          onMouseUp={() => { holdingRef.current = false }}
          onMouseLeave={() => { holdingRef.current = false }}
          onTouchStart={(e) => { e.preventDefault(); holdingRef.current = true }}
          onTouchEnd={() => { holdingRef.current = false }}
          style={{
            width: '100%', minHeight: 76, borderRadius: 16,
            background: `linear-gradient(90deg, var(--critical) ${holdProgress * 100}%, transparent ${holdProgress * 100}%)`,
            color: '#fff', border: '1.5px solid var(--critical)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            userSelect: 'none', WebkitTouchCallout: 'none' as any,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>
            {holdProgress >= 0.95 ? 'ENVIANDO…' : 'MANTENER PARA ENVIAR SOS'}
          </span>
          <span className="font-mono" style={{ fontSize: 10.5, letterSpacing: '0.14em', opacity: 0.85, textTransform: 'uppercase' }}>
            MANTÉN PULSADO 1 SEGUNDO
          </span>
        </button>
        <button onClick={onCancel} style={{
          width: '100%', marginTop: 8, minHeight: 44,
          background: 'transparent', color: 'var(--text-dim)',
          border: 'none', fontSize: 14, fontWeight: 500, cursor: 'pointer',
        }}>
          Volver a la ruta de escape
        </button>
      </div>
    </div>
  )
}

// ── Screen Safe: No Nearby Fire ───────────────────────────────────────────

interface ScreenSafeProps {
  nearestKm: number | null
  weather: { wind_speed_kmh: number; wind_dir_deg: number; humidity_pct: number; temp_c: number }
  onRefresh?: () => void
  onDemo?: () => Promise<string>
}

export function ScreenSafe({ nearestKm, weather, onRefresh, onDemo }: ScreenSafeProps) {
  const [demoState, setDemoState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  return (
    <div className="screen scanlines" style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse 90% 60% at 50% 40%, rgba(34,197,94,0.08) 0%, var(--background) 65%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <SentinelStatusStrip riskLevel="low" />
      <div style={{ height: 86 }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 28 }}>
        {/* Shield icon */}
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <path d="M 40 8 L 68 18 L 68 42 C 68 58 55 70 40 74 C 25 70 12 58 12 42 L 12 18 Z"
            fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.6)" strokeWidth="2" />
          <path d="M 26 40 L 36 50 L 54 32" stroke="var(--safe)" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>

        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--safe)', marginBottom: 10, textTransform: 'uppercase' }}>
            ÁREA MONITOREADA
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, marginBottom: 12 }}>
            Sin amenaza activa
          </div>
          {nearestKm !== null && isFinite(nearestKm) && (
            <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.45 }}>
              El foco más cercano está a{' '}
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                {nearestKm.toFixed(1)} km
              </span>{' '}
              de tu posición.
            </div>
          )}
        </div>

        {/* Weather strip */}
        <div style={{
          width: '100%', maxWidth: 320, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          {[
            { label: 'VIENTO',    value: `${weather.wind_speed_kmh} km/h` },
            { label: 'HUMEDAD',   value: `${weather.humidity_pct}%` },
            { label: 'TEMP',      value: `${weather.temp_c}°C` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '8px 10px', textAlign: 'center',
            }}>
              <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</div>
              <div className="font-mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '14px 22px 36px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="font-mono" style={{
          fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em',
          textAlign: 'center', marginBottom: 4, textTransform: 'uppercase',
        }}>
          SENTINEL MONITOREA EN TIEMPO REAL
        </div>
        <button
          onClick={onRefresh}
          style={{
            width: '100%', minHeight: 56, borderRadius: 14,
            background: 'transparent', color: 'var(--foreground)',
            border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 15, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M 2 8 A 6 6 0 1 1 8 14 M 8 14 L 5 11 M 8 14 L 11 11"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          Actualizar mi ubicación
        </button>
        {onDemo && (
          <button
            onClick={async () => {
              if (demoState !== 'idle') return
              setDemoState('sending')
              const result = await onDemo()
              if (result === 'no_phone') {
                setDemoState('error')
                setTimeout(() => setDemoState('idle'), 3000)
              } else {
                setDemoState('sent')
              }
            }}
            style={{
              width: '100%', minHeight: 48, borderRadius: 14,
              background: demoState === 'sent' ? 'rgba(34,197,94,0.10)' : demoState === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.08)',
              color: demoState === 'sent' ? 'var(--safe)' : demoState === 'error' ? 'var(--critical)' : 'var(--critical)',
              border: `1px solid ${demoState === 'sent' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.30)'}`,
              fontSize: 12, fontWeight: 600, cursor: demoState !== 'idle' ? 'default' : 'pointer',
              letterSpacing: '0.08em', fontFamily: 'monospace',
            }}
          >
            {demoState === 'idle' && '⚡ DEMO — Simular foco cercano + SMS'}
            {demoState === 'sending' && 'Enviando alerta...'}
            {demoState === 'sent' && '✓ SMS enviado — mostrando alerta'}
            {demoState === 'error' && 'Inicia sesión con número registrado'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Screen 04b: Trapped Live ───────────────────────────────────────────────

type ResponderState = 'dispatched' | 'enroute' | 'ack'
interface ResponderRowProps { label: string; meta: string; state: ResponderState }

function ResponderRow({ label, meta, state }: ResponderRowProps) {
  const palette = {
    dispatched: { fg: 'var(--warning)', dot: 'var(--warning)' },
    enroute:    { fg: 'var(--safe)',    dot: 'var(--safe)' },
    ack:        { fg: 'var(--info)',    dot: 'var(--info)' },
  }[state]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 12px', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 10,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999, background: palette.dot,
        boxShadow: `0 0 6px ${palette.dot}`,
        animation: state === 'enroute' ? 'pulse-strong 1.2s ease-in-out infinite' : 'none', flexShrink: 0,
      }} />
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{label}</span>
      <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: palette.fg, fontWeight: 600 }}>{meta}</span>
    </div>
  )
}

interface ScreenTrappedLiveProps {
  onRecall?: () => void
  user: { lat: number; lon: number }
}

export function ScreenTrappedLive({ onRecall, user }: ScreenTrappedLiveProps) {
  const [elapsed, setElapsed] = useState(8)
  const [coords, setCoords] = useState({ lat: user.lat, lon: user.lon })

  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(e => e + 5)
      setCoords(c => ({
        lat: c.lat + (Math.random() - 0.5) * 0.00002,
        lon: c.lon + (Math.random() - 0.5) * 0.00002,
      }))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="screen scanlines" style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse 90% 70% at 50% 30%, rgba(239,68,68,0.16) 0%, var(--background) 70%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <SentinelStatusStrip riskLevel="critical" />
      <div style={{ height: 86 }} />

      <div style={{ padding: '6px 22px 0', textAlign: 'left' }}>
        <div className="font-mono" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--critical)', fontWeight: 600, textTransform: 'uppercase',
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)',
          padding: '5px 10px', borderRadius: 999,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--critical)', animation: 'pulse-strong 0.9s ease-in-out infinite' }} />
          SOS ACTIVO · EN VIVO
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1, marginTop: 12, letterSpacing: '-0.02em' }}>
          Las autoridades te están viendo.
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.45, marginTop: 8 }}>
          Quédate donde estás si es seguro. Si puedes moverte a un lugar despejado (sin vegetación), hazlo.
        </div>
      </div>

      {/* Live ping */}
      <div style={{
        margin: '20px 22px 0', background: 'var(--surface)',
        border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '16px 16px 14px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
          <svg viewBox="-28 -28 56 56" width="56" height="56">
            <circle r="24" fill="none" stroke="var(--critical)" strokeOpacity="0.4" strokeWidth="1" style={{ animation: 'ping 1.6s ease-out infinite' }} />
            <circle r="20" fill="none" stroke="var(--critical)" strokeOpacity="0.5" strokeWidth="1" style={{ animation: 'ping 1.6s ease-out infinite 0.4s' } as React.CSSProperties} />
            <circle r="9" fill="var(--critical)" />
            <circle r="3.5" fill="#fff" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>COMPARTIENDO UBICACIÓN</div>
          <div className="font-mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
            {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
          </div>
          <div className="font-mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ±12 M · ACTUALIZADO AHORA <span style={{ color: 'var(--critical)', animation: 'blink 1s steps(2) infinite', marginLeft: 4 }}>●</span>
          </div>
        </div>
      </div>

      {/* Responders */}
      <div style={{ margin: '12px 22px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ResponderRow label="Unidad de Emergencia Local"  meta="ETA 12 min" state="dispatched" />
        <ResponderRow label="Cuerpo de Bomberos" meta="EN CAMINO"   state="enroute" />
        <ResponderRow label="Policía Local"  meta="NOTIFICADOS" state="ack" />
      </div>

      {/* Stats */}
      <div style={{ margin: '14px 22px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { label: 'SEÑAL',   value: '2/5',     tone: 'warn' },
          { label: 'BATERÍA', value: '38%',      tone: 'warn' },
          { label: 'TIEMPO',  value: `${mm}:${ss}`, tone: 'fg' },
        ].map(({ label, value, tone }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
            <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</div>
            <div className="font-mono" style={{
              fontSize: 16, fontWeight: 600, marginTop: 2, lineHeight: 1,
              color: tone === 'warn' ? 'var(--warning)' : 'var(--foreground)',
            }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '14px 22px 36px' }}>
        <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase' }}>
          NO CUELGUES · MANTÉN LA APP ABIERTA
        </div>
        <button onClick={onRecall} style={{
          width: '100%', minHeight: 56, borderRadius: 14,
          background: 'transparent', color: 'var(--foreground)',
          border: '1px solid rgba(255,255,255,0.15)',
          fontSize: 15, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M 8 14 A 6 6 0 1 1 8 2 L 11 2 M 8 2 L 8 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          Ya puedo moverme — volver a la ruta
        </button>
      </div>
    </div>
  )
}
