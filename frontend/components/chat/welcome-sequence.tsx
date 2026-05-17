"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  ShieldAlert, Flame, Wind, Gauge,
  Activity, TrendingUp, Navigation,
  MapPin, Building2, Newspaper,
} from "lucide-react"
import { CondorGuideAvatar } from "./condor-avatar"

type Phase = 'entry' | 'landing' | 'speaking' | 'idle'

const WELCOME_TEXT =
  "Hola, soy Newen. Estoy monitoreando incendios, calidad del aire y viento extremo en tiempo real. Cuéntame qué está pasando cerca de ti y te ayudaré paso a paso."

const TYPEWRITER_MS = 20

interface QuickCard {
  icon: LucideIcon
  accent: 'orange' | 'red' | 'blue' | 'cyan'
  title: string
  desc: string
  prompt: string
}

const CITIZEN_CARDS: QuickCard[] = [
  { icon: ShieldAlert, accent: 'orange', title: "Estoy en peligro ahora mismo", desc: "Evalúa riesgo inmediato y pasos de seguridad", prompt: "¿Estoy en peligro ahora mismo? ¿Qué debo hacer?" },
  { icon: Flame, accent: 'red', title: "Veo humo o fuego", desc: "Reporta señales y recibe instrucciones", prompt: "Veo humo o fuego cerca de mi ubicación, ¿qué hago?" },
  { icon: Gauge, accent: 'blue', title: "El aire se siente pesado", desc: "Consulta AQI y recomendaciones de salud", prompt: "El aire se siente pesado y difícil de respirar, ¿cuál es la calidad del aire?" },
  { icon: Wind, accent: 'cyan', title: "Hay viento extremo", desc: "Analiza riesgo de tormenta o tornado", prompt: "Hay viento extremo en mi zona, ¿cuál es el riesgo?" },
]

const EXPERT_CARDS: QuickCard[] = [
  { icon: Flame, accent: 'red', title: "Foco con mayor FRP", desc: "Identifica el incendio más intenso actualmente", prompt: "¿Cuál es el foco con mayor FRP actualmente?" },
  { icon: Activity, accent: 'orange', title: "Resumen operacional", desc: "Focos activos, AQI, condiciones de viento", prompt: "Resumen operacional: focos activos, AQI, viento" },
  { icon: TrendingUp, accent: 'cyan', title: "Predicción 6h y 24h", desc: "Propagación estimada y condiciones futuras", prompt: "Predicción 6h y 24h de propagación" },
  { icon: Navigation, accent: 'blue', title: "Rutas de evacuación", desc: "Estado de rutas activas y puntos de encuentro", prompt: "Rutas de evacuación activas y estado" },
]

const ACCENT: Record<string, { border: string; bg: string; text: string; glow: string; iconBg: string }> = {
  orange: { border: "border-orange-500/20 hover:border-orange-500/40", bg: "bg-orange-500/[0.04] hover:bg-orange-500/[0.08]", text: "text-orange-400", glow: "hover:shadow-[0_0_20px_rgba(249,115,22,0.08)]", iconBg: "bg-orange-500/10 border border-orange-500/20" },
  red:    { border: "border-red-500/20 hover:border-red-500/40",       bg: "bg-red-500/[0.04] hover:bg-red-500/[0.08]",       text: "text-red-400",    glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.08)]",   iconBg: "bg-red-500/10 border border-red-500/20" },
  blue:   { border: "border-blue-500/20 hover:border-blue-500/40",     bg: "bg-blue-500/[0.04] hover:bg-blue-500/[0.08]",     text: "text-blue-400",   glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]",  iconBg: "bg-blue-500/10 border border-blue-500/20" },
  cyan:   { border: "border-cyan-500/20 hover:border-cyan-500/40",     bg: "bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08]",     text: "text-cyan-400",   glow: "hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]",  iconBg: "bg-cyan-500/10 border border-cyan-500/20" },
}

const CONTEXT_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: MapPin,     label: "Ubicación" },
  { icon: Flame,      label: "Incendios activos" },
  { icon: Gauge,      label: "Calidad del aire" },
  { icon: Wind,       label: "Viento" },
  { icon: Newspaper,  label: "Noticias" },
  { icon: Building2,  label: "Infraestructura crítica" },
  { icon: Navigation, label: "Rutas de evacuación" },
]

interface Props {
  onSuggestion: (s: string) => void
  mode: 'citizen' | 'expert'
}

export function WelcomeSequence({ onSuggestion, mode }: Props) {
  const [phase, setPhase] = useState<Phase>('entry')
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('landing'), 1420)
    const t2 = setTimeout(() => setPhase('speaking'), 2050)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (phase !== 'speaking') return
    let idx = 0
    const id = setInterval(() => {
      idx++
      setDisplayed(WELCOME_TEXT.slice(0, idx))
      if (idx >= WELCOME_TEXT.length) {
        clearInterval(id)
        setTimeout(() => setPhase('idle'), 1500)
      }
    }, TYPEWRITER_MS)
    return () => clearInterval(id)
  }, [phase])

  const cards = mode === 'citizen' ? CITIZEN_CARDS : EXPERT_CARDS
  const subtitle = mode === 'citizen'
    ? "Describe humo, fuego, mala calidad del aire, viento extremo o una emergencia cercana."
    : "Consulta datos operacionales, predicciones de propagación y recursos de respuesta."

  const isCentered = phase !== 'idle'
  const condorStyle: React.CSSProperties = isCentered
    ? { top: '32px', left: '50%', transform: 'translateX(-50%)', width: '112px', height: '112px' }
    : { top: '0px',  left: '0px',  transform: 'none',           width: '48px',  height: '48px' }

  return (
    <div className="relative w-full" style={{ minHeight: '480px' }}>
      <div
        className="absolute z-20 transition-all ease-[cubic-bezier(0.34,1.15,0.64,1)]"
        style={{ transitionDuration: '960ms', ...condorStyle }}
      >
        <CondorGuideAvatar state={phase} />
      </div>

      <div className={cn(
        "absolute left-4 right-4 flex flex-col items-center transition-all duration-500 ease-out top-[190px]",
        phase === 'speaking' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
      )}>
        <div className="max-w-[500px] text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-cyan-400/25" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-cyan-400/45">Newen dice</span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-400/25" />
          </div>
          <p className="text-[13.5px] text-white/78 leading-[1.7] font-light tracking-[0.01em]">
            {displayed}
            <span className="inline-block w-[2px] h-[14px] bg-cyan-400/85 ml-[3px] align-middle animate-pulse rounded-full" />
          </p>
        </div>
      </div>

      <div className={cn(
        "absolute left-0 right-0 transition-all duration-700 ease-out top-[56px]",
        phase === 'idle' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
      )}>
        <div className="ml-[62px] mb-5">
          <h2 className="text-[17px] font-black text-white tracking-tight leading-tight">¿Cómo puedo ayudarte hoy?</h2>
          <p className="text-white/38 text-[11px] mt-1 leading-relaxed max-w-xs">{subtitle}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
          {cards.map((card) => {
            const a = ACCENT[card.accent]
            const Icon = card.icon
            return (
              <button
                key={card.title}
                onClick={() => onSuggestion(card.prompt)}
                className={cn("flex items-start gap-3 text-left p-4 rounded-xl border transition-all duration-200", a.border, a.bg, a.glow)}
              >
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", a.iconBg)}>
                  <Icon className={cn("w-5 h-5", a.text)} />
                </div>
                <div>
                  <p className="text-white/90 text-xs font-bold leading-snug mb-1">{card.title}</p>
                  <p className="text-white/35 text-[11px] leading-relaxed">{card.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        <div className="w-full max-w-2xl mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-white/[0.05]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">Contexto operacional</span>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {CONTEXT_CHIPS.map(({ icon: ChipIcon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.07] bg-white/[0.03] text-white/25">
                <ChipIcon className="w-3 h-3" />
                <span className="text-[10px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
