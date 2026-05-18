'use client'

import React, { useState, useEffect } from 'react'
import { Radar } from './radar'
import { GeoCoords } from '@/hooks/use-geolocation'
import { SentinelRadarMap } from './sentinel-radar-map'

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const lambda1 = (lon1 * Math.PI) / 180
  const lambda2 = (lon2 * Math.PI) / 180
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1)
  const theta = Math.atan2(y, x)
  return ((theta * 180) / Math.PI + 360) % 360
}

function getCompassDir(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
  const idx = Math.round(bearing / 45) % 8
  return `${dirs[idx]} ${arrows[idx]}`
}

const A = {
  bg: '#03070B', panel: 'rgba(11, 22, 38, 0.66)', line: 'rgba(120, 180, 255, 0.12)',
  text: '#E8F1FF', muted: 'rgba(220, 234, 255, 0.55)', faint: 'rgba(220, 234, 255, 0.32)',
  cyan: '#5CDAFF', cyanDim: 'rgba(92, 218, 255, 0.16)', purple: '#B347FF',
  orange: '#FF7A3D', red: '#FF3838', yellow: '#FFD166', green: '#3AFFC6',
}

function GlassPanel({ children, style, glow, ...rest }: { children: React.ReactNode; style?: React.CSSProperties; glow?: 'danger' | 'purple' | 'cyan' | 'none'; [k: string]: unknown }) {
  const glowMap = {
    danger: '0 0 0 1px rgba(255,122,61,0.35), 0 10px 40px rgba(255,56,56,0.15), inset 0 1px 0 rgba(255,255,255,0.04)',
    purple: '0 0 0 1px rgba(179,71,255,0.35), 0 10px 40px rgba(179,71,255,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
    cyan:   '0 0 0 1px rgba(92,218,255,0.25), 0 10px 30px rgba(92,218,255,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
    none:   '0 0 0 1px rgba(120,180,255,0.10), inset 0 1px 0 rgba(255,255,255,0.03)',
  }
  return <div {...rest} style={{ background: A.panel, backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', borderRadius: 16, boxShadow: glowMap[glow ?? 'none'], ...style }}>{children}</div>
}

function MonoNum({ children, size = 28, color }: { children: React.ReactNode; size?: number; color?: string }) {
  return <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 600, fontSize: size, letterSpacing: -0.5, color: color ?? A.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{children}</span>
}

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 9.5, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: color ?? A.faint }}>{children}</div>
}

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M12 1.5 L22 6 V13 C22 18 17.5 21.5 12 22.5 C6.5 21.5 2 18 2 13 V6 Z" fill="none" stroke="#5CDAFF" strokeWidth="1.4"/>
          <path d="M12 6 L17 8.5 V13 C17 16 14.8 18 12 18.6 C9.2 18 7 16 7 13 V8.5 Z" fill="rgba(92,218,255,0.12)" stroke="#5CDAFF" strokeWidth="0.8" strokeOpacity="0.6"/>
          <circle cx="12" cy="12" r="1.5" fill="#5CDAFF"/>
        </svg>
        <span style={{ fontFamily: 'Inter, ui-sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: 2.4, color: A.text }}>SENTINEL</span>
      </div>
      <div className="sentinel-anim-flicker" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px 5px 7px', background: 'rgba(255,56,56,0.12)', borderRadius: 999, border: '1px solid rgba(255,56,56,0.45)', boxShadow: '0 0 16px rgba(255,56,56,0.25)' }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: A.red, boxShadow: '0 0 8px ' + A.red }}/>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: 10, letterSpacing: 1.6, color: '#FFB8B8' }}>ALERTA TORNADO</span>
      </div>
    </div>
  )
}

export function ScreenLocating({ setState, coords }: { setState: (s: string) => void, coords?: GeoCoords }) {
  useEffect(() => {
    const t = setTimeout(() => setState('alert'), 2800)
    return () => clearTimeout(t)
  }, [setState])

  const user = coords ?? { lat: 19.4326, lon: -99.1332 }
  const tornado = { lat: user.lat + 0.015, lon: user.lon + 0.012, bearing_deg: 45, intensity: 'EF4', speed_kmh: 85 }
  const shelter = { lat: user.lat - 0.005, lon: user.lon - 0.004, name: 'Sótano Reforzado' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header/>
      <div style={{ padding: '0 14px' }}>
        <GlassPanel glow="cyan" style={{ padding: 12 }}>
          <div style={{ height: 290, borderRadius: 12, overflow: 'hidden' }}>
            <SentinelRadarMap user={user} tornado={tornado} shelter={shelter} />
          </div>
        </GlassPanel>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px 28px 32px', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 999, border: '1.5px solid rgba(92,218,255,0.4)', borderTopColor: A.cyan, animation: 'sentinel-sweep 1.1s linear infinite', marginBottom: 18 }}/>
        <Label color="rgba(92,218,255,0.7)">GPS · SENTINEL NET</Label>
        <div style={{ marginTop: 8, fontFamily: 'Inter, ui-sans-serif', fontSize: 22, fontWeight: 600, color: A.text, letterSpacing: -0.4, lineHeight: 1.2 }}>Obteniendo ubicación segura…</div>
        <div style={{ marginTop: 10, color: A.muted, fontSize: 13.5, lineHeight: 1.4, maxWidth: 280 }}>Mantén el GPS activo. Cargando el radar de tormentas cercanas.</div>
      </div>
    </div>
  )
}

function RiskCard({ coords, tornado }: { coords: GeoCoords, tornado: any }) {
  const dist = haversineKm(coords.lat, coords.lon, tornado.lat, tornado.lon)
  const bearing = calculateBearing(coords.lat, coords.lon, tornado.lat, tornado.lon)
  const compass = getCompassDir(bearing)

  return (
    <GlassPanel glow="danger" style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <Label color="rgba(255,184,184,0.8)">NIVEL DE ALERTA</Label>
          <div style={{ marginTop: 4, fontFamily: 'Inter, ui-sans-serif', fontSize: 24, fontWeight: 800, letterSpacing: 0.4, color: A.red, textShadow: '0 0 14px rgba(255,56,56,0.55)' }}>EXTREMO</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Label color="rgba(179,71,255,0.85)">ESTADO</Label>
          <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, letterSpacing: 1, color: A.purple }}>ROTACIÓN<br/>DETECTADA</div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,56,56,0.08)', border: '1px solid rgba(255,56,56,0.25)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <Label color="rgba(255,184,184,0.85)">IMPACTO ESTIMADO</Label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <MonoNum size={36} color="#FFB8B8">12</MonoNum>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(255,184,184,0.7)', letterSpacing: 1 }}>MIN</span>
          </div>
        </div>
        <div style={{ width: 60, height: 60, position: 'relative' }}>
          <svg viewBox="0 0 60 60" width="60" height="60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,56,56,0.15)" strokeWidth="3"/>
            <circle cx="30" cy="30" r="24" fill="none" stroke={A.red} strokeWidth="3" strokeDasharray="150.7" strokeDashoffset="48" strokeLinecap="round" transform="rotate(-90 30 30)"/>
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600, color: A.red, letterSpacing: 0.5 }}>68%</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 14px' }}>
        {[['DISTANCIA',dist.toFixed(1),'KM',A.orange],['DIRECCIÓN',compass.split(' ')[0],compass.split(' ')[1],A.cyan],['VIENTO MÁX.','142','KM/H',A.orange],['PROB. TORNADO','78','%',A.purple]].map(([l,v,u,c])=>(
          <div key={l as string} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>{l}</Label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <MonoNum size={20} color={c as string}>{v}</MonoNum>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 500, color: A.faint, letterSpacing: 0.8 }}>{u}</span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}

function PrimaryButton({ children, onClick, variant = 'danger', sub }: { children: React.ReactNode; onClick: () => void; variant?: 'danger' | 'cyan'; sub?: string }) {
  const p = variant === 'danger'
    ? { bg: 'linear-gradient(180deg, #FF7A3D 0%, #FF3838 100%)', shadow: '0 8px 24px rgba(255,56,56,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset', color: '#fff' }
    : { bg: 'linear-gradient(180deg, #5CDAFF 0%, #3A9BFF 100%)', shadow: '0 8px 24px rgba(92,218,255,0.35), 0 0 0 1px rgba(255,255,255,0.12) inset', color: '#02101F' }
  return (
    <button onClick={onClick} style={{ width: '100%', border: 'none', cursor: 'pointer', background: p.bg, color: p.color, padding: '16px 18px', borderRadius: 18, boxShadow: p.shadow, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontFamily: 'Inter, ui-sans-serif' }}>
      <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.6 }}>{children}</span>
      {sub && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1.2, opacity: 0.75, fontWeight: 500 }}>{sub}</span>}
    </button>
  )
}

function SecondaryHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,184,184,0.85)', padding: '11px 14px', borderRadius: 14, border: '1px solid rgba(255,56,56,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, ui-sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: 0.8 }}>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M7 1 L13 12 L1 12 Z" fill="none" stroke="rgba(255,184,184,0.7)" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M7 5 V8.5 M7 10 V10.5" stroke="rgba(255,184,184,0.85)" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
      Necesito ayuda
    </button>
  )
}

function Timeline({ items }: { items: { time: string; label: string; done?: boolean; now?: boolean }[] }) {
  return (
    <GlassPanel style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Label>LÍNEA DE TIEMPO DEL EVENTO</Label>
        <Label color="rgba(92,218,255,0.7)">EN VIVO</Label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: it.done ? A.muted : A.text, fontWeight: 600, width: 42 }}>{it.time}</span>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: it.now ? A.red : it.done ? A.muted : A.cyanDim, border: it.now ? '2px solid rgba(255,56,56,0.4)' : 'none', boxShadow: it.now ? '0 0 10px ' + A.red : 'none', flexShrink: 0 }}/>
            <span style={{ fontSize: 12.5, color: it.done ? A.muted : A.text, fontWeight: it.now ? 600 : 400 }}>{it.label}</span>
            {it.now && <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 1, color: A.red, fontWeight: 700 }}>AHORA</span>}
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}

export function ScreenAlert({ setState, coords }: { setState: (s: string) => void, coords?: GeoCoords }) {
  const user = coords ?? { lat: 19.4326, lon: -99.1332 }
  const tornado = { lat: user.lat + 0.015, lon: user.lon + 0.012, bearing_deg: 45, intensity: 'EF4', speed_kmh: 85 }
  const shelter = { lat: user.lat - 0.005, lon: user.lon - 0.004, name: 'Sótano Reforzado' }

  const timeline = [
    { time: '17:35', label: 'Rotación detectada', done: true },
    { time: '17:42', label: 'Riesgo elevado a EXTREMO', now: true },
    { time: '17:51', label: 'Impacto probable en tu zona' },
    { time: '18:10', label: 'Revisión de alerta' },
  ]
  return (
    <div style={{ padding: '0 14px 20px' }}>
      <Header/>
      <div style={{ padding: '12px 16px 14px', marginBottom: 12, background: 'linear-gradient(180deg, rgba(255,56,56,0.16), rgba(255,122,61,0.04))', border: '1px solid rgba(255,122,61,0.4)', borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 100% 0%, rgba(179,71,255,0.18), transparent 60%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative' }}>
          <Label color="rgba(255,184,184,0.85)">INSTRUCCIÓN PRINCIPAL</Label>
          <div style={{ marginTop: 6, fontFamily: 'Inter, ui-sans-serif', fontSize: 26, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.4, color: A.text }}>
            Busca refugio<br/><span style={{ color: A.orange, textShadow: '0 0 14px rgba(255,122,61,0.6)' }}>interior ahora</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.45, color: 'rgba(232,241,255,0.78)' }}>
            Ve al nivel más bajo disponible. Si hay sótano, úsalo. Si no, busca una habitación interior sin ventanas.
          </div>
        </div>
      </div>
      <GlassPanel glow="purple" style={{ padding: 8, marginBottom: 12 }}>
        <div style={{ height: 280, borderRadius: 12, overflow: 'hidden' }}>
          <SentinelRadarMap user={user} tornado={tornado} shelter={shelter} />
        </div>
      </GlassPanel>
      <RiskCard coords={user} tornado={tornado} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <PrimaryButton onClick={() => setState('shelter')} variant="danger" sub="Activa la guía paso a paso">BUSCAR REFUGIO AHORA</PrimaryButton>
        <SecondaryHelpButton onClick={() => setState('help')}/>
      </div>
      <Timeline items={timeline}/>
      <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid ' + A.line, borderRadius: 12, fontSize: 11.5, color: A.muted, lineHeight: 1.5 }}>
        <span style={{ color: A.orange, fontWeight: 600 }}>No salgas al exterior.</span> No intentes huir en vehículo; los tornados se mueven más rápido que el tráfico.
      </div>
    </div>
  )
}

const SHELTER_STEPS = ['Ve al sótano si existe.','Si no hay sótano, ve al piso más bajo.','Busca una habitación interior sin ventanas.','Aléjate de vidrios y muros exteriores.','Cúbrete cabeza y cuello.','Permanece allí hasta nueva alerta.']
const SHELTER_OPTIONS = [
  { id: 'basement', label: 'Sótano', rank: 'IDEAL', tone: 'purple' as const },
  { id: 'bath', label: 'Baño interior', rank: 'BUENO', tone: 'cyan' as const },
  { id: 'hall', label: 'Pasillo central', rank: 'BUENO', tone: 'cyan' as const },
  { id: 'closet', label: 'Clóset interior', rank: 'BUENO', tone: 'cyan' as const },
  { id: 'inner', label: 'Habitación sin ventanas', rank: 'BUENO', tone: 'cyan' as const },
  { id: 'table', label: 'Bajo una mesa resistente', rank: 'ÚLTIMO', tone: 'orange' as const },
]

export function ScreenShelter({ setState, completed, setCompleted, picked, setPicked, coords }: { setState: (s: string) => void; completed: Set<number>; setCompleted: (s: Set<number>) => void; picked: string; setPicked: (s: string) => void; coords?: GeoCoords }) {
  const toggleStep = (i: number) => {
    const next = new Set(completed)
    next.has(i) ? next.delete(i) : next.add(i)
    setCompleted(next)
  }
  const tones = { purple: { c: A.purple, bg: 'rgba(179,71,255,0.10)', bd: 'rgba(179,71,255,0.45)' }, cyan: { c: A.cyan, bg: 'rgba(92,218,255,0.06)', bd: 'rgba(92,218,255,0.25)' }, orange: { c: A.orange, bg: 'rgba(255,122,61,0.08)', bd: 'rgba(255,122,61,0.35)' } }
  const pickedOpt = SHELTER_OPTIONS.find(o => o.id === picked)
  return (
    <div style={{ padding: '0 14px 20px' }}>
      <Header/>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,122,61,0.06)', border: '1px solid rgba(255,122,61,0.3)', borderRadius: 12, padding: '8px 12px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: A.orange, boxShadow: '0 0 10px ' + A.orange, animation: 'sentinel-flicker 1.5s ease-in-out infinite' }}/>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1.2, color: '#FFC9AE', fontWeight: 600 }}>MODO REFUGIO ACTIVO</span>
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: A.faint, letterSpacing: 0.8 }}>T -12 MIN</span>
      </div>
      <div style={{ marginBottom: 4 }}><Label color="rgba(255,122,61,0.85)">GUÍA SENTINEL</Label></div>
      <div style={{ fontFamily: 'Inter, ui-sans-serif', fontSize: 26, fontWeight: 800, color: A.text, letterSpacing: -0.4, lineHeight: 1.05, marginTop: 4, marginBottom: 4 }}>Dirígete al lugar<br/>más seguro</div>
      <div style={{ fontSize: 13.5, color: A.muted, lineHeight: 1.45, marginBottom: 16 }}>Marca cada paso al completarlo. No salgas a mirar el tornado.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
        {SHELTER_STEPS.map((s, i) => (
          <button key={i} onClick={() => toggleStep(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: completed.has(i) ? 'rgba(58,255,198,0.06)' : 'transparent', border: '1px solid ' + (completed.has(i) ? 'rgba(58,255,198,0.30)' : A.line), borderRadius: 12, padding: '11px 12px', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: completed.has(i) ? A.green : 'rgba(92,218,255,0.10)', border: completed.has(i) ? 'none' : '1px solid rgba(92,218,255,0.35)', color: completed.has(i) ? '#02101F' : A.cyan, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 12 }}>
              {completed.has(i) ? <svg width="13" height="13" viewBox="0 0 13 13"><path d="M2 7l3 3 6-7" stroke="#02101F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg> : (i + 1)}
            </span>
            <span style={{ fontSize: 14, color: completed.has(i) ? A.muted : A.text, textDecoration: completed.has(i) ? 'line-through' : 'none', lineHeight: 1.35 }}>{s}</span>
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 8 }}><Label>REFUGIOS RECOMENDADOS</Label></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {SHELTER_OPTIONS.map(opt => {
          const t = tones[opt.tone]
          const sel = picked === opt.id
          return (
            <button key={opt.id} onClick={() => setPicked(opt.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, flex: '1 1 calc(50% - 5px)', minWidth: 0, background: sel ? t.bg : 'rgba(255,255,255,0.02)', border: '1px solid ' + (sel ? t.bd : A.line), borderRadius: 12, padding: '10px 11px', textAlign: 'left', cursor: 'pointer', boxShadow: sel ? '0 0 0 1px ' + t.bd + ', 0 6px 18px ' + t.bg : 'none' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8.5, letterSpacing: 1.2, color: t.c, fontWeight: 700 }}>{opt.rank}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: A.text, lineHeight: 1.2 }}>{opt.label}</div>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton onClick={() => setState('in-shelter')} variant="cyan" sub={pickedOpt ? 'Confirmas refugio en: ' + pickedOpt.label : 'Cuando estés a salvo, confírmalo'}>ESTOY EN REFUGIO</PrimaryButton>
        <SecondaryHelpButton onClick={() => setState('help')}/>
      </div>
      <button onClick={() => setState('alert')} style={{ marginTop: 12, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: A.faint, letterSpacing: 1, padding: '6px' }}>← VOLVER AL RADAR</button>
    </div>
  )
}

export function ScreenInShelter({ setState, coords }: { setState: (s: string) => void, coords?: GeoCoords }) {
  const [secs, setSecs] = useState(8 * 60)
  const [lastUpdate, setLastUpdate] = useState(20)
  useEffect(() => {
    const t = setInterval(() => { setSecs(s => Math.max(0, s - 1)); setLastUpdate(u => (u + 1) % 90) }, 1000)
    return () => clearInterval(t)
  }, [])
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  const user = coords ?? { lat: 19.4326, lon: -99.1332 }
  const tornado = { lat: user.lat + 0.015, lon: user.lon + 0.012, bearing_deg: 45, intensity: 'EF4', speed_kmh: 85 }
  const shelter = { lat: user.lat - 0.005, lon: user.lon - 0.004, name: 'Sótano Reforzado' }

  return (
    <div style={{ padding: '0 14px 24px' }}>
      <Header/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(58,255,198,0.06)', border: '1px solid rgba(58,255,198,0.30)', borderRadius: 12, padding: '8px 12px', marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: A.green, boxShadow: '0 0 10px ' + A.green }}/>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: 1.2, color: '#B8FFE7', fontWeight: 600 }}>EN REFUGIO · MONITOREO ACTIVO</span>
      </div>
      <div style={{ marginBottom: 4 }}><Label color="rgba(58,255,198,0.85)">SENTINEL · ESTADO</Label></div>
      <div style={{ fontFamily: 'Inter, ui-sans-serif', fontSize: 30, fontWeight: 800, color: A.text, letterSpacing: -0.5, lineHeight: 1.05, marginTop: 4, marginBottom: 8 }}>
        Permanece en<br/><span style={{ color: A.green, textShadow: '0 0 14px rgba(58,255,198,0.45)' }}>refugio.</span>
      </div>
      <div style={{ fontSize: 13.5, color: A.muted, lineHeight: 1.5, marginBottom: 16 }}>No salgas a mirar el tornado. Espera una nueva actualización de SENTINEL o instrucciones oficiales.</div>
      <GlassPanel glow="cyan" style={{ padding: '16px 18px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Label color="rgba(92,218,255,0.75)">TIEMPO EST. RESTANTE</Label>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <MonoNum size={48} color={A.cyan}>{mm}:{ss}</MonoNum>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Label>ÚLTIMA ACTUALIZACIÓN</Label>
            <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: A.text, fontWeight: 600 }}>hace {lastUpdate}s</div>
            <div style={{ marginTop: 4 }}><Label color="rgba(92,218,255,0.6)">↻ MONITOREANDO</Label></div>
          </div>
        </div>
      </GlassPanel>
      <GlassPanel style={{ padding: 8, marginBottom: 12 }}>
        <div style={{ height: 210, borderRadius: 12, overflow: 'hidden' }}>
          <SentinelRadarMap user={user} tornado={tornado} shelter={shelter} />
        </div>
      </GlassPanel>
      <GlassPanel style={{ padding: '12px 14px', marginBottom: 14 }}>
        <Label>MIENTRAS ESPERAS</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {['Aléjate de vidrios y ventanas.','Cúbrete cabeza y cuello con tus brazos o un objeto resistente.','Mantén el teléfono cargado y con sonido.','No uses el elevador. No salgas a inspeccionar daños.'].map((txt, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: A.cyan, marginTop: 7, flexShrink: 0, boxShadow: '0 0 6px ' + A.cyan }}/>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'rgba(232,241,255,0.82)' }}>{txt}</span>
            </div>
          ))}
        </div>
      </GlassPanel>
      <SecondaryHelpButton onClick={() => setState('help')}/>
      <button onClick={() => setState('shelter')} style={{ marginTop: 12, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: A.faint, letterSpacing: 1, padding: '6px' }}>← VOLVER A LA GUÍA</button>
    </div>
  )
}

export function ScreenHelp({ setState, coords }: { setState: (s: string) => void, coords?: GeoCoords }) {
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPulse(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const user = coords ?? { lat: 19.4326, lon: -99.1332 }
  const tornado = { lat: user.lat + 0.015, lon: user.lon + 0.012, bearing_deg: 45, intensity: 'EF4', speed_kmh: 85 }
  const shelter = { lat: user.lat - 0.005, lon: user.lon - 0.004, name: 'Sótano Reforzado' }

  return (
    <div style={{ padding: '0 14px 24px' }}>
      <Header/>
      <div style={{ padding: '14px 16px', marginBottom: 14, background: 'linear-gradient(180deg, rgba(255,122,61,0.18), rgba(255,56,56,0.06))', border: '1px solid rgba(255,122,61,0.55)', borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 0% 100%, rgba(179,71,255,0.15), transparent 55%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: A.orange, boxShadow: '0 0 14px ' + A.orange, animation: 'sentinel-flicker 1.2s ease-in-out infinite' }}/>
            <Label color="rgba(255,184,184,0.9)">SEÑAL DE EMERGENCIA ACTIVA</Label>
          </div>
          <div style={{ fontFamily: 'Inter, ui-sans-serif', fontSize: 28, fontWeight: 800, color: A.text, letterSpacing: -0.5, lineHeight: 1.05, marginBottom: 8 }}>
            Ayuda en<br/><span style={{ color: A.orange, textShadow: '0 0 16px rgba(255,122,61,0.6)' }}>camino.</span>
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(232,241,255,0.78)', lineHeight: 1.45 }}>Tu ubicación fue compartida con servicios de emergencia y contactos de confianza.</div>
        </div>
      </div>
      <GlassPanel glow="danger" style={{ padding: '12px 14px', marginBottom: 12 }}>
        <Label color="rgba(255,184,184,0.85)">UBICACIÓN EN TIEMPO REAL</Label>
        <div style={{ position: 'relative', textAlign: 'center', padding: '14px 0 8px' }}>
          <div style={{ margin: '0 auto 4px', width: 84, height: 84, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,122,61,0.35), rgba(255,56,56,0.05) 70%)', border: '2px solid rgba(255,122,61,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(255,122,61,0.5)' }}>
            <svg width="36" height="36" viewBox="0 0 36 36">
              <path d="M18 4 C 11 4 6 9 6 16 c 0 8 12 16 12 16 s 12 -8 12 -16 c 0 -7 -5 -12 -12 -12 z" fill="rgba(255,122,61,0.2)" stroke={A.orange} strokeWidth="1.6"/>
              <circle cx="18" cy="15" r="4" fill={A.orange}/>
            </svg>
          </div>
          <div style={{ marginTop: 10, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: A.text, letterSpacing: 0.5 }}>
            {Math.abs(user.lat).toFixed(4)}° {user.lat >= 0 ? 'N' : 'S'} · {Math.abs(user.lon).toFixed(4)}° {user.lon >= 0 ? 'E' : 'W'}
          </div>
          <div style={{ marginTop: 2, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: A.faint, letterSpacing: 1.2 }}>± 8m · ACTUALIZADO HACE {pulse % 5}s</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,122,61,0.18)' }}>
          {[['ID EVENTO','TX-7842',A.text],['RESPUESTA','CONFIRMADA',A.green],['ETA EQUIPO','~ 18 MIN',A.cyan]].map(([l,v,c])=>(
            <div key={l as string}>
              <Label>{l}</Label>
              <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: c as string, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </GlassPanel>
      <GlassPanel style={{ padding: 8, marginBottom: 14 }}>
        <div style={{ height: 210, borderRadius: 12, overflow: 'hidden' }}>
          <SentinelRadarMap user={user} tornado={tornado} shelter={shelter} />
        </div>
      </GlassPanel>
      <GlassPanel style={{ padding: '12px 14px', marginBottom: 14 }}>
        <Label>MIENTRAS LLEGA AYUDA</Label>
        <div style={{ fontSize: 13.5, color: 'rgba(232,241,255,0.82)', lineHeight: 1.5, marginTop: 8 }}>Permanece en tu refugio. Si estás herido, no te muevas. Mantén el celular contigo.</div>
      </GlassPanel>
      <button onClick={() => setState('in-shelter')} style={{ width: '100%', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', color: A.faint, padding: '10px 12px', borderRadius: 12, border: '1px solid ' + A.line, fontFamily: 'Inter, ui-sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: 0.4 }}>
        Cancelar solo si fue error
      </button>
    </div>
  )
}
