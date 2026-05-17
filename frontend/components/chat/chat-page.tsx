"use client"

import { useState, useRef, useEffect } from "react"
import {
  User, Briefcase, ShieldAlert, Flame, Wind, Gauge,
  MapPin, Building2, Navigation, Newspaper, Activity, TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import Image from "next/image"
import { TopBar } from "@/components/dashboard/top-bar"
import { useSentinel } from "@/contexts/sentinel-context"
import { MessageBubble, type Message } from "./message-bubble"
import { ChatInput } from "./chat-input"
import { cn } from "@/lib/utils"

type ChatMode = 'citizen' | 'expert'
const MODE_LS_KEY = 'sentinel_chat_mode'

interface QuickCard {
  icon: LucideIcon
  accent: 'orange' | 'red' | 'blue' | 'cyan'
  title: string
  desc: string
  prompt: string
}

const CITIZEN_CARDS: QuickCard[] = [
  {
    icon: ShieldAlert,
    accent: 'orange',
    title: "Estoy en peligro ahora mismo",
    desc: "Evalúa riesgo inmediato y pasos de seguridad",
    prompt: "¿Estoy en peligro ahora mismo? ¿Qué debo hacer?",
  },
  {
    icon: Flame,
    accent: 'red',
    title: "Veo humo o fuego",
    desc: "Reporta señales y recibe instrucciones",
    prompt: "Veo humo o fuego cerca de mi ubicación, ¿qué hago?",
  },
  {
    icon: Gauge,
    accent: 'blue',
    title: "El aire se siente pesado",
    desc: "Consulta AQI y recomendaciones de salud",
    prompt: "El aire se siente pesado y difícil de respirar, ¿cuál es la calidad del aire?",
  },
  {
    icon: Wind,
    accent: 'cyan',
    title: "Hay viento extremo",
    desc: "Analiza riesgo de tormenta o tornado",
    prompt: "Hay viento extremo en mi zona, ¿cuál es el riesgo?",
  },
]

const EXPERT_CARDS: QuickCard[] = [
  {
    icon: Flame,
    accent: 'red',
    title: "Foco con mayor FRP",
    desc: "Identifica el incendio más intenso actualmente",
    prompt: "¿Cuál es el foco con mayor FRP actualmente?",
  },
  {
    icon: Activity,
    accent: 'orange',
    title: "Resumen operacional",
    desc: "Focos activos, AQI, condiciones de viento",
    prompt: "Resumen operacional: focos activos, AQI, viento",
  },
  {
    icon: TrendingUp,
    accent: 'cyan',
    title: "Predicción 6h y 24h",
    desc: "Propagación estimada y condiciones futuras",
    prompt: "Predicción 6h y 24h de propagación",
  },
  {
    icon: Navigation,
    accent: 'blue',
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

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ChatPage() {
  const { sentinelUpdate } = useSentinel()
  const [mode, setMode] = useState<ChatMode>('citizen')

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_LS_KEY)
      if (stored === 'citizen' || stored === 'expert') setMode(stored)
    } catch { /* localStorage unavailable */ }
  }, [])

  const updateMode = (next: ChatMode) => {
    setMode(next)
    try { window.localStorage.setItem(MODE_LS_KEY, next) } catch { /* non-critical */ }
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [newsArticles, setNewsArticles] = useState<Array<{ title: string; snippet?: string; source: string; publishedAt: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/news', { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setNewsArticles(d.articles ?? []))
      .catch(() => {})
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const sendMessage = async (content: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: Message = { id: makeId(), role: 'user', content, timestamp: new Date() }
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    const assistantId = makeId()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history, sentinelSnapshot: sentinelUpdate, newsArticles, mode }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error('stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const token: string = parsed.choices?.[0]?.delta?.content ?? ''
            if (token) {
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: m.content + token } : m)
              )
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, content: 'Error al conectar con SENTINEL AI. Verifique la conexión.' }
              : m
          )
        )
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsStreaming(false)
      }
    }
  }

  const clearHistory = () => {
    abortRef.current?.abort()
    setMessages([])
  }

  const lastMessageIsStreaming =
    isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant'

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 min-h-0">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 py-4 border-b border-white/[0.06] shrink-0">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-cyan-500/15 blur-lg scale-125 animate-pulse pointer-events-none" />
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-cyan-500/25 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
              <Image src="/condor.png" alt="SENTINEL AI" fill className="object-cover object-top" />
            </div>
          </div>

          <div>
            <h1 className="text-white font-black tracking-[0.2em] text-sm uppercase">SENTINEL AI</h1>
            <p className="text-white/35 text-[10px] tracking-wider mt-0.5">
              Asistente operativo para emergencias ambientales
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-emerald-400/70">Sistema activo</span>
            </div>

            <div
              className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5"
              role="radiogroup"
              aria-label="Modo de respuesta"
            >
              {(['citizen', 'expert'] as ChatMode[]).map(m => {
                const Icon = m === 'citizen' ? User : Briefcase
                const label = m === 'citizen' ? 'Ciudadano' : 'Experto'
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => updateMode(m)}
                    className={cn(
                      "flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-md font-bold uppercase tracking-widest transition-all duration-200",
                      mode === m
                        ? "bg-orange-500/15 text-orange-300 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.1)]"
                        : "text-white/30 hover:text-white/60"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0">
          {messages.length === 0 && (
            <WelcomeScreen onSuggestion={sendMessage} mode={mode} />
          )}
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={lastMessageIsStreaming && i === messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={sendMessage} onClear={clearHistory} disabled={isStreaming} />
      </div>
    </div>
  )
}

function WelcomeScreen({
  onSuggestion,
  mode,
}: {
  onSuggestion: (s: string) => void
  mode: ChatMode
}) {
  const cards = mode === 'citizen' ? CITIZEN_CARDS : EXPERT_CARDS
  const subtitle = mode === 'citizen'
    ? "Describe humo, fuego, mala calidad del aire, viento extremo o una emergencia cercana."
    : "Consulta datos operacionales, predicciones de propagación y recursos de respuesta."

  return (
    <div className="flex flex-col items-center pt-6 pb-4 gap-7">

      {/* Premium condor avatar with glow rings */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-2xl scale-[2.5] pointer-events-none" />
        <div className="absolute inset-0 rounded-full bg-cyan-500/12 blur-xl scale-[1.6] pointer-events-none" />
        <div className="relative w-24 h-24 rounded-full overflow-hidden border border-cyan-500/25 shadow-[0_0_50px_rgba(34,211,238,0.15),inset_0_0_20px_rgba(34,211,238,0.04)]">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin pointer-events-none z-10"
            style={{ borderTopColor: 'rgba(249,115,22,0.4)', animationDuration: '8s' }}
          />
          <div
            className="absolute inset-1 rounded-full border border-transparent animate-spin pointer-events-none z-10"
            style={{ borderTopColor: 'rgba(34,211,238,0.3)', animationDuration: '12s', animationDirection: 'reverse' }}
          />
          <Image src="/condor.png" alt="SENTINEL AI" fill className="object-cover object-top relative z-0" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-black text-white tracking-tight">¿Qué está ocurriendo cerca de ti?</h2>
        <p className="text-white/40 text-sm max-w-md leading-relaxed">{subtitle}</p>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
        {cards.map((card) => {
          const a = ACCENT[card.accent]
          const Icon = card.icon
          return (
            <button
              key={card.title}
              onClick={() => onSuggestion(card.prompt)}
              className={cn(
                "flex items-start gap-3 text-left p-4 rounded-xl border transition-all duration-200",
                a.border, a.bg, a.glow
              )}
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

      {/* Context chips */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">
            Contexto que puedo analizar
          </span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {CONTEXT_CHIPS.map(({ icon: ChipIcon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.07] bg-white/[0.03] text-white/25"
            >
              <ChipIcon className="w-3 h-3" />
              <span className="text-[10px] font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
