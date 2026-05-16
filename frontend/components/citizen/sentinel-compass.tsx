"use client"

import React, { useState, useEffect } from 'react'
import type { NaturalRoute } from '@/lib/citizen-mock-data'

interface TelemProps { label: string; value: string; unit: string; tone?: string }

function Telem({ label, value, unit, tone = 'fg' }: TelemProps) {
  const color = tone === 'safe' ? 'var(--safe)' : tone === 'critical' ? 'var(--critical)' : 'var(--foreground)'
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
      <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <div className="font-mono" style={{ fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
        <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{unit}</div>
      </div>
    </div>
  )
}

interface SentinelCompassProps {
  onClose: () => void
  route: NaturalRoute
  userHeading: number
}

export function SentinelCompass({ onClose, route, userHeading }: SentinelCompassProps) {
  const [heading, setHeading] = useState(userHeading ?? 84)

  useEffect(() => {
    let frame: number
    let last = performance.now()
    const tick = (t: number) => {
      const dt = t - last; last = t
      setHeading(h => {
        const target = (route.bearing_deg - 22 + 360) % 360
        const diff = ((target - h + 540) % 360) - 180
        return (h + diff * Math.min(1, dt / 1400) * 0.06 + 360) % 360
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [route.bearing_deg])

  const dialRotation = -heading
  const arrowAngle = (route.bearing_deg - heading + 540) % 360 - 180
  const aligned = Math.abs(arrowAngle) < 8

  const ticks: React.ReactElement[] = []
  for (let i = 0; i < 360; i += 3) {
    const major = i % 30 === 0
    const big   = i % 90 === 0
    const len   = big ? 14 : major ? 10 : 4
    const w     = big ? 1.6 : major ? 1 : 0.7
    const op    = big ? 1 : major ? 0.7 : 0.32
    ticks.push(
      <line key={i} x1="0" y1="-148" x2="0" y2={-148 + len}
        stroke="#e8e6e0" strokeWidth={w} opacity={op}
        transform={`rotate(${i})`}
      />
    )
  }

  const cardinals = [
    { l: 'N', a: 0,   c: '#ef4444' },
    { l: 'E', a: 90,  c: '#e8e6e0' },
    { l: 'S', a: 180, c: '#e8e6e0' },
    { l: 'O', a: 270, c: '#e8e6e0' },
  ]

  return (
    <div data-screen-label="03 Compass" className="screen scanlines" style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse 80% 60% at 50% 35%, #141414 0%, #0a0a0a 60%)',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Top */}
      <div style={{ padding: '68px 20px 14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <button onClick={onClose} aria-label="Cerrar brújula" style={{
          width: 44, height: 44, borderRadius: 999,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
          color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11.5 3.5 L 6 9 L 11.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>MODO BRÚJULA · GUÍA PASO A PASO</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>Hacia <span style={{ color: 'var(--safe)' }}>Cerro Chepe</span></div>
        </div>
        <div className="font-mono" style={{ textAlign: 'right', minWidth: 44, fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>
          GPS<br /><span style={{ color: 'var(--safe)' }}>OK</span>
        </div>
      </div>

      {/* Compass dial */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>RUMBO DE ESCAPE</div>
          <div className="font-mono" style={{
            fontSize: 56, fontWeight: 600, lineHeight: 1,
            color: aligned ? 'var(--safe)' : 'var(--foreground)',
            marginTop: 6, transition: 'color 200ms',
          }}>{String(Math.round(route.bearing_deg)).padStart(3, '0')}°</div>
          <div className="font-mono" style={{ fontSize: 10, marginTop: 4, letterSpacing: '0.12em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            <span style={{ color: aligned ? 'var(--safe)' : 'var(--warning)' }}>
              {aligned ? 'ALINEADO · CAMINA ADELANTE' : `GIRA ${arrowAngle > 0 ? '→' : '←'} ${Math.round(Math.abs(arrowAngle))}°`}
            </span>
          </div>
        </div>

        <svg viewBox="-180 -180 360 360" width="320" height="320" style={{ overflow: 'visible' }}>
          <circle cx="0" cy="0" r="158" fill="none" stroke="rgba(232,230,224,0.08)" strokeWidth="1" />
          <circle cx="0" cy="0" r="148" fill="none" stroke="rgba(232,230,224,0.15)" strokeWidth="0.6" />
          <circle cx="0" cy="0" r="120" fill="none" stroke="rgba(232,230,224,0.06)" strokeWidth="0.5" strokeDasharray="2 4" />

          <g style={{ transform: `rotate(${dialRotation}deg)`, transformOrigin: '0 0', transition: 'transform 60ms linear' }}>
            {ticks}
            {cardinals.map(c => (
              <g key={c.l} transform={`rotate(${c.a}) translate(0,-118)`}>
                <g transform={`rotate(${-c.a - dialRotation})`}>
                  <text textAnchor="middle" dominantBaseline="middle"
                    style={{ font: `600 ${c.l === 'N' ? 22 : 18}px sans-serif` } as React.CSSProperties}
                    fill={c.c}>{c.l}</text>
                </g>
              </g>
            ))}
            <g transform="translate(0,-148)">
              <polygon points="0,-12 5,0 -5,0" fill="#ef4444" />
            </g>
          </g>

          <g style={{ transform: `rotate(${arrowAngle}deg)`, transformOrigin: '0 0', transition: 'transform 80ms linear' }}>
            <path d="M 0 -130 L 24 -20 L 0 -42 L -24 -20 Z"
              fill={aligned ? 'var(--safe)' : 'var(--warning)'}
              opacity="0.25"
              style={{ filter: 'blur(8px)' }} />
            <path d="M 0 -130 L 20 -24 L 0 -40 L -20 -24 Z"
              fill={aligned ? 'var(--safe)' : 'var(--warning)'} />
            <line x1="0" y1="-40" x2="0" y2="42"
              stroke={aligned ? 'var(--safe)' : 'var(--warning)'}
              strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          </g>

          <circle cx="0" cy="0" r="9" fill="#0a0a0a" stroke="#e8e6e0" strokeWidth="1.4" />
          <circle cx="0" cy="0" r="3" fill="#e8e6e0" />
          <polygon points="0,-162 6,-152 -6,-152" fill="#e8e6e0" />
        </svg>
      </div>

      {/* Step instruction */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{
          background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.28)',
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M 11 2 L 11 18 M 11 2 L 5 8 M 11 2 L 17 8" stroke="var(--safe)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>PASO 1 DE 3</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
              {route.instrucciones?.[0] ?? 'Sube por Av. Pedro de Valdivia'}
            </div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>320 M · 4 MIN</div>
          </div>
        </div>
      </div>

      {/* Telemetry */}
      <div style={{ padding: '0 20px 36px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Telem label="DISTANCIA" value={route.distancia_km.toFixed(1)} unit="km"  tone="safe" />
        <Telem label="ETA"       value={String(route.eta_min)}          unit="min" tone="safe" />
        <Telem label="FUEGO TRAS" value="18"                             unit="min" tone="critical" />
      </div>
    </div>
  )
}
