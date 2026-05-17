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
    <div className={cn("flex flex-col gap-1.5", isUser && "items-end")}>
      {/* Label row */}
      <div className={cn("flex items-center gap-1.5 px-1", isUser && "flex-row-reverse")}>
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-orange-500/15 border border-orange-500/30"
            : "bg-cyan-500/10 border border-cyan-500/20"
        )}>
          {isUser
            ? <User className="w-2.5 h-2.5 text-orange-400" />
            : <Bot className="w-2.5 h-2.5 text-cyan-400" />
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
        "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-[#1a0f02] border border-orange-500/20 text-white shadow-[0_0_24px_rgba(249,115,22,0.07)] rounded-tr-sm"
          : "bg-[#040d18] border border-cyan-500/15 text-white/90 shadow-[0_0_24px_rgba(34,211,238,0.05)] rounded-tl-sm"
      )}>
        {message.content
          ? message.content
          : isStreaming
            ? <AnalyzingIndicator />
            : null
        }
        {isStreaming && message.content && (
          <span className="inline-block w-[2px] h-3.5 bg-cyan-400/70 ml-1 animate-pulse align-middle rounded-full" />
        )}
      </div>
    </div>
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
