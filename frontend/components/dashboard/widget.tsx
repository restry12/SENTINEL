"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface WidgetProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleWidget({ title, icon, children, defaultOpen = true, className = "" }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`w-72 bg-[#0f172a] backdrop-blur-md border border-white/10 rounded-lg overflow-hidden shadow-2xl transition-all duration-300 pointer-events-auto shrink-0 ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-soft">{icon}</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-2">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
      </button>
      {isOpen && <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">{children}</div>}
    </div>
  )
}
