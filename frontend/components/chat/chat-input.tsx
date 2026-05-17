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
