// frontend/components/chat/message-bubble.tsx
"use client"

import { useState } from "react"
import { Bot, User, Volume2, Loader2, VolumeX } from "lucide-react"
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
      console.error("Error con MiniMax, usando fallback:", e)
    }

    // Fallback nativo (si MiniMax falla o no tiene API KEY)
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message.content)
      utterance.lang = 'es-ES' // O 'es-CL'
      utterance.onend = () => setIsPlaying(false)
      window.speechSynthesis.speak(utterance)
      setIsPlaying(true)
    }
    
    setIsLoadingAudio(false)
  }

  return (
    <div className={cn("flex gap-3 items-start group", isUser && "flex-row-reverse")}>
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
        "max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed relative",
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

        {/* Audio Button */}
        {!isUser && !isStreaming && message.content && (
          <button 
            onClick={handlePlayAudio}
            disabled={isLoadingAudio}
            className="absolute -right-10 bottom-2 p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/5 transition-all opacity-0 group-hover:opacity-100"
            title="Escuchar mensaje"
          >
            {isLoadingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
            ) : isPlaying ? (
              <VolumeX className="w-4 h-4 text-orange-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
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
