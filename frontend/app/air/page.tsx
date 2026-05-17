"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { AuthGuard } from "@/components/auth-guard"
import { TopBar } from "@/components/dashboard/top-bar"
import { AirLeftPanel } from "@/components/air/air-left-panel"
import { AirRightPanel } from "@/components/air/air-right-panel"
import type { CountryData, CityFeature } from "@/components/air/world-air-map"
import { Wind, ChevronLeft } from "lucide-react"
import { MobileDrawer } from "@/components/ui/mobile-drawer"

const WorldAirMap = dynamic(
  () => import("@/components/air/world-air-map").then(m => m.WorldAirMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

interface GeoFeature {
  type: "Feature"
  geometry: { type: "Point"; coordinates: [number, number] }
  properties: Omit<CityFeature, "lng"|"lat">
}

interface AirDataFile {
  countries: Record<string, CountryData>
  globalAvg: number; globalMax: number; globalMin: number
}

export default function AirQualityPage() {
  return <AuthGuard><AirQualityPageInner /></AuthGuard>
}

function AirQualityPageInner() {
  const [countryData,     setCountryData]     = useState<AirDataFile | null>(null)
  const [cityFeatures,    setCityFeatures]    = useState<GeoFeature[]>([])
  const [loading,         setLoading]         = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCity,    setSelectedCity]    = useState<CityFeature | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/air-quality-data.json").then(r => r.json()),
      fetch("/air-cities.geojson").then(r => r.json()),
    ]).then(([cData, geoData]: [AirDataFile, { features: GeoFeature[] }]) => {
      setCountryData(cData)
      setCityFeatures(geoData.features)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleCountrySelect = useCallback((country: string) => {
    setSelectedCountry(country)
    setSelectedCity(null)
  }, [])

  const handleCitySelect = useCallback((city: CityFeature) => {
    setSelectedCity(city)
  }, [])

  const handleBack = useCallback(() => {
    if (selectedCity) {
      setSelectedCity(null)
    } else {
      setSelectedCountry(null)
      setSelectedCity(null)
    }
  }, [selectedCity])

  const citiesInCountry = useMemo<CityFeature[]>(() => {
    if (!selectedCountry) return []
    return cityFeatures
      .filter(f => f.properties.country === selectedCountry && f.properties.hasData)
      .map(f => ({ ...f.properties, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
      .sort((a, b) => b.records - a.records) as CityFeature[]
  }, [cityFeatures, selectedCountry])

  const globalStats = useMemo(() => {
    if (!cityFeatures.length) return { avg: 0, max: 0, min: 0 }
    const vals = cityFeatures.filter(f => f.properties.hasData).map(f => f.properties.avgAQI as number)
    if (!vals.length) return { avg: 0, max: 0, min: 0 }
    return {
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
      max: Math.max(...vals),
      min: Math.min(...vals),
    }
  }, [cityFeatures])

  const legend = [
    { color: "#00ff7f", label: "Bueno",      range: "0–25" },
    { color: "#ffd700", label: "Semi Bueno", range: "26–50" },
    { color: "#ff6600", label: "Semi Malo",  range: "51–75" },
    { color: "#ff1a1a", label: "Malo",       range: "76–100" },
  ]

  const panelCountry     = selectedCountry
  const panelCountryData = countryData && selectedCountry ? countryData.countries[selectedCountry] ?? null : null

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">

        {!loading && countryData && (
          <WorldAirMap
            countryData={countryData.countries}
            selectedCountry={selectedCountry}
            onCountrySelect={handleCountrySelect}
          />
        )}

        {loading && (
          <div className="absolute inset-0 bg-background flex items-center justify-center gap-3">
            <Wind className="w-5 h-5 text-blue animate-pulse" />
            <span className="text-[11px] font-black tracking-[0.2em] uppercase text-text-muted">
              Cargando calidad del aire…
            </span>
          </div>
        )}

        {/* ── LEFT PANEL ── */}
        <div className="hidden md:block absolute top-6 left-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
          <div className="h-full overflow-y-auto pr-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
            <AirLeftPanel
              selectedCountry={panelCountry}
              countryData={panelCountryData}
              selectedCity={selectedCity}
              citiesInCountry={citiesInCountry}
              onCitySelect={handleCitySelect}
              onBackToCountry={() => setSelectedCity(null)}
            />
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="hidden md:block absolute top-6 right-6 z-40 w-72 pointer-events-none h-[calc(100vh-120px)]">
          <div className="h-full overflow-y-auto pl-1 scrollbar-none pointer-events-auto flex flex-col gap-3 pb-4">
            {/* Back button */}
            {(selectedCountry || selectedCity) && (
              <button
                onClick={handleBack}
                className="self-end flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-white/20 bg-[#0a0b0e]/80 backdrop-blur-md pointer-events-auto"
              >
                <ChevronLeft className="w-3 h-3" />
                {selectedCity ? "País" : "Mundo"}
              </button>
            )}
            <AirRightPanel
              selectedCountry={panelCountry}
              countryData={panelCountryData}
              selectedCity={selectedCity}
              allCountryData={countryData?.countries ?? {}}
              globalAvg={countryData?.globalAvg ?? globalStats.avg}
              globalMax={countryData?.globalMax ?? globalStats.max}
              globalMin={countryData?.globalMin ?? globalStats.min}
            />
          </div>
        </div>

        {/* ── LEGEND ── */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="flex items-center gap-1 bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-2xl">
            <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted mr-2">Air Score</span>
            {legend.map(({ color, label, range }) => (
              <div key={label} className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background:`${color}18` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:color, boxShadow:`0 0 5px ${color}` }} />
                <span className="text-[9px] font-bold text-white">{label}</span>
                <span className="text-[8px] text-text-muted font-mono">{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── BACK BUTTON (floating) ── */}
        {selectedCountry && (
          <button
            onClick={handleBack}
            className="hidden md:flex absolute pointer-events-auto z-40"
            style={{ bottom: "5.5rem", left: "50%", transform: "translateX(-50%)" }}
          >
            <div className="flex items-center gap-2 bg-[#0a0b0e]/80 backdrop-blur-md border border-white/15 rounded-full px-4 py-2 shadow-2xl hover:border-white/30 transition-all">
              <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">
                {selectedCity ? "Volver al país" : "Volver al mundo"}
              </span>
            </div>
          </button>
        )}

        {/* ── MOBILE DRAWER ── */}
        <MobileDrawer title="Calidad del Aire" triggerLabel="Ver datos">
          <AirLeftPanel
            selectedCountry={panelCountry}
            countryData={panelCountryData}
            selectedCity={selectedCity}
            citiesInCountry={citiesInCountry}
            onCitySelect={handleCitySelect}
            onBackToCountry={() => setSelectedCity(null)}
          />
          {(selectedCountry || selectedCity) && (
            <button
              onClick={handleBack}
              className="self-start flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition-colors px-3 py-1.5 rounded border border-white/10"
            >
              {selectedCity ? "← País" : "← Mundo"}
            </button>
          )}
          <AirRightPanel
            selectedCountry={panelCountry}
            countryData={panelCountryData}
            selectedCity={selectedCity}
            allCountryData={countryData?.countries ?? {}}
            globalAvg={countryData?.globalAvg ?? globalStats.avg}
            globalMax={countryData?.globalMax ?? globalStats.max}
            globalMin={countryData?.globalMin ?? globalStats.min}
          />
        </MobileDrawer>

      </main>
    </div>
  )
}
