"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, Zap, Newspaper, Activity, User, Briefcase } from "lucide-react"
import { TopBar } from "@/components/dashboard/top-bar"
import { useSentinel } from "@/contexts/sentinel-context"
import { MessageBubble, type Message } from "./message-bubble"
import { ChatInput } from "./chat-input"

type ChatMode = 'citizen' | 'expert'
const MODE_LS_KEY = 'sentinel_chat_mode'

const CITIZEN_SUGGESTIONS = [
  "¿Estoy en peligro ahora mismo?",
  "¿Qué hago si veo humo cerca de mi casa?",
  "¿Es seguro que mis hijos salgan a jugar hoy?",
  "¿Cuándo se espera que mejore el aire?",
]

const EXPERT_SUGGESTIONS = [
  "¿Cuál es el foco con mayor FRP actualmente?",
  "Resumen operacional: focos activos, AQI, viento",
  "Predicción 6h y 24h de propagación",
  "Rutas de evacuación activas y estado",
]

// crypto.randomUUID requires a secure context (HTTPS/localhost) and is missing
// on older mobile Safari. Fall back to a timestamp+random ID so dev on a LAN IP
// or older browsers still work.
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
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, [])

  const updateMode = (next: ChatMode) => {
    setMode(next)
    try {
      window.localStorage.setItem(MODE_LS_KEY, next)
    } catch {
      /* non-critical */
    }
  }

  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [newsArticles, setNewsArticles] = useState<Array<{ title: string; snippet?: string; source: string; publishedAt: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Tracks the in-flight fetch so we can abort on unmount or when the user
  // clears the conversation mid-stream — avoids "setState on unmounted"
  // warnings and stops wasting OpenRouter tokens.
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

  // Abort any in-flight chat stream when the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), [])

  const sendMessage = async (content: string) => {
    // Cancel any prior in-flight stream before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMsg: Message = {
      id: makeId(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    const assistantId = makeId()
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          history,
          sentinelSnapshot: sentinelUpdate,
          newsArticles,
          mode,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error('stream failed')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      // SSE buffer: TCP chunks can split a JSON line in half. We keep the
      // trailing incomplete line in `buffer` and prepend it to the next chunk.
      // Without this, JSON.parse fails on partial lines and tokens are lost.
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''   // last item may be incomplete — save for next iteration

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const token: string = parsed.choices?.[0]?.delta?.content ?? ''
            if (token) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m
                )
              )
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      // AbortError = intentional cancel (unmount / clear / new send). Leave
      // any partial text in place and don't surface a fake error to the user.
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

  const hasLiveData = !!sentinelUpdate
  const hasNews = newsArticles.length > 0
  const lastMessageIsStreaming =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === 'assistant'

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <TopBar />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 min-h-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 py-4 border-b border-white/10 shrink-0 flex-wrap">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Bot className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-white font-black tracking-widest text-sm uppercase">SENTINEL AI</h1>
            <p className="text-white/40 text-[10px] tracking-wider uppercase">
              {mode === 'citizen'
                ? 'Te ayudo a entender qué pasa y qué hacer'
                : 'Analista operacional · datos en vivo, predicción, rutas'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <div
              className="flex items-center rounded-md border border-white/10 bg-white/5 p-0.5"
              role="tablist"
              aria-label="Modo de respuesta"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'citizen'}
                onClick={() => updateMode('citizen')}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                  mode === 'citizen'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <User className="w-3 h-3" />
                Ciudadano
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'expert'}
                onClick={() => updateMode('expert')}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                  mode === 'expert'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <Briefcase className="w-3 h-3" />
                Experto
              </button>
            </div>
            {hasLiveData && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-orange-500/30 text-orange-400/80 bg-orange-500/5 font-mono">
                <Activity className="w-3 h-3" />
                Datos en vivo
              </span>
            )}
            {hasNews && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 text-blue-400/80 bg-blue-500/5 font-mono">
                <Newspaper className="w-3 h-3" />
                Noticias
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/30 bg-white/5 font-mono">
              <Zap className="w-3 h-3" />
              Mistral Large
            </span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6 min-h-0">
          {messages.length === 0 && (
            <WelcomeScreen onSuggestion={sendMessage} />
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

        <ChatInput
          onSend={sendMessage}
          onClear={clearHistory}
          disabled={isStreaming}
        />
      </div>
    </div>
  )
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
        <Bot className="w-8 h-8 text-orange-400" />
      </div>
      <div>
        <p className="text-white/70 text-sm">¿En qué puedo ayudarte hoy?</p>
        <p className="text-white/30 text-xs mt-1">Tengo acceso a datos en vivo, noticias y conocimiento operacional</p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
        {CITIZEN_SUGGESTIONS.map(s => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="text-left text-xs px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
