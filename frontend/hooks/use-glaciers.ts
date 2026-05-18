"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Glacier, GlacierAI } from "@/lib/glacier-types";

type GlacierSource = "glims-points" | "glims-detail" | "glims" | null;

interface UseGlaciersReturn {
  glaciers: Glacier[];
  loading: boolean;
  error: string | null;
  source: GlacierSource;
  selected: Glacier | null;
  analyzing: boolean;
  detailLoading: boolean;
  updateViewport: (bbox: [number, number, number, number], zoom: number) => void;
  selectGlacier: (g: Glacier) => Promise<void>;
  analyzeGlacier: (g: Glacier) => Promise<void>;
}

function serializeViewport(bbox: [number, number, number, number], zoom: number): string {
  return `${bbox.map((value) => value.toFixed(3)).join(",")}::${zoom.toFixed(2)}`;
}

export function useGlaciers(): UseGlaciersReturn {
  const [glaciers, setGlaciers] = useState<Glacier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<GlacierSource>(null);
  const [selected, setSelected] = useState<Glacier | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [viewport, setViewport] = useState<{ bbox: [number, number, number, number]; zoom: number }>({
    bbox: [-180, -80, 180, 84],
    zoom: 1.8,
  });

  const latestViewportKeyRef = useRef<string>("");
  const loadRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);

  const updateViewport = useCallback((bbox: [number, number, number, number], zoom: number) => {
    const key = serializeViewport(bbox, zoom);
    if (latestViewportKeyRef.current === key) return;
    latestViewportKeyRef.current = key;
    setViewport({ bbox, zoom });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++loadRequestIdRef.current;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      bbox: viewport.bbox.join(","),
      zoom: String(viewport.zoom),
    });

    fetch(`/api/glaciers?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Glacier[];
        const sourceHeader = (response.headers.get("X-Glacier-Source") ?? "glims") as GlacierSource;
        return { data, source: sourceHeader };
      })
      .then(({ data, source }) => {
        if (cancelled || requestId !== loadRequestIdRef.current) return;
        setGlaciers(data);
        setSource(source);
        setSelected((prev) => {
          if (!prev) return prev;
          const stillVisible = data.find((item) => item.glimsId === prev.glimsId);
          return stillVisible ? { ...stillVisible, ai: prev.ai ?? stillVisible.ai } : prev;
        });
      })
      .catch((e) => {
        if (cancelled || requestId !== loadRequestIdRef.current) return;
        setError(String(e));
      })
      .finally(() => {
        if (!cancelled && requestId === loadRequestIdRef.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewport.bbox, viewport.zoom]);

  const selectGlacier = useCallback(async (glacier: Glacier) => {
    setSelected(glacier);

    const shouldHydrate =
      glacier.tempHistory.length <= 1 ||
      glacier.deltaShort === "N/D" ||
      glacier.deltaYear === "N/D" ||
      glacier.masaVar === "N/D";

    if (!shouldHydrate) return;

    const requestId = ++detailRequestIdRef.current;
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/glaciers/${encodeURIComponent(glacier.glimsId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const detail = (await response.json()) as Glacier;

      if (requestId !== detailRequestIdRef.current) return;

      setGlaciers((prev) =>
        prev.map((item) => (item.glimsId === detail.glimsId ? { ...item, ...detail, ai: item.ai ?? detail.ai } : item))
      );
      setSelected((prev) =>
        prev?.glimsId === detail.glimsId ? { ...prev, ...detail, ai: prev.ai ?? detail.ai } : prev
      );
      setSource("glims-detail");
    } catch (e) {
      console.error("[selectGlacier detail]", e);
    } finally {
      if (requestId === detailRequestIdRef.current) setDetailLoading(false);
    }
  }, []);

  const analyzeGlacier = useCallback(async (glacier: Glacier) => {
    setAnalyzing(true);
    try {
      const response = await fetch("/api/glaciers/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ glacier }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ai = (await response.json()) as GlacierAI;

      setGlaciers((prev) =>
        prev.map((item) => (item.glimsId === glacier.glimsId ? { ...item, ai } : item))
      );
      setSelected((prev) => (prev?.glimsId === glacier.glimsId ? { ...prev, ai } : prev));
    } catch (e) {
      console.error("[analyzeGlacier]", e);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  return {
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
  };
}
