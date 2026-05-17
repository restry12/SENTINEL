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
          ? isUser
            ? message.content
            : <MarkdownContent text={message.content} />
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
