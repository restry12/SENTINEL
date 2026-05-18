"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { TopBar } from "@/components/dashboard/top-bar";
import { GlacierKPIBar } from "@/components/glaciares/glacier-kpi-bar";
import { GlacierCards } from "@/components/glaciares/glacier-cards";
import { GlacierDetailDrawer } from "@/components/glaciares/glacier-detail-drawer";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { useGlaciers } from "@/hooks/use-glaciers";
import type { Glacier } from "@/lib/glacier-types";

const GlacierMap = dynamic(() => import("@/components/glaciares/glacier-map").then((mod) => mod.GlacierMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-background" />,
});

export default function GlaciersPage() {
  return (
    <AuthGuard>
      <GlaciersPageInner />
    </AuthGuard>
  );
}

function GlaciersPageInner() {
  const {
    glaciers,
    loading,
    error,
    source,
    selected,
    analyzing,
    detailLoading,
    updateViewport,
    selectGlacier,
    analyzeGlacier,
  } = useGlaciers();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailGlacier, setDetailGlacier] = useState<Glacier | null>(null);

  const handleSelectGlacier = (glacier: Glacier) => {
    setDetailGlacier(glacier);
    setDrawerOpen(true);
    void selectGlacier(glacier);
  };

  const handleOpenDetail = (glacier: Glacier) => {
    setDetailGlacier(glacier);
    setDrawerOpen(true);
    void selectGlacier(glacier);
  };

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-screen w-screen flex flex-col bg-background overflow-hidden">
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/65 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <p className="text-[10px] font-mono tracking-widest text-white/50">CARGANDO GLIMS...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute left-1/2 top-20 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-red-400/25 bg-[#0a0d14]/95 px-4 py-3 text-center backdrop-blur">
            <p className="text-[9px] font-bold uppercase tracking-widest text-red-300">Error cargando glaciares</p>
            <p className="mt-1 text-[10px] font-mono text-white/55">{error}</p>
          </div>
        )}

        <GlacierMap
          glaciers={glaciers}
          selected={selected}
          source={source}
          onSelect={handleSelectGlacier}
          onViewportChange={updateViewport}
        />

        <div className="hidden md:block absolute left-5 bottom-5 z-40 w-[30rem] max-w-[calc(100vw-2.5rem)]">
          <GlacierKPIBar glaciers={glaciers} />
        </div>

        <GlacierDetailDrawer
          glacier={selected ?? detailGlacier}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          analyzing={analyzing}
          detailLoading={detailLoading}
          onAnalyze={analyzeGlacier}
        />

        <MobileDrawer title="Glaciares del mundo" triggerLabel="Ver glaciares">
          <div className="space-y-4">
            <GlacierKPIBar glaciers={glaciers} />
            <GlacierCards
              glaciers={glaciers.slice(0, 120)}
              selected={selected}
              onSelect={handleSelectGlacier}
              onAnalyze={(glacier) => {
                void analyzeGlacier(glacier);
              }}
              onOpenDetail={handleOpenDetail}
            />
          </div>
        </MobileDrawer>
      </main>
    </div>
  );
}
