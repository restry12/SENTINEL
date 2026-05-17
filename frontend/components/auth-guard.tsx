"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { BottomNav } from "@/components/ui/bottom-nav"

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("sentinel_token")
    if (!token) {
      router.replace("/login")
    } else {
      setAuthorized(true)
    }
  }, [router])

  if (!authorized) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-text-muted font-mono text-xs tracking-widest uppercase">
        Verificando acceso…
      </div>
    )
  }

  const isCitizen = pathname === "/dashboard/citizen"

  return (
    <>
      {children}
      {!isCitizen && <BottomNav />}
    </>
  )
}
