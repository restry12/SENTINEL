"use client"

import { Snowflake, MapPin, Search } from "lucide-react"
import { CollapsibleWidget } from "@/components/dashboard/widget"
import type { GlacierInfo } from "@sentinel/types"
import { useState } from "react"

interface Props {
  glaciers: GlacierInfo[]
  selectedGlacierId: string | null
  onGlacierSelect: (id: string) => void
  loading: boolean
}

export function GlacierLeftPanel({ glaciers, selectedGlacierId, onGlacierSelect, loading }: Props) {
  const [search, setSearch] = useState("")

  const filteredGlaciers = glaciers.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.country.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-3 w-full">
      <CollapsibleWidget 
        title="Catálogo de Glaciares" 
        icon={<Snowflake className="w-3.5 h-3.5" />} 
        className="w-full"
      >
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar glaciar o país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded py-1.5 pl-8 pr-3 text-[11px] text-white placeholder:text-text-muted focus:outline-none focus:border-blue/50 transition-colors"
          />
        </div>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
          {loading ? (
            <div className="py-8 text-center">
              <div className="text-[10px] text-text-muted animate-pulse font-bold uppercase tracking-widest">
                Sincronizando...
              </div>
            </div>
          ) : filteredGlaciers.length > 0 ? (
            filteredGlaciers.map((glacier) => (
              <button
                key={glacier.id}
                onClick={() => onGlacierSelect(glacier.id)}
                className={`w-full flex flex-col p-2.5 rounded border transition-all text-left group ${
                  selectedGlacierId === glacier.id
                    ? "bg-blue/10 border-blue/40"
                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-black uppercase tracking-tight ${
                    selectedGlacierId === glacier.id ? "text-blue" : "text-white"
                  }`}>
                    {glacier.name}
                  </span>
                  <Snowflake className={`w-3 h-3 ${
                    selectedGlacierId === glacier.id ? "text-blue" : "text-text-muted opacity-40 group-hover:opacity-100"
                  }`} />
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-2.5 h-2.5 text-text-muted" />
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
                    {glacier.region}, {glacier.country}
                  </span>
                </div>
                {glacier.altitude && (
                   <div className="mt-2 text-[9px] font-mono text-text-muted flex justify-between">
                      <span>ALTITUD</span>
                      <span className="text-white">{glacier.altitude}m</span>
                   </div>
                )}
              </button>
            ))
          ) : (
            <div className="py-8 text-center">
              <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                No se encontraron glaciares
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between text-[9px] font-bold text-text-muted uppercase tracking-widest">
            <span>Total Glaciares</span>
            <span className="text-white font-mono">{glaciers.length}</span>
          </div>
        </div>
      </CollapsibleWidget>

      {!selectedGlacierId && (
        <div className="p-4 rounded border border-white/10 bg-[#0a0b0e]/80 backdrop-blur-md">
          <p className="text-[10px] text-text-muted leading-relaxed">
            Selecciona un glaciar del catálogo para iniciar el análisis de retroceso y proyecciones climáticas.
          </p>
        </div>
      )}
    </div>
  )
}
