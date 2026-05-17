"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
  ShieldAlert, Flame, Wind, Gauge,
  Activity, TrendingUp, Navigation,
  MapPin, Building2, Newspaper,
} from "lucide-react"
import { CondorGuideAvatar, type CondorState } from "./condor-avatar"

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
  {
    icon: ShieldAlert, accent: 'orange',
    title: "Estoy en peligro ahora mismo",
    desc: "Evalúa riesgo inmediato y pasos de seguridad",
    prompt: "¿Estoy en peligro ahora mismo? ¿Qué debo hacer?",
  },
  {
    icon: Flame, accent: 'red',
    title: "Veo humo o fuego",
    desc: "Reporta señales y recibe instrucciones",
    prompt: "Veo humo o fuego cerca de mi ubicación, ¿qué hago?",
  },
  {
    icon: Gauge, accent: 'blue',
    title: "El aire se siente pesado",
    desc: "Consulta AQI y recomendaciones de salud",
    prompt: "El aire se siente pesado y difícil de respirar, ¿cuál es la calidad del aire?",
  },
  {
    icon: Wind, accent: 'cyan',
    title: "Hay viento extremo",
    desc: "Analiza riesgo de tormenta o tornado",
    prompt: "Hay viento extremo en mi zona, ¿cuál es el riesgo?",
  },
]

const EXPERT_CARDS: QuickCard[] = [
  {
    icon: Flame, accent: 'red',
    title: "Foco con mayor FRP",
    desc: "Identifica el incendio más intenso actualmente",
    prompt: "¿Cuál es el foco con mayor FRP actualmente?",
  },
  {
    icon: Activity, accent: 'orange',
    title: "Resumen operacional",
    desc: "Focos activos, AQI, condiciones de viento",
    prompt: "Resumen operacional: focos activos, AQI, viento",
  },
  {
    icon: TrendingUp, accent: 'cyan',
    title: "Predicción 6h y 24h",
    desc: "Propagación estimada y condiciones futuras",
    prompt: "Predicción 6h y 24h de propagación",
  },
  {
    icon: Navigation, accent: 'blue',
    title: "Rutas de evacuación",
    desc: "Estado de rutas activas y puntos de encuentro",
    prompt: "Rutas de evacuación activas y estado",
  },
]

const ACCENT: Record<string, { border: string; bg: string; text: string; glow: string; iconBg: string }> = {
  orange: {
    border: "border-orange-500/20 hover:border-orange-500/40",
    bg: "bg-orange-500/[0.04] hover:bg-orange-500/[0.08]",
    text: "text-orange-400",
    glow: "hover:shadow-[0_0_20px_rgba(249,115,22,0.08)]",
    iconBg: "bg-orange-500/10 border border-orange-500/20",
  },
  red: {
    border: "border-red-500/20 hover:border-red-500/40",
    bg: "bg-red-500/[0.04] hover:bg-red-500/[0.08]",
    text: "text-red-400",
    glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.08)]",
    iconBg: "bg-red-500/10 border border-red-500/20",
  },
  blue: {
    border: "border-blue-500/20 hover:border-blue-500/40",
    bg: "bg-blue-500/[0.04] hover:bg-blue-500/[0.08]",
    text: "text-blue-400",
    glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.08)]",
    iconBg: "bg-blue-500/10 border border-blue-500/20",
  },
  cyan: {
    border: "border-cyan-500/20 hover:border-cyan-500/40",
    bg: "bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08]",
    text: "text-cyan-400",
    glow: "hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]",
    iconBg: "bg-cyan-500/10 border border-cyan-500/20",
  },
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
  const [phase, setPhase] = useState<CondorState>('entry')
  const [displayed, setDisplayed] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Phase transitions: entry (flying) -> landing -> speaking -> idle
  useEffect(() => {
    const parent = containerRef.current?.parentElement
    
    if (phase === 'entry') {
      if (parent) {
        parent.scrollTop = 0
        parent.style.overflow = 'hidden'
      }
    } else if (phase === 'idle' || phase === 'speaking') {
      if (parent) {
        parent.style.overflow = 'auto'
      }
    }

    const t1 = setTimeout(() => setPhase('landing'), 3000)
    const t2 = setTimeout(() => setPhase('speaking'), 4500)
    return () => { 
      clearTimeout(t1)
      clearTimeout(t2)
      if (parent) parent.style.overflow = 'auto'
    }
  }, [phase])

  // Typewriter effect during speaking phase
  useEffect(() => {
    if (phase !== 'speaking') return
    let idx = 0
    const id = setInterval(() => {
      idx++
      setDisplayed(WELCOME_TEXT.slice(0, idx))
      if (idx >= WELCOME_TEXT.length) {
        clearInterval(id)
        // Stay in speaking for a bit then go idle
        setTimeout(() => setPhase('idle'), 1500)
      }
    }, TYPEWRITER_MS)
    return () => clearInterval(id)
  }, [phase])

  const cards = mode === 'citizen' ? CITIZEN_CARDS : EXPERT_CARDS
  const subtitle = mode === 'citizen'
    ? "Describe humo, fuego, mala calidad del aire, viento extremo o una emergencia cercana."
    : "Consulta datos operacionales, predicciones de propagación y recursos de respuesta."

  const isCentered = phase === 'entry' || phase === 'landing' || phase === 'speaking'

  // Animate position: Center (flying/landing) -> Side (idle)
  const condorStyle: React.CSSProperties = phase === 'entry'
    ? { width: '128px', height: '128px' } // Let CSS animation handle position during flight
    : isCentered
      ? { top: '64px', left: 'calc(50% - 64px)', width: '128px', height: '128px' }
      : { top: '0px',  left: '0px',              width: '48px',  height: '48px'  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden",
        phase === 'entry' ? "h-[500px] pointer-events-none" : "min-h-[500px]"
      )}
      style={{ contain: 'paint' }}
    >
      
      {/* ── Persistent Side Newen (Video 3) ── */}
      <div className={cn(
        "absolute right-0 top-1/2 -translate-y-1/2 w-48 h-80 z-10 transition-all duration-1000",
        phase === 'idle' ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
      )}>
        <video
          src="/newen-loop.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain mix-blend-screen"
        />
      </div>

      {/* ── Cóndi Avatar ── */}
      <div
        className={cn(
          "absolute z-20",
          phase === 'entry' && "condor-diagonal-fly"
        )}
        style={{
          transition: phase === 'entry' ? 'none' : 'all 1200ms cubic-bezier(0.34,1.56,0.64,1)',
          ...condorStyle,
        }}
      >
        <CondorGuideAvatar state={phase} />
      </div>

      {/* ── Welcome Text ── */}
      <div className={cn(
        "absolute left-4 right-4 flex flex-col items-center transition-all duration-800 ease-out",
        "top-[220px]",
        phase === 'speaking'
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}>
        <div className="max-w-[500px] text-center bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-white/5 shadow-2xl">
          <p className="text-[15px] text-white/90 leading-relaxed font-medium">
            {displayed}
            <span className="inline-block w-[3px] h-[16px] bg-cyan-400 ml-1 animate-pulse" />
          </p>
        </div>
      </div>

      {/* ── Menu/Grid (shown in Idle phase) ── */}
      <div className={cn(
        "absolute left-0 right-0 transition-all duration-1000 ease-out",
        "top-[64px]",
        phase === 'idle'
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-8 pointer-events-none'
      )}>
        {/* Header offset to make space for the side-positioned condor */}
        <div className="ml-[64px] mb-8">
          <h2 className="text-2xl font-black text-white tracking-tight">
            ¿Cómo puedo ayudarte hoy?
          </h2>
          <p className="text-white/40 text-xs mt-1.5 max-w-sm">{subtitle}</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
          {cards.map((card) => {
            const a = ACCENT[card.accent]
            const Icon = card.icon
            return (
              <button
                key={card.title}
                onClick={() => onSuggestion(card.prompt)}
                className={cn(
                  "flex items-start gap-4 text-left p-5 rounded-2xl border transition-all duration-300",
                  a.border, a.bg, a.glow,
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-lg", a.iconBg)}>
                  <Icon className={cn("w-6 h-6", a.text)} />
                </div>
                <div>
                  <p className="text-white/90 text-sm font-bold leading-tight mb-1.5">{card.title}</p>
                  <p className="text-white/30 text-[11px] leading-relaxed">{card.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Context Chips */}
        <div className="w-full max-w-2xl mt-10">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/20">
              Contexto operacional
            </span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {CONTEXT_CHIPS.map(({ icon: ChipIcon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] text-white/30 hover:bg-white/[0.08] transition-colors cursor-default"
              >
                <ChipIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
