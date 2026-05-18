'use client'

import { useState } from 'react'
import { useGeolocation } from '@/hooks/use-geolocation'
import { ScreenLocating, ScreenAlert, ScreenShelter, ScreenInShelter, ScreenHelp } from '@/components/sentineltor/screens'

type ScreenId = 'locating' | 'alert' | 'shelter' | 'in-shelter' | 'help'

const STATES: { id: ScreenId; label: string; step: string; danger?: boolean }[] = [
  { id: 'locating',   label: 'UBICANDO',   step: 'A' },
  { id: 'alert',      label: 'ALERTA',     step: 'B', danger: true },
  { id: 'shelter',    label: 'REFUGIO',    step: 'C' },
  { id: 'in-shelter', label: 'EN REFUGIO', step: 'D' },
  { id: 'help',       label: 'AYUDA',      step: 'E', danger: true },
]

export default function SentinelTorPage() {
  const liveCoords = useGeolocation()
  const coords = liveCoords || { lat: 19.4326, lon: -99.1332 }

  const [state, setState] = useState<ScreenId>('locating')
  const [completed, setCompleted] = useState<Set<number>>(new Set([0]))
  const [picked, setPicked] = useState('basement')

  const screen = (() => {
    const set = (s: string) => setState(s as ScreenId)
    switch (state) {
      case 'locating':   return <ScreenLocating setState={set} coords={coords}/>
      case 'alert':      return <ScreenAlert setState={set} coords={coords}/>
      case 'shelter':    return <ScreenShelter setState={set} completed={completed} setCompleted={setCompleted} picked={picked} setPicked={setPicked} coords={coords}/>
      case 'in-shelter': return <ScreenInShelter setState={set} coords={coords}/>
      case 'help':       return <ScreenHelp setState={set} coords={coords}/>
    }
  })()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#03070B',
      display: 'flex', 
      flexDirection: 'column', 
      maxWidth: '500px',
      margin: '0 auto',
      position: 'relative',
      boxShadow: '0 0 100px rgba(0,0,0,0.5)',
      borderLeft: '1px solid rgba(255,255,255,0.05)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ flex: 1, paddingBottom: 100, overflowY: 'auto' }}>
        <div key={state}>
          {screen}
        </div>
      </div>

      {/* state dock — navigate between prototype screens */}
      <div style={{ 
        position: 'fixed', 
        bottom: 18, 
        left: '50%', 
        transform: 'translateX(-50%)', 
        display: 'flex', 
        gap: 4, 
        padding: 5, 
        background: 'rgba(8, 14, 24, 0.72)', 
        backdropFilter: 'blur(14px) saturate(140%)', 
        WebkitBackdropFilter: 'blur(14px) saturate(140%)', 
        border: '1px solid rgba(120,180,255,0.16)', 
        borderRadius: 999, 
        boxShadow: '0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)', 
        zIndex: 100,
        width: 'max-content',
        maxWidth: '95vw',
        overflowX: 'auto'
      }}>
        {STATES.map(s => (
          <button key={s.id} onClick={() => setState(s.id)} style={{
            appearance: 'none', cursor: 'pointer', outline: 'none',
            background: state === s.id ? (s.danger ? 'rgba(255,56,56,0.25)' : 'rgba(92,218,255,0.15)') : 'transparent',
            color: state === s.id ? (s.danger ? '#FFB8B8' : 'rgba(220,234,255,0.95)') : 'rgba(220,234,255,0.6)',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, letterSpacing: '1.2px',
            padding: '8px 14px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: state === s.id ? ('0 0 0 1px ' + (s.danger ? 'rgba(255,56,56,0.45)' : 'rgba(92,218,255,0.3)')) : '0 0 0 1px transparent',
            transition: 'all 0.18s ease', whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: state === s.id ? (s.danger ? 'rgba(255,56,56,0.4)' : 'rgba(92,218,255,0.25)') : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>{s.step}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
