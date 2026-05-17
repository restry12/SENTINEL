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

import { WelcomeSequence } from "./welcome-sequence"
import { CondorGuideAvatar } from "./condor-avatar"

type ChatMode = 'citizen' | 'expert'
const MODE_LS_KEY = 'sentinel_chat_mode'

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
            <div className="relative w-10 h-10">
              <CondorGuideAvatar state="idle" />
            </div>
          </div>

          <div>
            <h1 className="text-white font-black tracking-[0.2em] text-sm uppercase">NEWEN AI</h1>
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
            <WelcomeSequence onSuggestion={sendMessage} mode={mode} />
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

      {/* Video fijo — derecha */}
      <div
        className="fixed right-4 bottom-16 pointer-events-none select-none"
        style={{ zIndex: 50, width: 260 }}
      >
        <video
          src="/newen-right.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
    </div>
  )
}

