"use client";

import { useEffect, useState } from "react";
import type { Glacier } from "@/lib/glacier-types";

export interface TierListPayload {
  byArea: Glacier[];
  byRisk: Glacier[];
  byRetreat: Glacier[];
  total: number;
}

interface State {
  data: TierListPayload | null;
  loading: boolean;
  error: string | null;
}

const STORAGE_KEY = "sentinel.glaciers.tier-list.v1";
const TTL_MS = 6 * 60 * 60 * 1000;

interface CacheShape {
  ts: number;
  payload: TierListPayload;
}

function readCache(): TierListPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (Date.now() - parsed.ts > TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCache(payload: TierListPayload): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), payload }));
  } catch {
    // ignore
  }
}

export function useGlacierTierList(): State {
  const [data, setData] = useState<TierListPayload | null>(() => readCache());
  const [loading, setLoading] = useState<boolean>(() => readCache() === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/glaciers/tier-list")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as TierListPayload;
      })
      .then((payload) => {
        if (cancelled) return;
        writeCache(payload);
        setData(payload);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  return { data, loading, error };
}
