"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Layers } from "lucide-react"

interface MobileDrawerProps {
  title: string
  triggerLabel?: string
  children: React.ReactNode
}

export function MobileDrawer({ title, triggerLabel = "Ver datos", children }: MobileDrawerProps) {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <button
            className="fixed bottom-20 left-4 z-[1500] flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0f172a]/95 backdrop-blur-xl border border-white/20 shadow-2xl text-white text-[10px] font-black tracking-widest uppercase"
          >
            <Layers className="w-4 h-4 text-blue" />
            {triggerLabel}
          </button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="h-[80vh] bg-[#0a0b0e] border-white/10 overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-[11px] font-black tracking-[0.2em] uppercase text-text-muted">
              {title}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 pb-8 flex flex-col gap-3">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
