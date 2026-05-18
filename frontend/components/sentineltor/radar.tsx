'use client'

import { useEffect } from 'react'
import { GeoCoords } from '@/hooks/use-geolocation'

function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('__sentinel_radar_styles')) return
  const css = `
    @keyframes sentinel-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes sentinel-pulse-ring {
      0%   { r: 6;  opacity: 0.9; }
      80%  { r: 38; opacity: 0;   }
      100% { r: 38; opacity: 0;   }
    }
    @keyframes sentinel-pulse-ring-soft {
      0%   { r: 14; opacity: 0.55; }
      100% { r: 60; opacity: 0; }
    }
    @keyframes sentinel-rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes sentinel-rotate-rev  { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
    @keyframes sentinel-dash-flow { to { stroke-dashoffset: -40; } }
    @keyframes sentinel-cone-pulse {
      0%, 100% { opacity: 0.55; }
      50%      { opacity: 0.85; }
    }
    @keyframes sentinel-flicker {
      0%, 100% { opacity: 0.9; }
      45%      { opacity: 0.55; }
      55%      { opacity: 1; }
    }
    .sentinel-radar-sweep-origin { transform-origin: 200px 220px; }
    .sentinel-rotor-origin       { transform-origin: 268px 110px; }
    .sentinel-anim-sweep         { animation: sentinel-sweep 5.5s linear infinite; }
    .sentinel-anim-rotor         { animation: sentinel-rotate-slow 3s linear infinite; }
    .sentinel-anim-rotor-rev     { animation: sentinel-rotate-rev 4.2s linear infinite; }
    .sentinel-anim-dash          { animation: sentinel-dash-flow 1.4s linear infinite; }
    .sentinel-anim-cone          { animation: sentinel-cone-pulse 2.4s ease-in-out infinite; }
    .sentinel-anim-flicker       { animation: sentinel-flicker 2.8s ease-in-out infinite; }
    .sentinel-anim-pulse         { animation: sentinel-pulse-ring 2.2s ease-out infinite; }
    .sentinel-anim-pulse-soft    { animation: sentinel-pulse-ring-soft 2.6s ease-out infinite; animation-delay: 0.4s; }
  `
  const s = document.createElement('style')
  s.id = '__sentinel_radar_styles'
  s.textContent = css
  document.head.appendChild(s)
}

interface RadarProps {
  variant?: 'alert' | 'locating' | 'in-shelter' | 'help'
  height?: number
  coords?: GeoCoords
}

export function Radar({ variant = 'alert', height = 320, coords }: RadarProps) {
  useEffect(() => { injectStyles() }, [])

  const quiet = variant === 'locating'
  const dim   = variant === 'in-shelter'
  const help  = variant === 'help'

  const grid = []
  for (let i = 0; i < 8; i++) {
    grid.push(<line key={'h'+i} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="rgba(120,180,255,0.06)" strokeWidth="1"/>)
    grid.push(<line key={'v'+i} x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="rgba(120,180,255,0.06)" strokeWidth="1"/>)
  }

  const rings = [50, 100, 150].map(r => (
    <circle key={r} cx="200" cy="220" r={r} fill="none" stroke="rgba(120,180,255,0.12)" strokeWidth="1"/>
  ))

  const cityDots = [
    { x: 60, y: 90 }, { x: 340, y: 70 }, { x: 320, y: 320 }, { x: 90, y: 360 }, { x: 240, y: 380 },
  ]

  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', height, display: 'block', borderRadius: 18 }}>
      <defs>
        <radialGradient id="sentinel-radar-bg" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#071420"/><stop offset="55%" stopColor="#040a13"/><stop offset="100%" stopColor="#02060c"/>
        </radialGradient>
        <radialGradient id="sentinel-risk-extreme" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b347ff" stopOpacity="0.55"/><stop offset="40%" stopColor="#ff3838" stopOpacity="0.35"/>
          <stop offset="75%" stopColor="#ff7a3d" stopOpacity="0.18"/><stop offset="100%" stopColor="#ff7a3d" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sentinel-risk-mod" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd166" stopOpacity="0.30"/><stop offset="60%" stopColor="#ffd166" stopOpacity="0.10"/><stop offset="100%" stopColor="#ffd166" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sentinel-risk-low" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3affc6" stopOpacity="0.25"/><stop offset="100%" stopColor="#3affc6" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="sentinel-sweep" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5cdaff" stopOpacity="0.0"/><stop offset="85%" stopColor="#5cdaff" stopOpacity="0.0"/><stop offset="100%" stopColor="#5cdaff" stopOpacity="0.45"/>
        </radialGradient>
        <radialGradient id="sentinel-user" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5cdaff" stopOpacity="1"/><stop offset="100%" stopColor="#5cdaff" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="sentinel-cone" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff3838" stopOpacity="0.5"/><stop offset="100%" stopColor="#ff7a3d" stopOpacity="0.05"/>
        </linearGradient>
        <mask id="sentinel-sweep-mask">
          <rect width="400" height="400" fill="#000"/>
          <path d="M200,220 L200,70 A150,150 0 0 1 340,260 Z" fill="#fff"/>
        </mask>
      </defs>
      <rect width="400" height="400" fill="url(#sentinel-radar-bg)"/>
      <g opacity={quiet ? 0.25 : 0.5}>
        <path d="M -20 180 Q 100 160 160 200 T 320 180 T 420 220" fill="none" stroke="rgba(120,180,255,0.10)" strokeWidth="1"/>
        <path d="M -20 270 Q 80 250 180 290 T 360 260 T 420 300" fill="none" stroke="rgba(120,180,255,0.08)" strokeWidth="1"/>
        <path d="M 60 -20 Q 90 90 50 180 T 80 380" fill="none" stroke="rgba(120,180,255,0.06)" strokeWidth="1"/>
        <path d="M 290 -20 Q 320 100 300 200 T 330 420" fill="none" stroke="rgba(120,180,255,0.08)" strokeWidth="1"/>
      </g>
      {grid}{rings}
      <g fill="rgba(150,200,255,0.35)" style={{ font: '600 9px ui-monospace, "JetBrains Mono", monospace', letterSpacing: 0.8 }}>
        <text x="204" y="125">2KM</text><text x="204" y="75">5KM</text><text x="204" y="25">10KM</text>
      </g>
      {cityDots.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="1.6" fill="rgba(150,200,255,0.45)"/>
          <circle cx={c.x} cy={c.y} r="4" fill="rgba(150,200,255,0.08)"/>
        </g>
      ))}
      {!quiet && (
        <g opacity={dim ? 0.6 : 1}>
          <circle cx="200" cy="220" r="110" fill="url(#sentinel-risk-low)"/>
          <circle cx="240" cy="170" r="95" fill="url(#sentinel-risk-mod)"/>
          <circle cx="268" cy="110" r="80" fill="url(#sentinel-risk-extreme)"/>
        </g>
      )}
      {!quiet && (
        <g className="sentinel-anim-cone">
          <path d="M 268 110 L 220 230 L 180 230 Z" fill="url(#sentinel-cone)" stroke="#ff5252" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 4"/>
          <line x1="268" y1="110" x2="200" y2="225" stroke="#ff7a3d" strokeOpacity="0.85" strokeWidth="1.4" strokeDasharray="6 4" className="sentinel-anim-dash"/>
          <polygon points="200,225 195,212 208,217" fill="#ff7a3d" opacity="0.9"/>
        </g>
      )}
      {!quiet && (
        <g className="sentinel-rotor-origin">
          <g className="sentinel-anim-rotor sentinel-rotor-origin">
            <path d="M 268 70 A 40 40 0 0 1 308 110" fill="none" stroke="#b347ff" strokeWidth="1.5" strokeOpacity="0.75" strokeLinecap="round"/>
            <path d="M 268 150 A 40 40 0 0 1 228 110" fill="none" stroke="#b347ff" strokeWidth="1.5" strokeOpacity="0.75" strokeLinecap="round"/>
          </g>
          <g className="sentinel-anim-rotor-rev sentinel-rotor-origin">
            <path d="M 268 85 A 25 25 0 0 1 293 110" fill="none" stroke="#ff5edd" strokeWidth="1.3" strokeOpacity="0.8" strokeLinecap="round"/>
            <path d="M 268 135 A 25 25 0 0 1 243 110" fill="none" stroke="#ff5edd" strokeWidth="1.3" strokeOpacity="0.8" strokeLinecap="round"/>
          </g>
          <circle cx="268" cy="110" r="6" fill="#b347ff" className="sentinel-anim-flicker"/>
          <circle cx="268" cy="110" r="3" fill="#fff"/>
          <circle cx="268" cy="110" r="14" fill="none" stroke="#b347ff" strokeOpacity="0.55" strokeWidth="1"/>
          <circle cx="268" cy="110" className="sentinel-anim-pulse-soft" fill="none" stroke="#b347ff" strokeWidth="1.2" strokeOpacity="0.6"/>
        </g>
      )}
      {!quiet && (
        <g opacity="0.55">
          <path d="M 100 80 Q 130 100 110 130" fill="none" stroke="#5cdaff" strokeOpacity="0.4" strokeWidth="1.2" strokeDasharray="4 3" className="sentinel-anim-dash"/>
          <path d="M 340 200 Q 320 230 350 260" fill="none" stroke="#5cdaff" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="4 3" className="sentinel-anim-dash"/>
          <path d="M 50 280 Q 80 300 60 330" fill="none" stroke="#5cdaff" strokeOpacity="0.3" strokeWidth="1.2" strokeDasharray="4 3" className="sentinel-anim-dash"/>
        </g>
      )}
      <g className="sentinel-radar-sweep-origin sentinel-anim-sweep">
        <rect x="0" y="0" width="400" height="400" fill="url(#sentinel-sweep)" mask="url(#sentinel-sweep-mask)" opacity={quiet ? 0.7 : 0.9}/>
      </g>
      <g>
        <circle cx="200" cy="220" className="sentinel-anim-pulse" fill="none" stroke="#5cdaff" strokeWidth="1.5" strokeOpacity="0.8"/>
        <circle cx="200" cy="220" r="22" fill="url(#sentinel-user)" opacity="0.6"/>
        <circle cx="200" cy="220" r="6" fill="#5cdaff"/>
        <circle cx="200" cy="220" r="3" fill="#fff"/>
        <g transform="translate(212, 232)">
          <rect x="0" y="0" width="34" height="14" rx="3" fill="rgba(7,15,26,0.85)" stroke="rgba(92,218,255,0.6)" strokeWidth="0.8"/>
          <text x="17" y="10" textAnchor="middle" style={{ font: '700 8px ui-monospace, monospace', letterSpacing: 0.8 }} fill="#5cdaff">YO</text>
        </g>
      </g>
      {help && (
        <g>
          <circle cx="200" cy="220" r="34" fill="none" stroke="#ff7a3d" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.85" className="sentinel-anim-rotor sentinel-radar-sweep-origin"/>
          <circle cx="200" cy="220" r="50" fill="none" stroke="#ff7a3d" strokeWidth="1" strokeOpacity="0.45"/>
        </g>
      )}
      <g style={{ font: '600 9px ui-monospace, "JetBrains Mono", monospace', letterSpacing: 1 }}>
        <text x="14" y="22" fill="rgba(150,200,255,0.55)">SCAN · 2.4GHz</text>
        <text x="14" y="36" fill="rgba(150,200,255,0.35)">LAT  {(coords?.lat ?? 19.4326).toFixed(4)}° {(coords?.lat ?? 19.4326) >= 0 ? 'N' : 'S'}</text>
        <text x="14" y="48" fill="rgba(150,200,255,0.35)">LON  {Math.abs(coords?.lon ?? -99.1332).toFixed(4)}° {(coords?.lon ?? -99.1332) >= 0 ? 'E' : 'W'}</text>
        <text x="386" y="22" textAnchor="end" fill="rgba(255,122,61,0.85)">{quiet ? 'STANDBY' : 'LIVE'}</text>
        <text x="386" y="36" textAnchor="end" fill="rgba(150,200,255,0.35)">RNG 10KM</text>
      </g>
    </svg>
  )
}
