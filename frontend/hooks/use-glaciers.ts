'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Glacier, GlacierAI } from '@/lib/glacier-types'

interface UseGlaciersReturn {
  glaciers: Glacier[]
  loading: boolean
  error: string | null
  selected: Glacier | null
  analyzing: boolean
  selectGlacier: (g: Glacier) => void
  analyzeGlacier: (g: Glacier) => Promise<void>
}

export function useGlaciers(): UseGlaciersReturn {
  const [glaciers, setGlaciers] = useState<Glacier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Glacier | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/glaciers')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Glacier[]>
      })
      .then(data => {
        if (cancelled) return
        setGlaciers(data)
        setSelected(data[0] ?? null)
      })
      .catch(e => {
        if (cancelled) return
        setError(String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const selectGlacier = useCallback((g: Glacier) => {
    setSelected(g)
  }, [])

  const analyzeGlacier = useCallback(async (g: Glacier) => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/glaciers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glacier: g }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const ai = await res.json() as GlacierAI

      setGlaciers(prev => prev.map(gl => gl.id === g.id ? { ...gl, ai } : gl))
      setSelected(prev => prev?.id === g.id ? { ...prev, ai } : prev)
    } catch (e) {
      console.error('[analyzeGlacier]', e)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  return { glaciers, loading, error, selected, analyzing, selectGlacier, analyzeGlacier }
}
