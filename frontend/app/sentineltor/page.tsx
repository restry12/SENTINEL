'use client'

import { useState } from 'react'
import { IOSDevice } from '@/components/sentineltor/ios-frame'
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
  const [state, setState] = useState<ScreenId>('locating')
  const [completed, setCompleted] = useState<Set<number>>(new Set([0]))
  const [picked, setPicked] = useState('basement')

  const screen = (() => {
    const set = (s: string) => setState(s as ScreenId)
    switch (state) {
      case 'locating':   return <ScreenLocating setState={set}/>
      case 'alert':      return <ScreenAlert setState={set}/>
      case 'shelter':    return <ScreenShelter setState={set} completed={completed} setCompleted={setCompleted} picked={picked} setPicked={setPicked}/>
      case 'in-shelter': return <ScreenInShelter setState={set}/>
      case 'help':       return <ScreenHelp setState={set}/>
    }
  })()

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(1100px 700px at 20% 8%, rgba(92,218,255,0.06), transparent 60%),
        radial-gradient(900px 700px at 88% 95%, rgba(179,71,255,0.07), transparent 60%),
        radial-gradient(800px 500px at 70% 30%, rgba(255,56,56,0.045), transparent 65%),
        linear-gradient(180deg, #02050A 0%, #03070D 60%, #050912 100%)
      `,
      display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 100,
    }}>
      {/* atmospheric grid */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: `linear-gradient(rgba(120,180,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(120,180,255,0.035) 1px, transparent 1px)`, backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse at 50% 50%, #000 30%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, #000 30%, transparent 80%)', zIndex: 0 }}/>

      {/* header label + device */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingTop: 48 }}>
        <div style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10, letterSpacing: '2.4px', color: 'rgba(220,234,255,0.45)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF3838', boxShadow: '0 0 10px #FF3838', animation: 'sentinel-flicker 2s ease-in-out infinite', display: 'inline-block' }}/>
          SENTINEL TORNADO · PROTOTIPO MÓVIL
        </div>

        <div style={{ position: 'relative' }}>
          {/* corner crosshairs */}
          {[{ top: -14, left: -14, borderWidth: '1px 0 0 1px' },{ top: -14, right: -14, borderWidth: '1px 1px 0 0' },{ bottom: -14, left: -14, borderWidth: '0 0 1px 1px' },{ bottom: -14, right: -14, borderWidth: '0 1px 1px 0' }].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 28, height: 28, borderColor: 'rgba(92,218,255,0.45)', borderStyle: 'solid', pointerEvents: 'none', ...s }}/>
          ))}
          <IOSDevice dark={true} width={390} height={820}>
            <div key={state} style={{ height: '100%', overflowY: 'auto', background: '#03070B' }}>
              {screen}
            </div>
          </IOSDevice>
        </div>
      </div>

      {/* state dock — navigate between prototype screens */}
      <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4, padding: 5, background: 'rgba(8, 14, 24, 0.72)', backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)', border: '1px solid rgba(120,180,255,0.16)', borderRadius: 999, boxShadow: '0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)', zIndex: 100 }}>
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
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
