"use client"

import { useEffect, useState, useCallback } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TopBar } from "@/components/dashboard/top-bar"
import { GlacierLeftPanel } from "@/components/glaciares/glacier-left-panel"
import { GlacierMap } from "@/components/glaciares/glacier-map"
import { GlacierRightPanel } from "@/components/glaciares/glacier-right-panel"
import type { GlacierInfo, GlacierAnalysis, AgentResponse } from "@sentinel/types"
import { Snowflake, ChevronLeft, Loader2 } from "lucide-react"

type GlacierWithMass = GlacierInfo & { lastMassChange: number }

export default function GlaciersPage() {
  return <AuthGuard><GlaciersPageInner /></AuthGuard>
}

function GlaciersPageInner() {
  const [glaciers, setSelectedGlaciers] = useState<GlacierWithMass[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGlacierId, setSelectedGlacierId] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<GlacierAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    fetch("http://localhost:3006/glaciers")
      .then(r => r.json())
      .then((res: AgentResponse<GlacierWithMass[]>) => {
        if (res.success && res.data) {
          setSelectedGlaciers(res.data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleGlacierSelect = useCallback(async (glacierId: string) => {
    setSelectedGlacierId(glacierId)
    setAnalyzing(true)
    setAnalysisData(null)
    
    try {
      const res = await fetch("http://localhost:3006/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ glacierId })
      })
      const result: AgentResponse<GlacierAnalysis> = await res.json()
      if (result.success && result.data) {
        setAnalysisData(result.data)
      }
    } catch (err) {
      console.error("Error analyzing glacier:", err)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const handleBack = useCallback(() => {
    setSelectedGlacierId(null)
    setAnalysisData(null)
  }, [])

  const selectedGlacier = glaciers.find(g => g.id === selectedGlacierId)

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">

        {/* ── MAP ── */}
        <GlacierMap 
          glaciers={glaciers}
          selectedGlacierId={selectedGlacierId}
          onGlacierSelect={handleGlacierSelect}
        />

        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center gap-3">
            <Snowflake className="w-5 h-5 text-blue animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-text-muted">
              Sincronizando catálogo de glaciares…
            </span>
          </div>
        )}

        {/* ── LEFT PANEL ── */}
        <div className="absolute top-6 left-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
          <div className="h-full overflow-y-auto pr-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
            <GlacierLeftPanel
              glaciers={glaciers}
              selectedGlacierId={selectedGlacierId}
              onGlacierSelect={handleGlacierSelect}
              loading={loading}
            />
          </div>
        </div>

        {/* ── RIGHT PANEL PLACEHOLDER ── */}
        <div className="absolute top-6 right-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
          <div className="h-full overflow-y-auto pl-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
            {(selectedGlacierId) && (
              <button
                onClick={handleBack}
                className="self-end flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/20 bg-[#0a0b0e]/80 backdrop-blur-md pointer-events-auto"
              >
                <ChevronLeft className="w-3 h-3" />
                Cerrar Análisis
              </button>
            )}
            
            {selectedGlacierId && (
              <div className="pointer-events-auto">
                {analyzing ? (
                   <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4">
                      <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                         <Loader2 className="w-3 h-3 animate-spin" />
                         Análisis de Retroceso
                      </div>
                      <div className="py-8 text-center">
                         <div className="text-[11px] text-text-muted font-bold animate-pulse">PROCESANDO DATOS SATELITALES...</div>
                      </div>
                   </div>
                ) : analysisData ? (
                   <GlacierRightPanel data={analysisData} />
                ) : (
                  <div className="bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded p-4">
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Snowflake className="w-3 h-3 text-blue" />
                       Análisis de Retroceso
                    </div>
                    <div className="py-4 text-center text-[11px] text-text-muted italic">
                      Selecciona un glaciar para ver el análisis detallado.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
