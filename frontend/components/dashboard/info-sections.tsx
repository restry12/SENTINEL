"use client"

import { Users, FileText } from "lucide-react"
import { useLang } from "@/contexts/language-context"
import { useSentinel } from "@/contexts/sentinel-context"

function Label({ children, right }: { children: React.ReactNode, right?: string }) {
  return (
    <div className="sentinel-label">
      <span>{children}</span>
      <span className="bar" />
      {right && <span className="text-text-muted font-mono tracking-widest">{right}</span>}
    </div>
  )
}

export function InfoSections() {
  const { tx } = useLang()
  const { sentinelUpdate: u } = useSentinel()
  const evacPct = 66
  const briefingText = u?.report?.resumen_ejecutivo ?? u?.riskAssessment?.resumen ?? null
  const populationAtRisk = u?.report?.poblacion_en_riesgo_estimada ?? null

  return (
    <div className="space-y-4">
      {/* Municipal Briefing */}
      <div className="sentinel-card p-4">
        <div className="mb-4">
          <Label right="15:00 UTC">{tx.municipalBriefing}</Label>
        </div>
        
        <div className="p-4 bg-surface-2 border border-border rounded-md">
          {briefingText ? (
            <p className="text-[13px] text-text-2 leading-relaxed italic">"{briefingText}"</p>
          ) : (
            <p className="text-[13px] text-text-2 leading-relaxed italic">
              "The <span className="text-orange font-semibold not-italic">Cedar Ridge Fire</span> has expanded to
              <span className="text-foreground font-bold not-italic"> 12,400 acres</span> with
              <span className="text-foreground font-bold not-italic"> 8% containment</span>. {tx.windNote}"
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: tx.personnel, value: "1,247" },
            { label: tx.vehicles, value: "89" },
            { label: tx.aircraft, value: "12" },
          ].map((item) => (
            <div key={item.label} className="p-2.5 bg-background border border-border rounded-sm text-center">
              <div className="text-base font-medium text-foreground num leading-none mb-1">{item.value}</div>
              <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider">{item.label}</div>
            </div>
          ))}
        </div>
        
        <div className="p-2 border border-orange/20 bg-orange/5 rounded mt-4">
          <p className="text-[10px] font-bold text-orange-soft uppercase tracking-[0.14em] text-center">
            {tx.nextBriefing}
          </p>
        </div>
      </div>

      {/* Social Impact */}
      <div className="sentinel-card p-4">
        <div className="mb-4">
          <Label>{tx.socialImpact}</Label>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: tx.atRisk, value: populationAtRisk != null ? populationAtRisk.toLocaleString() : "127,450", color: "text-red-soft" },
            { label: tx.evacuated, value: "84,230", color: "text-green-soft" },
            { label: tx.inShelters, value: "23,847", color: "text-blue" },
            { label: tx.structures, value: "4,892", color: "text-orange-soft" },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-background border border-border rounded-md">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">{item.label}</div>
              <div className={`text-lg font-medium ${item.color} num leading-none`}>{item.value}</div>
            </div>
          ))}
        </div>
        
        {/* Evacuation Progress */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-semibold text-text-dim uppercase tracking-wider">
              {tx.evacuationProgress}
            </span>
            <span className="text-sm font-medium text-green-soft num">{evacPct}%</span>
          </div>
          <div className="h-2 bg-[#15171c] border border-border rounded-full overflow-hidden relative">
            <div 
              className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#16a34a,#22c55e)] shadow-[0_0_10px_rgba(34,197,94,0.35)] animate-shimmer" 
              style={{ width: `${evacPct}%` }} 
            />
          </div>
        </div>
      </div>
    </div>
  )
}
