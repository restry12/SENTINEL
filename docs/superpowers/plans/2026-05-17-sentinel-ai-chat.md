# SENTINEL AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/chat` page where operators can talk to SENTINEL AI — a Mistral Large–powered analyst that has full context of live fire data, AQI, authority reports, and recent news.

**Architecture:** Next.js API route `POST /api/chat` (Edge runtime) handles all OpenRouter calls server-side (API key never reaches the client) and streams the response back as SSE. The client reads the stream with a line buffer to safely handle chunks split mid-JSON, rendering tokens for a live "typing" effect. Context (SentinelUpdate snapshot + news articles) is serialized by the client and sent in the request body so the system prompt is always fresh.

**Tech Stack:** Next.js 16 App Router (Edge runtime for chat route), React 19, TypeScript, Tailwind v4, OpenRouter (`mistralai/mistral-large`), Web Streams API (ReadableStream), Lucide React icons, existing `useSentinel` context.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/app/chat/page.tsx` | Route entry — AuthGuard wrapper |
| Create | `frontend/app/api/chat/route.ts` | POST handler — builds system prompt, streams OpenRouter |
| Create | `frontend/components/chat/chat-page.tsx` | Client component — state, streaming logic, layout |
| Create | `frontend/components/chat/message-bubble.tsx` | Single message bubble (user or AI) |
| Create | `frontend/components/chat/chat-input.tsx` | Input field + send button + clear button |
| Modify | `frontend/contexts/language-context.tsx` | Add `navChat` key (es + en) |
| Modify | `frontend/components/dashboard/top-bar.tsx` | Add `/chat` link to nav array |

---

## Task 1: API route — streaming chat endpoint

**Files:**
- Create: `frontend/app/api/chat/route.ts`

- [ ] **Step 1: Create the file with types and system prompt builder**

```typescript
// frontend/app/api/chat/route.ts
import { NextRequest } from 'next/server'

// Edge runtime — supports long-running streaming responses and avoids
// the 10s serverless timeout on Vercel Hobby. Compatible: only uses
// fetch, Web Streams, and process.env (all available on Edge).
export const runtime = 'edge'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface FireData {
  lat: number
  lon: number
  frp: number
  brightness: number
  timestamp: string
}

interface SentinelSnapshot {
  timestamp: string
  fires: FireData[]
  airQuality: { pm25: number; aqi: number; category: string }
  riskLevel: string
  riskAssessment?: { zona_afectada: string; resumen: string }
  report?: {
    nivel_emergencia: string
    poblacion_en_riesgo_estimada: number
    resumen_ejecutivo: string
    acciones_inmediatas: string[]
    zonas_evacuacion_prioritaria: string[]
  }
  naturalRoutes?: {
    punto_encuentro_principal: string
    rutas: Array<{ nombre: string; estado: string; distancia_km: number }>
  }
  prediction?: {
    analisis_6h: string
    analisis_24h: string
    analisis_72h: string
    confianza: string
  }
}

interface NewsArticle {
  title: string
  snippet?: string
  source: string
  publishedAt: string
}

interface ChatRequest {
  message: string
  history: ChatMessage[]
  sentinelSnapshot: SentinelSnapshot | null
  newsArticles: NewsArticle[]
}

function buildSystemPrompt(snapshot: SentinelSnapshot | null, news: NewsArticle[]): string {
  let prompt = `Eres SENTINEL AI, analista operacional del sistema SENTINEL de monitoreo de incendios forestales en Chile. Respondes exclusivamente en español. Tono: directo, técnico, conciso — como un oficial de emergencias. Sin saludos innecesarios. Sin rodeos. Usa listas cuando ayudan a la claridad.`

  if (snapshot) {
    const frpMax = snapshot.fires.length > 0
      ? Math.max(...snapshot.fires.map(f => f.frp)).toFixed(1)
      : '0'

    prompt += `\n\n## DATOS EN VIVO [${snapshot.timestamp}]\n`
    prompt += `- Focos activos: ${snapshot.fires.length}\n`
    prompt += `- FRP máximo: ${frpMax} MW\n`
    prompt += `- AQI: ${snapshot.airQuality.aqi} — ${snapshot.airQuality.category}\n`
    prompt += `- PM2.5: ${snapshot.airQuality.pm25} µg/m³\n`
    prompt += `- Nivel de riesgo: ${snapshot.riskLevel.toUpperCase()}\n`

    if (snapshot.riskAssessment) {
      prompt += `- Zona afectada: ${snapshot.riskAssessment.zona_afectada}\n`
      prompt += `- Evaluación: ${snapshot.riskAssessment.resumen}\n`
    }

    if (snapshot.report) {
      prompt += `\n## REPORTE DE AUTORIDAD\n`
      prompt += `- Nivel emergencia: ${snapshot.report.nivel_emergencia}\n`
      prompt += `- Población en riesgo: ${snapshot.report.poblacion_en_riesgo_estimada?.toLocaleString('es-CL')}\n`
      prompt += `- Resumen ejecutivo: ${snapshot.report.resumen_ejecutivo}\n`
      if (snapshot.report.acciones_inmediatas?.length) {
        prompt += `- Acciones inmediatas: ${snapshot.report.acciones_inmediatas.join(' | ')}\n`
      }
      if (snapshot.report.zonas_evacuacion_prioritaria?.length) {
        prompt += `- Zonas evacuación: ${snapshot.report.zonas_evacuacion_prioritaria.join(', ')}\n`
      }
    }

    if (snapshot.naturalRoutes) {
      prompt += `\n## RUTAS DE EVACUACIÓN\n`
      prompt += `- Punto de encuentro: ${snapshot.naturalRoutes.punto_encuentro_principal}\n`
      snapshot.naturalRoutes.rutas.slice(0, 4).forEach(r => {
        prompt += `- ${r.nombre}: ${r.estado} (${r.distancia_km} km)\n`
      })
    }

    if (snapshot.prediction) {
      prompt += `\n## PREDICCIÓN DE RIESGO\n`
      prompt += `- 6h: ${snapshot.prediction.analisis_6h}\n`
      prompt += `- 24h: ${snapshot.prediction.analisis_24h}\n`
      prompt += `- 72h: ${snapshot.prediction.analisis_72h}\n`
      prompt += `- Confianza: ${snapshot.prediction.confianza}\n`
    }
  } else {
    prompt += `\n\n## DATOS EN VIVO\nNo hay datos en vivo disponibles. Responde con tu conocimiento general sobre incendios forestales, protocolos de evacuación y calidad del aire.`
  }

  if (news.length > 0) {
    prompt += `\n\n## NOTICIAS RECIENTES (Chile)\n`
    news.slice(0, 8).forEach((n, i) => {
      prompt += `${i + 1}. [${n.source}] ${n.title}${n.snippet ? ` — ${n.snippet}` : ''}\n`
    })
  }

  return prompt
}
```

- [ ] **Step 2: Add the POST handler with streaming**

Append to the same file:

```typescript
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body: ChatRequest = await req.json()
    const { message, history, sentinelSnapshot, newsArticles } = body

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'message required' }), { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(sentinelSnapshot, newsArticles ?? [])

    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ]

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinel.vercel.app',
        'X-Title': 'SENTINEL',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.3,
        stream: true,
      }),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      console.error('OpenRouter error:', err)
      return new Response(JSON.stringify({ error: 'upstream error' }), { status: 502 })
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('Chat route error:', err)
    return new Response(JSON.stringify({ error: 'internal error' }), { status: 500 })
  }
}
```

- [ ] **Step 3: Manual test — verify route exists**

Start dev server (`pnpm dev` from `frontend/`). Then:

```bash
curl -X POST http://localhost:3010/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola","history":[],"sentinelSnapshot":null,"newsArticles":[]}' \
  --no-buffer
```

Expected: SSE stream with `data: {...}` lines ending in `data: [DONE]`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/chat/route.ts
git commit -m "feat(chat): add streaming POST /api/chat route with Mistral context injection"
```

---

## Task 2: Page entry point

**Files:**
- Create: `frontend/app/chat/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// frontend/app/chat/page.tsx
import { AuthGuard } from "@/components/auth-guard"
import { ChatPage } from "@/components/chat/chat-page"

export default function Chat() {
  return (
    <AuthGuard>
      <ChatPage />
    </AuthGuard>
  )
}
```

- [ ] **Step 2: Verify route resolves**

Navigate to `http://localhost:3010/chat`. Expected: no 404, page renders (even if ChatPage doesn't exist yet — Next.js will show a module-not-found error, not a 404).

---

## Task 3: MessageBubble component

**Files:**
- Create: `frontend/components/chat/message-bubble.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/components/chat/message-bubble.tsx
"use client"

import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser
          ? "bg-white/10 border border-white/20"
          : "bg-orange-500/20 border border-orange-500/40"
      )}>
        {isUser
          ? <User className="w-4 h-4 text-white/70" />
          : <Bot className="w-4 h-4 text-orange-400" />
        }
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-white/10 border border-white/10 text-white"
          : "bg-[#0d1420] border border-white/10 text-white/90"
      )}>
        {message.content
          ? message.content
          : isStreaming
            ? <StreamingDots />
            : null
        }
        {isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-orange-400/80 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}

function StreamingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-orange-400/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/chat/message-bubble.tsx
git commit -m "feat(chat): add MessageBubble component with streaming cursor"
```

---

## Task 4: ChatInput component

**Files:**
- Create: `frontend/components/chat/chat-input.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/components/chat/chat-input.tsx
"use client"

import { useState, useRef, type KeyboardEvent } from "react"
import { Send, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (message: string) => void
  onClear: () => void
  disabled: boolean
}

export function ChatInput({ onSend, onClear, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t border-white/10 py-4">
      <div className="flex items-end gap-3">
        {/* Clear button */}
        <button
          onClick={onClear}
          disabled={disabled}
          title="Nueva conversación"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            disabled={disabled}
            placeholder="Pregunta sobre la situación actual..."
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30",
              "focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20",
              "transition-colors disabled:opacity-50",
              "max-h-40 leading-relaxed"
            )}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            "w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-all",
            "bg-orange-500/80 hover:bg-orange-500 border border-orange-500/50",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            "text-white"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[10px] text-white/20 mt-2 text-center font-mono tracking-wide">
        SENTINEL AI · Mistral Large · Datos NASA FIRMS · Solo fines operacionales
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/chat/chat-input.tsx
git commit -m "feat(chat): add ChatInput component with auto-resize and Enter-to-send"
```

---

## Task 5: ChatPage — main client component

**Files:**
- Create: `frontend/components/chat/chat-page.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/components/chat/chat-page.tsx
"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, Zap, Newspaper, Activity } from "lucide-react"
import { TopBar } from "@/components/dashboard/top-bar"
import { useSentinel } from "@/contexts/sentinel-context"
import { MessageBubble, type Message } from "./message-bubble"
import { ChatInput } from "./chat-input"

const SUGGESTIONS = [
  "¿Cuál es el foco más peligroso ahora?",
  "¿Qué hacer si hay humo en mi zona?",
  "Resume la situación actual de incendios",
  "¿Cuáles son las rutas de evacuación activas?",
]

export function ChatPage() {
  const { sentinelUpdate } = useSentinel()
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [newsArticles, setNewsArticles] = useState<Array<{ title: string; snippet?: string; source: string; publishedAt: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(d => setNewsArticles(d.articles ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    const assistantId = crypto.randomUUID()
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
        }),
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
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Error al conectar con SENTINEL AI. Verifique la conexión.' }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const clearHistory = () => setMessages([])

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
        <div className="flex items-center gap-3 py-4 border-b border-white/10 shrink-0">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center">
            <Bot className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-white font-black tracking-widest text-sm uppercase">SENTINEL AI</h1>
            <p className="text-white/40 text-[10px] tracking-wider uppercase">Analista Operacional de Emergencias</p>
          </div>
          {/* Context chips */}
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            {hasLiveData && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-orange-500/30 text-orange-400/80 bg-orange-500/5 font-mono">
                <Activity className="w-3 h-3" />
                Datos en vivo
              </span>
            )}
            {hasNews && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-blue-500/30 text-blue-400/80 bg-blue-500/5 font-mono">
                <Newspaper className="w-3 h-3" />
                Noticias Chile
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
        {SUGGESTIONS.map(s => (
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
```

- [ ] **Step 2: Manual test — full flow**

Navigate to `http://localhost:3010/chat`.

Verify:
1. Welcome screen with 4 suggestion buttons renders
2. Click a suggestion → sends message, user bubble appears
3. AI bubble appears with streaming dots, then text fills in token-by-token
4. Orange cursor blinks at end of streaming response
5. After response, send another message — history is included (AI remembers context)
6. Click the ↺ button → messages clear, welcome screen returns
7. Context chips show "Datos en vivo" if socket is connected

- [ ] **Step 3: Commit**

```bash
git add frontend/components/chat/chat-page.tsx
git commit -m "feat(chat): add ChatPage with streaming, context chips, and welcome suggestions"
```

---

## Task 6: Wire up navigation

**Files:**
- Modify: `frontend/contexts/language-context.tsx`
- Modify: `frontend/components/dashboard/top-bar.tsx`

- [ ] **Step 1: Add `navChat` key to language context**

In `frontend/contexts/language-context.tsx`, find the `es` block (around line 14) and add:

```typescript
// After navNews line:
navChat:         'SENTINEL AI',
```

Find the `en` block (around line 157) and add:

```typescript
// After navNews line (or navAir if navNews missing in en):
navChat:         'SENTINEL AI',
```

- [ ] **Step 2: Add `/chat` to TopBar nav**

In `frontend/components/dashboard/top-bar.tsx`, find the nav array (around line 83):

```typescript
// BEFORE (existing array):
([
  { href: '/dashboard',         label: tx.navDashboard },
  { href: '/air',               label: tx.navAir },
  { href: '/news',              label: tx.navNews ?? 'Noticias' },
  { href: '/dashboard/citizen', label: 'Ciudadano' },
] as const)
```

```typescript
// AFTER (add chat entry):
([
  { href: '/dashboard',         label: tx.navDashboard },
  { href: '/air',               label: tx.navAir },
  { href: '/news',              label: tx.navNews ?? 'Noticias' },
  { href: '/chat',              label: tx.navChat ?? 'SENTINEL AI' },
  { href: '/dashboard/citizen', label: 'Ciudadano' },
] as const)
```

- [ ] **Step 3: Manual test — nav link works**

Verify "SENTINEL AI" appears in the TopBar nav on all pages. Click it → navigates to `/chat`. Active state (highlighted) appears when on `/chat`.

- [ ] **Step 4: Commit**

```bash
git add frontend/contexts/language-context.tsx frontend/components/dashboard/top-bar.tsx
git commit -m "feat(chat): add SENTINEL AI nav link to TopBar"
```

---

## Task 7: Final end-to-end verification

- [ ] **Step 1: Full flow test with live backend**

With backend running (`NEXT_PUBLIC_SOCKET_URL` pointing to live backend):

1. Log in → navigate to `/chat`
2. Context chips show "Datos en vivo" + "Noticias Chile"
3. Ask: "¿Cuál es el nivel de riesgo actual?"
   - Expected: AI answers with exact riskLevel from the live SentinelUpdate
4. Ask: "¿Hay noticias recientes sobre incendios?"
   - Expected: AI references articles from the news feed
5. Ask: "¿Qué protocolo seguir para evacuar?"
   - Expected: AI uses naturalRoutes data if available, plus general knowledge
6. Click ↺ → chat clears, ask again → AI has no memory of prior conversation ✓

- [ ] **Step 2: Test with no live data**

Stop the backend. Reload `/chat`. Context chips show only "Mistral Large". Ask a question. AI responds with general knowledge, no hallucinated live data.

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "feat(chat): complete SENTINEL AI chat page with streaming and live context"
```

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Backend offline, no SentinelUpdate | Chips show only "Mistral Large", system prompt says no live data |
| News API fails | `newsArticles` stays `[]`, no news context injected — no crash |
| OpenRouter returns non-200 | Client shows error message in AI bubble |
| User presses Enter on empty input | `handleSend` guards `!trimmed`, no request sent |
| Stream interrupted mid-response | `finally` block sets `isStreaming = false`, partial text stays visible |
| Very long AI response | Textarea auto-scrolls via `messagesEndRef` |
