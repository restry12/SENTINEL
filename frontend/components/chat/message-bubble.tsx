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
