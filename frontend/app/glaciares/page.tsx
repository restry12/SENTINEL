'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { AuthGuard } from '@/components/auth-guard'
import { TopBar } from '@/components/dashboard/top-bar'
import { GlacierRiskPanel } from '@/components/glaciares/glacier-risk-panel'
import { GlacierAIPanel } from '@/components/glaciares/glacier-ai-panel'
import { GlacierKPIBar } from '@/components/glaciares/glacier-kpi-bar'
import { GlacierCards } from '@/components/glaciares/glacier-cards'
import { GlacierDetailDrawer } from '@/components/glaciares/glacier-detail-drawer'
import { useGlaciers } from '@/hooks/use-glaciers'
import type { Glacier } from '@/lib/glacier-types'

const GlacierMap = dynamic(
  () => import('@/components/glaciares/glacier-map').then(m => m.GlacierMap),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-background" /> }
)

export default function GlaciersPage() {
  return <AuthGuard><GlaciersPageInner /></AuthGuard>
}

function GlaciersPageInner() {
  const { glaciers, loading, selected, analyzing, selectGlacier, analyzeGlacier } = useGlaciers()
  const [detailGlacier, setDetailGlacier] = useState<Glacier | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleOpenDetail = (g: Glacier) => {
    setDetailGlacier(g)
    setDrawerOpen(true)
  }

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">

        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-mono text-white/40 tracking-widest">CARGANDO DATOS GLIMS…</p>
            </div>
          </div>
        )}

        <GlacierMap glaciers={glaciers} selected={selected} onSelect={selectGlacier} />

        <div className="hidden md:block">
          <GlacierRiskPanel glacier={selected} />
        </div>

        <div className="hidden md:flex absolute bottom-4 left-[calc(288px+32px)] right-[calc(288px+32px)] z-40 flex-col gap-2">
          <GlacierKPIBar glaciers={glaciers} />
          {glaciers.length > 0 && (
            <GlacierCards
              glaciers={glaciers}
              selected={selected}
              onSelect={selectGlacier}
              onAnalyze={analyzeGlacier}
              onOpenDetail={handleOpenDetail}
            />
          )}
        </div>

        <div className="hidden md:block">
          <GlacierAIPanel glacier={selected} analyzing={analyzing} onAnalyze={analyzeGlacier} />
        </div>

        <GlacierDetailDrawer
          glacier={detailGlacier}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </main>
    </div>
  )
}
