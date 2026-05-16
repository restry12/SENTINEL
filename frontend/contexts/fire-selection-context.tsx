"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type FireIntensity = 'critical' | 'high' | 'moderate'

export interface SelectedFireData {
  id: string
  lat: number
  lon: number
  frp: number
  brightness: number
  intensity: FireIntensity
  windImpactDir: string
  windKmh: number
  expansion2h?: { km2: number; ha: number }
  expansion6h?: { km2: number; ha: number }
  expansion12h?: { km2: number; ha: number }
}

interface FireSelectionContextValue {
  selectedFire: SelectedFireData | null
  setSelectedFire: (fire: SelectedFireData | null) => void
}

const FireSelectionContext = createContext<FireSelectionContextValue | null>(null)

export function FireSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedFire, setSelectedFire] = useState<SelectedFireData | null>(null)
  return (
    <FireSelectionContext.Provider value={{ selectedFire, setSelectedFire }}>
      {children}
    </FireSelectionContext.Provider>
  )
}

export function useFireSelection(): FireSelectionContextValue {
  const ctx = useContext(FireSelectionContext)
  if (!ctx) throw new Error("useFireSelection must be used within <FireSelectionProvider>")
  return ctx
}
