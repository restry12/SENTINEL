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
    <div className="border-t border-white/[0.06] pt-4 pb-4 shrink-0">
      {/* Disclaimer */}
      <p className="text-[9.5px] text-white/20 mb-3 font-mono tracking-wide text-center leading-relaxed">
        SENTINEL AI puede entregar orientación, pero sigue siempre instrucciones oficiales de emergencia.
      </p>

      {/* Console-style input container */}
      <div className={cn(
        "relative rounded-xl border bg-[#0a0d14] transition-all duration-300",
        disabled
          ? "border-white/[0.06] opacity-60"
          : "border-white/[0.09] focus-within:border-orange-500/30 focus-within:shadow-[0_0_24px_rgba(249,115,22,0.06)]"
      )}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder="Describe la situación: humo, fuego, aire, viento, ubicación o síntomas…"
          rows={1}
          className={cn(
            "w-full resize-none bg-transparent px-4 pt-3.5 pb-14 text-sm text-white",
            "placeholder:text-white/20 focus:outline-none",
            "max-h-40 leading-relaxed transition-colors"
          )}
        />

        {/* Bottom bar inside the container */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-white/[0.05]">
          <button
            onClick={onClear}
            disabled={disabled}
            title="Nueva conversación"
            className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-white/20 hover:text-white/45 transition-colors disabled:opacity-30 px-1.5 py-1 rounded hover:bg-white/[0.04]"
          >
            <RotateCcw className="w-3 h-3" />
            Nueva sesión
          </button>

          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all duration-200",
              "text-[10px] font-bold uppercase tracking-widest text-white",
              "bg-orange-500/75 hover:bg-orange-500/90 border border-orange-500/30 hover:border-orange-400/50",
              "shadow-[0_0_16px_rgba(249,115,22,0.18)] hover:shadow-[0_0_28px_rgba(249,115,22,0.32)]",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
            )}
          >
            <Send className="w-3 h-3" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
