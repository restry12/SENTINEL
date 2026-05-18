"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Glacier, GlacierAI } from "@/lib/glacier-types";

type GlacierSource = "glims-points" | "glims-detail" | "glims" | null;

interface UseGlaciersReturn {
  glaciers: Glacier[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  source: GlacierSource;
  selected: Glacier | null;
  analyzing: boolean;
  detailLoading: boolean;
  updateViewport: (bbox: [number, number, number, number], zoom: number) => void;
  selectGlacier: (g: Glacier) => Promise<void>;
  analyzeGlacier: (g: Glacier) => Promise<void>;
}

interface CacheEntry {
  data: Glacier[];
  source: GlacierSource;
  ts: number;
}

const DEBOUNCE_MS = 700;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_STORAGE_KEY = "sentinel.glaciers.viewport-cache.v1";
const SELECTED_STORAGE_KEY = "sentinel.glaciers.selected.v1";
const MAX_CACHE_ENTRIES = 24;

const memoryCache = new Map<string, CacheEntry>();
let storageHydrated = false;

function persistSelected(glacier: Glacier | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!glacier) {
      window.sessionStorage.removeItem(SELECTED_STORAGE_KEY);
      return;
    }
    const payload = {
      name: glacier.name,
      glimsId: glacier.glimsId,
      area: glacier.area,
      riesgo: glacier.riesgo,
      cat: glacier.cat,
      lat: glacier.lat,
      lon: glacier.lon,
      trend: glacier.trend,
      srcDate: glacier.srcDate,
      tempAnomaly: glacier.tempAnomaly,
      deltaShort: glacier.deltaShort,
      deltaYear: glacier.deltaYear,
      masaVar: glacier.masaVar,
      diag: glacier.ai?.diag,
      forecast: glacier.ai?.forecast,
    };
    window.sessionStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

function hydrateFromStorage(): void {
  if (storageHydrated || typeof window === "undefined") return;
  storageHydrated = true;
  try {
    const raw = window.sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && Array.isArray(entry.data)) memoryCache.set(key, entry);
    }
  } catch {
    // ignore corrupted cache
  }
}

function persistToStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, CacheEntry> = {};
    for (const [key, entry] of memoryCache) obj[key] = entry;
    window.sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // quota or private mode — skip
  }
}

function trimCache(): void {
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return;
  const sorted = Array.from(memoryCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
  while (memoryCache.size > MAX_CACHE_ENTRIES && sorted.length > 0) {
    const [key] = sorted.shift() as [string, CacheEntry];
    memoryCache.delete(key);
  }
}

function quantizeKey(bbox: [number, number, number, number], zoom: number): string {
  const step =
    zoom <= 2.5 ? 20 :
    zoom <= 4 ? 8 :
    zoom <= 6 ? 3 :
    zoom <= 9 ? 1 : 0.4;
  const q = (v: number) => Math.round(v / step) * step;
  const zq = Math.round(zoom * 2) / 2;
  return `${q(bbox[0])},${q(bbox[1])},${q(bbox[2])},${q(bbox[3])}::${zq}`;
}

export function useGlaciers(): UseGlaciersReturn {
  const [glaciers, setGlaciers] = useState<Glacier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<GlacierSource>(null);
  const [selected, setSelected] = useState<Glacier | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [viewport, setViewport] = useState<{ bbox: [number, number, number, number]; zoom: number }>({
    bbox: [-180, -80, 180, 84],
    zoom: 1.8,
  });

  const lastKeyRef = useRef<string>("");
  const pendingViewportRef = useRef<{ bbox: [number, number, number, number]; zoom: number } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const glaciersLenRef = useRef(0);

  useEffect(() => {
    glaciersLenRef.current = glaciers.length;
  }, [glaciers.length]);

  const updateViewport = useCallback((bbox: [number, number, number, number], zoom: number) => {
    pendingViewportRef.current = { bbox, zoom };
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const next = pendingViewportRef.current;
      if (!next) return;
      const nextKey = quantizeKey(next.bbox, next.zoom);
      if (nextKey === lastKeyRef.current && glaciersLenRef.current > 0) return;
      setViewport(next);
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    hydrateFromStorage();
    const key = quantizeKey(viewport.bbox, viewport.zoom);

    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      lastKeyRef.current = key;
      setGlaciers(cached.data);
      setSource(cached.source);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const requestId = ++loadRequestIdRef.current;
    const hasExistingData = glaciersLenRef.current > 0;

    if (hasExistingData) setRefreshing(true);
    else setLoading(true);
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
      .then(({ data, source: nextSource }) => {
        if (cancelled || requestId !== loadRequestIdRef.current) return;
        memoryCache.set(key, { data, source: nextSource, ts: Date.now() });
        trimCache();
        persistToStorage();
        lastKeyRef.current = key;
        setGlaciers(data);
        setSource(nextSource);
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
        if (cancelled || requestId !== loadRequestIdRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewport.bbox, viewport.zoom]);

  const selectGlacier = useCallback(async (glacier: Glacier) => {
    setSelected(glacier);
    persistSelected(glacier);

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
      setSelected((prev) => {
        if (prev?.glimsId !== detail.glimsId) return prev;
        const merged = { ...prev, ...detail, ai: prev.ai ?? detail.ai };
        persistSelected(merged);
        return merged;
      });
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
      setSelected((prev) => {
        if (prev?.glimsId !== glacier.glimsId) return prev;
        const merged = { ...prev, ai };
        persistSelected(merged);
        return merged;
      });
    } catch (e) {
      console.error("[analyzeGlacier]", e);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  return {
    glaciers,
    loading,
    refreshing,
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
