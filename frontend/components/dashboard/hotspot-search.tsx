"use client"

import { useRef, useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useSentinel } from '@/contexts/sentinel-context'
import { useFireSelection } from '@/contexts/fire-selection-context'

function frpColor(frp: number): string {
  if (frp >= 300) return '#ef4444'
  if (frp >= 100) return '#f97316'
  return '#fbbf24'
}

export function HotspotSearch() {
  const { sentinelUpdate } = useSentinel()
  const { selectFireRef } = useFireSelection()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const fires = sentinelUpdate?.fires ?? []

  const indexedFires = useMemo(
    () =>
      fires
        .map((f, i) => ({ fire: f, index: i, id: `FIRE-${String(i + 1).padStart(3, '0')}` }))
        .sort((a, b) => b.fire.frp - a.fire.frp),
    [fires]
  )

  const trimmedQuery = query.trim().toUpperCase()

  const displayFires = useMemo(
    () =>
      trimmedQuery
        ? indexedFires.filter(f => f.id.includes(trimmedQuery))
        : indexedFires.slice(0, 10),
    [indexedFires, trimmedQuery]
  )

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleSelect(index: number) {
    selectFireRef.current?.(index, fires)
    setOpen(false)
    setQuery('')
  }

  const disabled = fires.length === 0

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { if (!disabled) setOpen(o => !o) }}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-[11px] font-black tracking-[0.15em] uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
          open
            ? 'border-orange/70 bg-orange/20 text-orange shadow-[0_0_12px_rgba(255,126,21,0.25)]'
            : 'border-orange/40 bg-orange/10 text-orange hover:bg-orange/20'
        }`}
      >
        <Search className="w-3.5 h-3.5" />
        <span>Top Focos</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-[#0d1117] border border-orange/30 rounded-xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_30px_rgba(255,126,21,0.08)] z-50">
          <p className="text-[8px] tracking-[0.2em] text-text-muted uppercase px-1 mb-2">
            Top Focos · Ordenado por FRP
          </p>

          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por ID (ej: FIRE-120)…"
            className="w-full bg-[#080c14] border border-border rounded-lg px-3 py-1.5 text-[9px] text-foreground placeholder:text-text-muted font-mono mb-2.5 outline-none focus:border-orange/40 transition-colors"
          />

          <div className="space-y-0.5 max-h-72 overflow-y-auto scrollbar-none">
            {displayFires.length === 0 ? (
              <p className="text-[9px] text-text-muted px-2 py-3 text-center">Sin resultados</p>
            ) : (
              displayFires.map(({ fire, index, id }, rank) => {
                const color = frpColor(fire.frp)
                const isTop = rank === 0 && !trimmedQuery
                return (
                  <button
                    key={id}
                    onClick={() => handleSelect(index)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-white/5 ${
                      isTop ? 'bg-red/10 border border-red/20' : ''
                    }`}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black tracking-[0.12em] leading-none" style={{ color }}>
                        {id}
                      </div>
                      <div className="text-[8px] text-text-muted font-mono mt-0.5">
                        {fire.lat.toFixed(3)}° / {fire.lon.toFixed(3)}°
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[13px] font-black leading-none" style={{ color }}>
                        {fire.frp.toFixed(0)}
                      </div>
                      <div className="text-[7px] text-text-muted">MW</div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {!trimmedQuery && indexedFires.length > 10 && (
            <p className="text-[8px] text-text-muted text-center mt-2 pt-2 border-t border-border">
              + {indexedFires.length - 10} focos más · busca por ID para ver más
            </p>
          )}
        </div>
      )}
    </div>
  )
}
