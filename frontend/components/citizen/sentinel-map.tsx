"use client"

import React from 'react'
import type { ScreenRisk } from '@/lib/citizen-mock-data'

interface SentinelMapProps {
  size?: number
  showPropagation?: boolean
  showRoute?: boolean
  riskLevel?: ScreenRisk
}

export function SentinelMap({
  size = 360,
  showPropagation = true,
  showRoute = true,
}: SentinelMapProps) {
  const C = {
    bg: '#0a0a0a',
    gridMinor: 'rgba(232,230,224,0.04)',
    gridMajor: 'rgba(232,230,224,0.08)',
    contour: 'rgba(232,230,224,0.10)',
    road: 'rgba(232,230,224,0.16)',
    roadMajor: 'rgba(232,230,224,0.28)',
    water: 'rgba(59,130,246,0.10)',
    waterEdge: 'rgba(59,130,246,0.32)',
    fire: '#ef4444',
    safe: '#22c55e',
    info: '#3b82f6',
    fg: '#e8e6e0',
  }

  const U    = { x: 196, y: 250 }
  const F1   = { x: 96,  y: 138 }
  const F2   = { x: 52,  y: 78  }
  const SAFE = { x: 296, y: 64  }

  const route = [U, { x: 218, y: 220 }, { x: 244, y: 172 }, { x: 268, y: 120 }, SAFE]
  const routePath = 'M ' + route.map(p => `${p.x} ${p.y}`).join(' L ')

  const poly2h  = 'M 92,138 L 132,128 L 158,150 L 148,176 L 116,184 L 88,168 Z'
  const poly6h  = 'M 70,118 L 138,98  L 198,130 L 220,168 L 174,206 L 128,212 L 80,196 L 56,166 Z'
  const poly12h = 'M 40,82  L 130,52  L 232,84  L 286,130 L 264,200 L 200,238 L 132,244 L 70,222 L 30,170 L 24,118 Z'

  const grid: React.ReactElement[] = []
  for (let i = 0; i <= 360; i += 24) {
    const major = i % 72 === 0
    grid.push(<line key={'gx'+i} x1={i} y1={0} x2={i} y2={360} stroke={major ? C.gridMajor : C.gridMinor} strokeWidth={major ? 0.5 : 0.3} />)
    grid.push(<line key={'gy'+i} x1={0} y1={i} x2={360} y2={i} stroke={major ? C.gridMajor : C.gridMinor} strokeWidth={major ? 0.5 : 0.3} />)
  }

  return (
    <svg
      viewBox="0 0 360 360"
      width={size} height={size}
      style={{ display: 'block', background: C.bg, borderRadius: 14 }}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="smFireGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor="#fb923c" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#ef4444" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="smUserGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor={C.info} stopOpacity="0.55" />
          <stop offset="100%" stopColor={C.info} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="smSafeGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%"  stopColor={C.safe} stopOpacity="0.45" />
          <stop offset="100%" stopColor={C.safe} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="smPropGrad" cx="0.32" cy="0.55" r="0.7">
          <stop offset="0%"   stopColor="#ef4444" stopOpacity="0.5" />
          <stop offset="60%"  stopColor="#ef4444" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.04" />
        </radialGradient>
        <marker id="smPropArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={C.fire} />
        </marker>
        <marker id="smRouteArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={C.safe} />
        </marker>
      </defs>

      <rect width="360" height="360" fill={C.bg} />

      {/* Topographic contours */}
      <g fill="none" stroke={C.contour} strokeWidth="0.6">
        <path d="M -10 290 Q 80 260 180 280 T 380 250" />
        <path d="M -10 260 Q 90 220 200 245 T 380 215" />
        <path d="M -10 220 Q 110 180 220 200 T 380 170" />
        <path d="M -10 170 Q 130 130 240 150 T 380 120" />
        <path d="M -10 120 Q 150 80  260 100 T 380 70" />
        <path d="M -10 70  Q 170 30  290 50  T 380 20" />
      </g>

      <g>{grid}</g>

      <path d="M 340 0 Q 320 80 332 160 Q 348 240 322 360 L 360 360 L 360 0 Z" fill={C.water} stroke={C.waterEdge} strokeWidth="0.6" />

      {/* Roads */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 0 282 L 196 250 L 268 200 L 360 188" stroke={C.roadMajor} strokeWidth="2.2" />
        <path d="M 0 282 L 196 250 L 268 200 L 360 188" stroke="rgba(232,230,224,0.55)" strokeWidth="0.4" strokeDasharray="4 6" />
        <path d="M 60 360 L 80 240 L 130 140 L 160 40" stroke={C.road} strokeWidth="1.2" />
        <path d="M 360 100 L 280 110 L 200 130 L 120 200 L 40 230" stroke={C.road} strokeWidth="1.2" />
        <path d="M 220 360 L 230 280 L 244 172 L 260 80" stroke={C.road} strokeWidth="1.2" />
        <path d="M 0 60 L 90 80 L 180 60 L 280 38" stroke={C.road} strokeWidth="1.2" />
      </g>

      {/* Propagation polygons */}
      {showPropagation && (
        <g style={{ transformOrigin: `${F1.x}px ${F1.y}px`, animation: 'spread-poly 1200ms ease-out both' }}>
          <path d={poly12h} fill="url(#smPropGrad)" stroke="rgba(239,68,68,0.32)" strokeWidth="0.6" strokeDasharray="2 3" />
          <path d={poly6h}  fill="url(#smPropGrad)" stroke="rgba(239,68,68,0.5)"  strokeWidth="0.8" strokeDasharray="3 2" opacity="0.85" />
          <path d={poly2h}  fill="rgba(239,68,68,0.35)" stroke={C.fire} strokeWidth="1.1" />
          <g style={{ font: '600 8px monospace' } as React.CSSProperties} fill="rgba(239,68,68,0.85)">
            <text x="148" y="178" textAnchor="middle">+2H</text>
            <text x="208" y="200" textAnchor="middle" opacity="0.85">+6H</text>
            <text x="262" y="216" textAnchor="middle" opacity="0.7">+12H</text>
          </g>
        </g>
      )}

      {/* Propagation vector */}
      {showPropagation && (
        <g>
          <line
            x1={F1.x} y1={F1.y} x2={F1.x + 78} y2={F1.y + 60}
            stroke={C.fire} strokeWidth="2.5"
            markerEnd="url(#smPropArrow)" strokeLinecap="round"
          />
          <line
            x1={F1.x + 6} y1={F1.y + 8} x2={F1.x + 64} y2={F1.y + 56}
            stroke={C.fire} strokeWidth="1" opacity="0.4" strokeDasharray="3 4"
          />
          <g transform={`translate(${F1.x + 84}, ${F1.y + 70})`}>
            <rect x="-2" y="-9" width="68" height="22" rx="3" fill="rgba(10,10,10,0.85)" stroke="rgba(239,68,68,0.5)" strokeWidth="0.5" />
            <text x="2" y="-1" style={{ font: '600 7px monospace' } as React.CSSProperties} fill={C.fire}>2.4 KM/H</text>
            <text x="2" y="9"  style={{ font: '500 7px monospace' } as React.CSSProperties} fill="rgba(232,230,224,0.7)">RUMBO 041°</text>
          </g>
        </g>
      )}

      {/* Escape route */}
      {showRoute && (
        <g>
          <path d={routePath} fill="none" stroke={C.safe} strokeOpacity="0.18" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          <path d={routePath} fill="none" stroke={C.safe} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#smRouteArrow)" />
          <path d={routePath} fill="none" stroke="#86efac" strokeWidth="1" strokeDasharray="2 8" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="0" to="-30" dur="1.6s" repeatCount="indefinite" />
          </path>
          {route.slice(1, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3.2" fill={C.bg} stroke={C.safe} strokeWidth="1.4" />
          ))}
        </g>
      )}

      {/* Safe zone */}
      {showRoute && (
        <g>
          <circle cx={SAFE.x} cy={SAFE.y} r="28" fill="url(#smSafeGlow)" />
          <circle cx={SAFE.x} cy={SAFE.y} r="9" fill={C.bg} stroke={C.safe} strokeWidth="1.8" />
          <path d={`M ${SAFE.x-4} ${SAFE.y} L ${SAFE.x-1} ${SAFE.y+3} L ${SAFE.x+4} ${SAFE.y-3}`} stroke={C.safe} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x={SAFE.x + 14} y={SAFE.y - 4} style={{ font: '600 9px sans-serif' } as React.CSSProperties} fill={C.fg}>Cerro Chepe</text>
          <text x={SAFE.x + 14} y={SAFE.y + 6} style={{ font: '500 7px monospace' } as React.CSSProperties} fill="rgba(232,230,224,0.55)">PUNTO DE ENCUENTRO</text>
        </g>
      )}

      {/* Fire foci */}
      <g>
        <circle cx={F2.x} cy={F2.y} r="22" fill="url(#smFireGlow)" style={{ animation: 'pulse-soft 1.6s ease-in-out infinite' }} />
        <circle cx={F2.x} cy={F2.y} r="3" fill={C.fire} />
        <circle cx={F1.x} cy={F1.y} r="36" fill="url(#smFireGlow)" style={{ animation: 'pulse-soft 1.4s ease-in-out infinite' }} />
        <circle cx={F1.x} cy={F1.y} r="20" fill="none" stroke={C.fire} strokeWidth="1" style={{ transformOrigin: `${F1.x}px ${F1.y}px`, animation: 'ping 1.8s ease-out infinite' }} />
        <circle cx={F1.x} cy={F1.y} r="5.5" fill={C.fire} style={{ animation: 'ember 1.2s ease-in-out infinite' }} />
        <circle cx={F1.x} cy={F1.y} r="2.5" fill="#fde68a" />
        <text x={F1.x - 26} y={F1.y - 28} style={{ font: '600 7px monospace' } as React.CSSProperties} fill={C.fire}>FRP 184</text>
      </g>

      {/* User position */}
      <g>
        <circle cx={U.x} cy={U.y} r="38" fill="url(#smUserGlow)" />
        <circle cx={U.x} cy={U.y} r="22" fill="none" stroke={C.info} strokeWidth="1.2" strokeOpacity="0.5" style={{ transformOrigin: `${U.x}px ${U.y}px`, animation: 'ping 2.2s ease-out infinite' }} />
        <path d={`M ${U.x} ${U.y} L ${U.x - 20} ${U.y - 36} A 42 42 0 0 1 ${U.x + 20} ${U.y - 36} Z`} fill={C.info} fillOpacity="0.18" />
        <circle cx={U.x} cy={U.y} r="6.5" fill={C.info} stroke={C.bg} strokeWidth="1.6" />
        <circle cx={U.x} cy={U.y} r="2.4" fill="#dbeafe" />
        <text x={U.x + 12} y={U.y + 14} style={{ font: '600 8px sans-serif' } as React.CSSProperties} fill={C.fg}>TÚ</text>
        <text x={U.x + 12} y={U.y + 23} style={{ font: '500 7px monospace' } as React.CSSProperties} fill="rgba(232,230,224,0.55)">±12M</text>
      </g>

      {/* Compass rose */}
      <g transform="translate(20, 24)" opacity="0.55">
        <circle cx="0" cy="0" r="11" fill="none" stroke="rgba(232,230,224,0.3)" strokeWidth="0.6" />
        <path d="M 0 -10 L 2.5 0 L 0 2 L -2.5 0 Z" fill={C.fire} />
        <path d="M 0 10 L 2.5 0 L 0 -2 L -2.5 0 Z" fill="rgba(232,230,224,0.4)" />
        <text x="0" y="-13" textAnchor="middle" style={{ font: '600 6px monospace' } as React.CSSProperties} fill={C.fg}>N</text>
      </g>

      {/* Scale bar */}
      <g transform="translate(20, 332)" opacity="0.65">
        <line x1="0" y1="0" x2="46" y2="0" stroke="rgba(232,230,224,0.5)" strokeWidth="1" />
        <line x1="0" y1="-2" x2="0" y2="2" stroke="rgba(232,230,224,0.5)" strokeWidth="1" />
        <line x1="46" y1="-2" x2="46" y2="2" stroke="rgba(232,230,224,0.5)" strokeWidth="1" />
        <text x="50" y="3" style={{ font: '500 7px monospace' } as React.CSSProperties} fill="rgba(232,230,224,0.7)">500 M</text>
      </g>
    </svg>
  )
}
