"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, Wind, Newspaper, UserCircle } from "lucide-react"

const tabs = [
  { href: "/dashboard",          label: "Dashboard",  Icon: LayoutGrid },
  { href: "/air",                label: "Aire",        Icon: Wind },
  { href: "/news",               label: "Noticias",    Icon: Newspaper },
  { href: "/dashboard/citizen",  label: "Ciudadano",   Icon: UserCircle },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] flex border-t border-white/10 bg-background/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors"
          >
            <Icon
              className={`w-5 h-5 transition-colors ${
                active
                  ? "text-orange drop-shadow-[0_0_6px_rgba(255,126,21,0.6)]"
                  : "text-text-muted"
              }`}
            />
            <span
              className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${
                active ? "text-orange" : "text-text-muted"
              }`}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
