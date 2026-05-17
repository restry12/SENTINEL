"use client"

import { useState } from "react"
import { Bot, User, Volume2, Loader2, VolumeX } from "lucide-react"
import Image from "next/image"
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
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  const handlePlayAudio = async () => {
    // Si ya está reproduciendo, detenerlo
    if (isPlaying) {
      if (audioEl) {
        audioEl.pause()
        audioEl.currentTime = 0
      }
      window.speechSynthesis.cancel()
      setIsPlaying(false)
      return
    }

    setIsLoadingAudio(true)

    try {
      // Intentar usar MiniMax
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message.content })
      })

      if (response.ok) {
        const blob = await response.blob()
        const audio = new Audio(URL.createObjectURL(blob))
        setAudioEl(audio)
        audio.onended = () => setIsPlaying(false)
        audio.play()
        setIsPlaying(true)
        setIsLoadingAudio(false)
        return
      }
    } catch (e) {
      console.error("Error con MiniMax:", e)
    }
    
    setIsLoadingAudio(false)
  }

  return (
    <div className={cn("flex flex-col gap-1.5", isUser && "items-end")}>
      {/* Label row */}
      <div className={cn("flex items-center gap-1.5 px-1", isUser && "flex-row-reverse")}>
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 overflow-hidden",
          isUser
            ? "bg-orange-500/15 border border-orange-500/30"
            : "border border-cyan-500/25 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
        )}>
          {isUser
            ? <User className="w-2.5 h-2.5 text-orange-400" />
            : <Image src="/condor.png" alt="SENTINEL AI" width={20} height={20} className="object-cover object-top w-full h-full" />
          }
        </div>
        <span className={cn(
          "text-[9px] font-bold uppercase tracking-[0.15em]",
          isUser ? "text-orange-400/50" : "text-cyan-400/50"
        )}>
          {isUser ? "Tú" : "SENTINEL AI"}
        </span>
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed relative group",
        isUser
          ? "bg-[#1a0f02] border border-orange-500/20 text-white shadow-[0_0_24px_rgba(249,115,22,0.07)] rounded-tr-sm"
          : "bg-[#040d18] border border-cyan-500/15 text-white/90 shadow-[0_0_24px_rgba(34,211,238,0.05)] rounded-tl-sm"
      )}>
        {message.content
          ? isUser
            ? message.content
            : <MarkdownContent text={message.content} />
          : isStreaming
            ? <AnalyzingIndicator />
            : null
        }
        {isStreaming && message.content && (
          <span className="inline-block w-[2px] h-3.5 bg-cyan-400/70 ml-1 animate-pulse align-middle rounded-full" />
        )}

        {/* Audio Button */}
        {!isUser && !isStreaming && message.content && (
          <button 
            onClick={handlePlayAudio}
            disabled={isLoadingAudio}
            className={cn(
              "absolute -right-2 -bottom-2 flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-300",
              "bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300",
              "shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:shadow-[0_0_20px_rgba(34,211,238,0.25)]",
              "opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0",
              isLoadingAudio && "opacity-100 translate-y-0"
            )}
            title="Escuchar respuesta"
          >
            {isLoadingAudio ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isPlaying ? (
              <VolumeX className="w-3 h-3" />
            ) : (
              <Volume2 className="w-3 h-3" />
            )}
            <span className="text-[9px] font-bold uppercase tracking-widest">
              {isLoadingAudio ? "Cargando" : isPlaying ? "Parar" : "Escuchar"}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

// Renders the subset of markdown Mistral produces: headings, bold, bullets, links.
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const output: React.ReactNode[] = []
  let pending: string[] = []
  let key = 0

  const flushList = () => {
    if (pending.length === 0) return
    output.push(
      <ul key={key++} className="my-1.5 ml-1 space-y-1">
        {pending.map((item, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="text-orange-400/70 mt-0.5 shrink-0">•</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    pending = []
  }

  for (const line of lines) {
    if (/^#{1,3} /.test(line)) {
      flushList()
      const heading = line.replace(/^#{1,3} /, '')
      output.push(
        <p key={key++} className="font-semibold text-white mt-3 mb-0.5 first:mt-0">
          {renderInline(heading)}
        </p>
      )
    } else if (/^[-*] /.test(line)) {
      pending.push(line.slice(2))
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      output.push(<p key={key++} className="my-0.5">{renderInline(line)}</p>)
    }
  }
  flushList()

  return <div className="space-y-0.5">{output}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer"
               className="text-orange-400 underline underline-offset-2 hover:text-orange-300">
              {link[1]}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function AnalyzingIndicator() {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400/50 animate-bounce"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono tracking-[0.15em] text-cyan-400/40 uppercase">
        Analizando situación
      </span>
    </div>
  )
}
