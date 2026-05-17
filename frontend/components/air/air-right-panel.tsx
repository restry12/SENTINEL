"use client"

import { BarChart2, TrendingUp, TrendingDown, Minus, ShieldAlert, Globe } from "lucide-react"
import { CollapsibleWidget } from "@/components/dashboard/widget"
import type { CountryData, CityFeature } from "./world-air-map"

type Category = "good" | "semi-good" | "semi-bad" | "bad" | "none"

const CAT_LABELS: Record<Category, string> = {
  good:"Bueno", "semi-good":"Semi Bueno", "semi-bad":"Semi Malo", bad:"Malo", none:"Sin datos",
}

const recs: Record<string, string[]> = {
  good:        ["Condiciones óptimas para actividades al aire libre","Mantener monitoreo rutinario","Sin medidas especiales necesarias"],
  "semi-good": ["Grupos sensibles deben limitar exposición","Monitorear PM2.5 en horario pico","Considerar alertas preventivas"],
  "semi-bad":  ["Reducir exposición en horas críticas (6–10AM)","Monitorear PM2.5 y PM10 continuamente","Evaluar restricción de fuentes de emisión"],
  bad:         ["Evitar actividades físicas al aire libre","Activar protocolo de emergencia ambiental","Distribuir mascarillas N95","Restringir circulación vehicular"],
  none:        ["Sin datos suficientes para generar recomendaciones"],
}

const riskConf: Record<string, { label:string; color:string; detail:string }> = {
  good:        { label:"Bajo",     color:"text-green-soft", detail:"Sin restricciones especiales." },
  "semi-good": { label:"Moderado", color:"text-amber",      detail:"Grupos sensibles podrían notar efectos." },
  "semi-bad":  { label:"Alto",     color:"text-orange",     detail:"Reducir exposición prolongada al exterior." },
  bad:         { label:"Crítico",  color:"text-red",        detail:"Evitar exposición. Activar emergencia." },
  none:        { label:"—",        color:"text-text-muted", detail:"Sin datos para evaluar riesgo." },
}

interface Props {
  selectedCountry: string | null
  countryData:     CountryData | null
  selectedCity:    CityFeature | null
  allCountryData:  Record<string, CountryData>
  globalAvg:       number
  globalMax:       number
  globalMin:       number
}

export function AirRightPanel({ selectedCountry, countryData, selectedCity, allCountryData, globalAvg, globalMax, globalMin }: Props) {

  // ── VISTA GLOBAL ──
  if (!selectedCountry && !selectedCity) {
    const cats = { good:0, "semi-good":0, "semi-bad":0, bad:0 } as Record<string,number>
    Object.values(allCountryData).forEach(d => { if (cats[d.category]!==undefined) cats[d.category]++ })
    const total = Object.keys(allCountryData).length
    const barConf: Record<string,{ bar:string; text:string }> = {
      good:{ bar:"bg-green-soft", text:"text-green-soft" }, "semi-good":{ bar:"bg-amber", text:"text-amber" },
      "semi-bad":{ bar:"bg-orange", text:"text-orange" }, bad:{ bar:"bg-red", text:"text-red" },
    }

    return (
      <div className="flex flex-col gap-3 w-full">
        <CollapsibleWidget title="Resumen Global" icon={<Globe className="w-3.5 h-3.5" />} className="w-full">
          {[
            { label:"Países con datos",    value:total.toString(),      color:"text-white" },
            { label:"AQI promedio global", value:globalAvg.toFixed(1),  color:"text-white" },
            { label:"AQI máximo",          value:globalMax.toFixed(1),  color:"text-red" },
            { label:"AQI mínimo",          value:globalMin.toFixed(1),  color:"text-green-soft" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[10px] text-text-muted">{label}</span>
              <span className={`text-[11px] font-black num ${color}`}>{value}</span>
            </div>
          ))}
        </CollapsibleWidget>

        <CollapsibleWidget title="Distribución Global" icon={<BarChart2 className="w-3.5 h-3.5" />} className="w-full">
          {(["good","semi-good","semi-bad","bad"] as Category[]).map(cat => {
            const count = cats[cat] ?? 0
            const pct   = Math.round((count / total) * 100)
            const c     = barConf[cat]
            return (
              <div key={cat} className="mb-3 last:mb-0">
                <div className="flex justify-between mb-1">
                  <span className={`text-[9px] font-bold uppercase ${c.text}`}>{CAT_LABELS[cat]}</span>
                  <span className="text-[9px] text-text-muted font-mono">{count} ({pct}%)</span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className={`h-full rounded-full ${c.bar}`} style={{ width:`${pct}%` }} />
                </div>
              </div>
            )
          })}
        </CollapsibleWidget>
      </div>
    )
  }

  // ── CIUDAD SELECCIONADA ──
  if (selectedCity) {
    if (!selectedCity.hasData) {
      return (
        <CollapsibleWidget title="Inteligencia · Ciudad" icon={<BarChart2 className="w-3.5 h-3.5" />} className="w-full">
          <p className="text-[11px] text-text-muted leading-relaxed">
            No hay datos para <span className="text-white font-bold">{selectedCity.city}</span>.
          </p>
          {countryData && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="text-[9px] text-text-muted mb-1">Promedio del país</div>
              <div className="text-sm font-black text-white num">AQI {countryData.avgAQI}</div>
            </div>
          )}
        </CollapsibleWidget>
      )
    }

    const cityAQI  = selectedCity.avgAQI ?? 0
    const vsG      = cityAQI - globalAvg
    const countryVals = Object.entries(allCountryData).filter(([n]) => n === selectedCity.country)
    const countryAvg  = countryVals[0]?.[1]?.avgAQI ?? globalAvg
    const vsC      = cityAQI - countryAvg
    const cat      = selectedCity.category as Category
    const risk     = riskConf[cat] ?? riskConf.none
    let TrendIcon  = Minus, trendText = "Estable", trendColor = "text-amber"
    if (vsG > 30)  { TrendIcon = TrendingUp;   trendText = "Empeora"; trendColor = "text-red" }
    if (vsG < -20) { TrendIcon = TrendingDown; trendText = "Mejora";  trendColor = "text-green-soft" }

    return (
      <div className="flex flex-col gap-3 w-full">
        <CollapsibleWidget title="Inteligencia · Ciudad" icon={<BarChart2 className="w-3.5 h-3.5" />} className="w-full">
          {[
            { label:`Vs. promedio global (${globalAvg.toFixed(0)})`, value:(vsG>=0?"+":"")+vsG.toFixed(1), color:vsG>0?"text-red":"text-green-soft" },
            { label:`Vs. promedio ${selectedCity.country}`,          value:(vsC>=0?"+":"")+vsC.toFixed(1), color:vsC>0?"text-orange":"text-green-soft" },
            { label:"Registros en dataset", value:selectedCity.records.toLocaleString(), color:"text-text-2" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
              <span className="text-[10px] text-text-muted">{label}</span>
              <span className={`text-[11px] font-black num ${color}`}>{value}</span>
            </div>
          ))}
        </CollapsibleWidget>

        <CollapsibleWidget title="Riesgo y Recomendaciones" icon={<ShieldAlert className="w-3.5 h-3.5" />} className="w-full">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 rounded bg-white/5 border border-white/10">
              <div className="text-[8px] font-bold uppercase tracking-widest text-text-muted mb-1">Tendencia</div>
              <div className={`flex items-center gap-1.5 ${trendColor}`}>
                <TrendIcon className="w-3.5 h-3.5" /><span className="text-[11px] font-black">{trendText}</span>
              </div>
            </div>
            <div className="p-2 rounded bg-white/5 border border-white/10">
              <div className="text-[8px] font-bold uppercase tracking-widest text-text-muted mb-1">Riesgo</div>
              <span className={`text-[11px] font-black ${risk.color}`}>{risk.label}</span>
            </div>
          </div>
          <div className="text-[9px] text-text-muted italic mb-3">{risk.detail}</div>
          <div className="space-y-2">
            {(recs[cat] ?? recs.none).map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 flex items-center justify-center border border-blue/40 bg-blue/10 text-[8px] font-black text-blue rounded shrink-0 num">{i+1}</span>
                <span className="text-[10px] text-text-2 leading-relaxed">{r}</span>
              </div>
            ))}
          </div>
        </CollapsibleWidget>
      </div>
    )
  }

  // ── PAÍS SELECCIONADO ──
  if (!countryData) return null
  const sorted  = Object.entries(allCountryData).sort((a,b) => a[1].avgAQI - b[1].avgAQI)
  const rank    = sorted.findIndex(([n]) => n === selectedCountry) + 1
  const total   = sorted.length
  const rankPct = Math.round(((total - rank + 1) / total) * 100)
  const vsG     = countryData.avgAQI - globalAvg
  const cat     = countryData.category as Category
  const risk    = riskConf[cat] ?? riskConf.none
  let TrendIcon = Minus, trendText = "Estable", trendColor = "text-amber"
  if (vsG > 20)  { TrendIcon = TrendingUp;   trendText = "Empeora"; trendColor = "text-red" }
  if (vsG < -15) { TrendIcon = TrendingDown; trendText = "Mejora";  trendColor = "text-green-soft" }

  return (
    <div className="flex flex-col gap-3 w-full">
      <CollapsibleWidget title="Inteligencia · País" icon={<BarChart2 className="w-3.5 h-3.5" />} className="w-full">
        {[
          { label:"AQI promedio", value:countryData.avgAQI.toFixed(1), color:"text-white" },
          { label:"AQI máximo",   value:countryData.maxAQI.toFixed(1), color:"text-red" },
          { label:"AQI mínimo",   value:countryData.minAQI.toFixed(1), color:"text-green-soft" },
          { label:`Vs. global (${globalAvg.toFixed(0)})`, value:(vsG>=0?"+":"")+vsG.toFixed(1), color:vsG>0?"text-red":"text-green-soft" },
          { label:"Ranking global", value:`#${rank} de ${total}`, color:"text-blue" },
          { label:"Registros",    value:countryData.records.toLocaleString(), color:"text-text-2" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
            <span className="text-[10px] text-text-muted">{label}</span>
            <span className={`text-[11px] font-black num ${color}`}>{value}</span>
          </div>
        ))}
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1">
            <div className="h-full rounded-full bg-gradient-to-r from-green to-red" style={{ width:`${rankPct}%` }} />
          </div>
          <div className="flex justify-between text-[8px] text-text-dim font-mono">
            <span>Mejor calidad</span><span>Peor calidad</span>
          </div>
        </div>
      </CollapsibleWidget>

      <CollapsibleWidget title="Riesgo y Recomendaciones" icon={<ShieldAlert className="w-3.5 h-3.5" />} className="w-full">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded bg-white/5 border border-white/10">
            <div className="text-[8px] font-bold uppercase tracking-widest text-text-muted mb-1">Tendencia</div>
            <div className={`flex items-center gap-1.5 ${trendColor}`}>
              <TrendIcon className="w-3.5 h-3.5" /><span className="text-[11px] font-black">{trendText}</span>
            </div>
          </div>
          <div className="p-2 rounded bg-white/5 border border-white/10">
            <div className="text-[8px] font-bold uppercase tracking-widest text-text-muted mb-1">Riesgo</div>
            <span className={`text-[11px] font-black ${risk.color}`}>{risk.label}</span>
          </div>
        </div>
        <div className="text-[9px] text-text-muted italic mb-3">{risk.detail}</div>
        <div className="space-y-2">
          {(recs[cat] ?? recs.none).map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 flex items-center justify-center border border-blue/40 bg-blue/10 text-[8px] font-black text-blue rounded shrink-0 num">{i+1}</span>
              <span className="text-[10px] text-text-2 leading-relaxed">{r}</span>
            </div>
          ))}
        </div>
      </CollapsibleWidget>
    </div>
  )
}
