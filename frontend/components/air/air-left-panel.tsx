"use client"

import { useState } from "react"
import { Wind, Activity, AlertTriangle, MapPin, Globe, ChevronDown, ChevronUp, ChevronLeft } from "lucide-react"
import type { CountryData, CityFeature } from "./world-air-map"

type Category = "good" | "semi-good" | "semi-bad" | "bad" | "none"

const CAT_LABELS: Record<Category, string> = {
  good:"Bueno", "semi-good":"Semi Bueno", "semi-bad":"Semi Malo", bad:"Malo", none:"Sin datos",
}
const CAT_COLORS: Record<Category, { text:string; border:string; bg:string; glow:string }> = {
  good:        { text:"text-green-soft", border:"border-green/40",  bg:"bg-green/10",  glow:"#00ff7f" },
  "semi-good": { text:"text-amber",     border:"border-amber/40",  bg:"bg-amber/10",  glow:"#ffd700" },
  "semi-bad":  { text:"text-orange",    border:"border-orange/40", bg:"bg-orange/10", glow:"#ff6600" },
  bad:         { text:"text-red",       border:"border-red/40",    bg:"bg-red/10",    glow:"#ff1a1a" },
  none:        { text:"text-text-muted",border:"border-white/10",  bg:"bg-white/5",   glow:"#475569" },
}

interface Props {
  selectedCountry:  string | null
  countryData:      CountryData | null
  selectedCity:     CityFeature | null
  citiesInCountry:  CityFeature[]
  onCitySelect:     (city: CityFeature) => void
  onBackToCountry:  () => void
}

export function AirLeftPanel({ selectedCountry, countryData, selectedCity, citiesInCountry, onCitySelect, onBackToCountry }: Props) {
  const [expanded, setExpanded] = useState(false)

  // ── ESTADO VACÍO ──
  if (!selectedCountry && !selectedCity) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-4 gap-3">
        <Globe className="w-10 h-10 text-text-muted opacity-40" />
        <p className="text-[11px] text-text-muted leading-relaxed">
          Haz clic en un país para hacer zoom y explorar su calidad del aire
        </p>
      </div>
    )
  }

  // ── CIUDAD SELECCIONADA ──
  if (selectedCity) {
    const BackBtn = () => (
      <button
        onClick={onBackToCountry}
        className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors"
      >
        <ChevronLeft className="w-3 h-3" />
        {selectedCity.country}
      </button>
    )

    if (!selectedCity.hasData) {
      return (
        <div className="flex flex-col gap-3 w-full">
          <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/10 rounded-lg p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-text-muted" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Calidad del Aire</span>
              </div>
              <BackBtn />
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-3 h-3 text-text-muted" />
              <span className="text-[10px] text-text-muted">{selectedCity.country}</span>
            </div>
            <h2 className="text-lg font-black text-white">{selectedCity.city}</h2>
            <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#334155] shrink-0" />
              <p className="text-[11px] text-text-muted leading-relaxed">
                Sin registros de calidad del aire para esta ciudad.
              </p>
            </div>
          </div>
        </div>
      )
    }

    const cat = selectedCity.category as Category
    const col = CAT_COLORS[cat]
    const pollutants = [
      { label:"PM2.5", value:selectedCity.pm25  },
      { label:"Ozone", value:selectedCity.ozone },
      { label:"NO2",   value:selectedCity.no2   },
      { label:"CO",    value:selectedCity.co    },
    ]
    const scorePercent = Math.min(100, selectedCity.score ?? 0)

    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/15 rounded-lg p-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Activity className="w-10 h-10 text-blue" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-text-muted" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Ciudad</span>
            </div>
            <BackBtn />
          </div>
          <h2 className="text-lg font-black text-white leading-tight">{selectedCity.city}</h2>
          <div className="flex items-center gap-1.5 mt-0.5 mb-3">
            <MapPin className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">{selectedCity.country}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-black ${col.text}`}>{CAT_LABELS[cat]}</span>
            <div className={`px-3 py-1 rounded border ${col.border} ${col.bg} text-[9px] font-black tracking-widest uppercase ${col.text}`}>
              AQI {selectedCity.avgAQI}
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Air Score</span>
              <span className="text-xs font-black text-white num">{scorePercent.toFixed(0)}<span className="text-[9px] text-text-muted">/100</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${scorePercent}%`, background:"linear-gradient(90deg,#00ff7f,#ffd700,#ff6600,#ff1a1a)", backgroundSize:"400% 100%", backgroundPosition:`${scorePercent}% 0` }}
              />
            </div>
          </div>
        </div>

        <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/15 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Wind className="w-3 h-3 text-text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Contaminante dominante</span>
          </div>
          <div className={`text-xl font-black ${col.text} num mb-3`}>{selectedCity.dominant ?? "—"}</div>
          {pollutants.map(({ label, value }) => {
            const isDom = label === selectedCity.dominant
            return (
              <div key={label} className="py-1.5 border-b border-white/5 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isDom ? col.glow : "rgba(255,255,255,0.15)" }} />
                    <span className="text-[10px] font-bold text-text-2">{label}</span>
                  </div>
                  <span className={`text-[11px] font-black num ${isDom ? col.text : "text-white"}`}>
                    {value !== null ? value.toFixed(1) : "—"}
                  </span>
                </div>
                {value !== null && (
                  <div className="h-0.5 rounded-full bg-white/5 ml-3.5 mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${Math.min(100,(value/200)*100)}%`, backgroundColor: isDom ? col.glow : "rgba(255,255,255,0.15)" }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── PAÍS SELECCIONADO ──
  if (!countryData) return null
  const cat = countryData.category as Category
  const col = CAT_COLORS[cat]
  const scorePercent = Math.min(100, countryData.score)
  const pollutants = [
    { label:"PM2.5", value:countryData.pm25  },
    { label:"Ozone", value:countryData.ozone },
    { label:"NO2",   value:countryData.no2   },
    { label:"CO",    value:countryData.co    },
  ]

  // Sort cities: most monitored first, then worst AQI
  const sortedCities = [...citiesInCountry].sort((a, b) => (b.records - a.records) || ((b.avgAQI ?? 0) - (a.avgAQI ?? 0)))
  const visibleCities = expanded ? sortedCities : sortedCities.slice(0, 3)

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Country header */}
      <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/15 rounded-lg p-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10">
          <Activity className="w-10 h-10 text-blue" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3 h-3 text-text-muted" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Calidad del Aire · País</span>
        </div>
        <h2 className="text-lg font-black text-white leading-tight mb-3">{selectedCountry}</h2>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-black ${col.text}`}>{CAT_LABELS[cat]}</span>
          <div className={`px-3 py-1 rounded border ${col.border} ${col.bg} text-[9px] font-black tracking-widest uppercase ${col.text}`}>
            AQI {countryData.avgAQI}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between">
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">Air Score</span>
            <span className="text-xs font-black text-white num">{scorePercent.toFixed(0)}<span className="text-[9px] text-text-muted">/100</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${scorePercent}%`, background:"linear-gradient(90deg,#00ff7f,#ffd700,#ff6600,#ff1a1a)", backgroundSize:"400% 100%", backgroundPosition:`${scorePercent}% 0` }}
            />
          </div>
        </div>
      </div>

      {/* Pollutants */}
      <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/15 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-1">
          <Wind className="w-3 h-3 text-text-muted" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Contaminante dominante</span>
        </div>
        <div className={`text-xl font-black ${col.text} num mb-3`}>{countryData.dominant}</div>
        {pollutants.map(({ label, value }) => {
          const isDom = label === countryData.dominant
          return (
            <div key={label} className="py-1.5 border-b border-white/5 last:border-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isDom ? col.glow : "rgba(255,255,255,0.15)" }} />
                <span className="text-[10px] font-bold text-text-2">{label}</span>
              </div>
              <span className={`text-[11px] font-black num ${isDom ? col.text : "text-white"}`}>
                {value !== null ? value.toFixed(1) : "—"}
              </span>
            </div>
          )
        })}
      </div>

      {/* City list */}
      {sortedCities.length > 0 && (
        <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/15 rounded-lg p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3 text-text-muted" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">
                Ciudades · {sortedCities.length} con datos
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            {visibleCities.map((city) => {
              const cc = city.category as Category
              const cCol = CAT_COLORS[cc]
              return (
                <button
                  key={`${city.city}-${city.country}`}
                  onClick={() => onCitySelect(city)}
                  className="w-full flex items-center justify-between py-2 px-2.5 rounded-lg bg-white/3 hover:bg-white/8 border border-white/5 hover:border-white/15 transition-all group text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cCol.glow, boxShadow: `0 0 5px ${cCol.glow}55` }} />
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-white group-hover:text-white truncate">{city.city}</div>
                      <div className={`text-[8px] font-bold uppercase tracking-wider ${cCol.text}`}>{CAT_LABELS[cc]}</div>
                    </div>
                  </div>
                  <div className={`text-[11px] font-black num shrink-0 ml-2 ${cCol.text}`}>
                    {city.avgAQI}
                  </div>
                </button>
              )
            })}
          </div>

          {sortedCities.length > 3 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="w-full mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-all"
            >
              {expanded
                ? <><ChevronUp className="w-3 h-3" />Ver menos</>
                : <><ChevronDown className="w-3 h-3" />Ver más ({sortedCities.length - 3} ciudades)</>
              }
            </button>
          )}
        </div>
      )}

      {/* National summary */}
      <div className="w-full bg-[#0a0b0e]/90 backdrop-blur-xl border border-white/15 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-3 h-3 text-text-muted" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">Resumen nacional</span>
        </div>
        <p className="text-[11px] text-text-2 leading-relaxed">
          {{
            good:        `${selectedCountry} presenta una calidad del aire saludable. Niveles de contaminantes dentro de rangos seguros.`,
            "semi-good": `La calidad del aire en ${selectedCountry} es aceptable, con niveles moderados. Grupos sensibles deben monitorear exposición.`,
            "semi-bad":  `${selectedCountry} registra niveles elevados de contaminación. El contaminante dominante es ${countryData.dominant}. Monitoreo constante recomendado.`,
            bad:         `Niveles críticos en ${selectedCountry}. AQI promedio supera umbrales de riesgo. Activar protocolos de emergencia ambiental.`,
            none:        "Sin datos suficientes para este país.",
          }[cat]}
        </p>
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between">
          <span className="text-[9px] text-text-muted">Ciudades en dataset</span>
          <span className="text-[10px] font-black text-white num">{countryData.cities.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}
