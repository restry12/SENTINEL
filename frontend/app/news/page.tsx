'use client'

import { useEffect, useState, useCallback } from 'react'
import { TopBar } from '@/components/dashboard/top-bar'
import { AuthGuard } from '@/components/auth-guard'
import { useLang } from '@/contexts/language-context'
import { ExternalLink, RefreshCw, Newspaper, AlertTriangle } from 'lucide-react'
import type { NewsArticle, NewsResponse } from '@/app/api/news/route'

function RecapCard({ recap, loading }: { recap: string | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-white/8 bg-surface/60 backdrop-blur-xl animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-white/8 rounded w-full" />
          <div className="h-3 bg-white/8 rounded w-5/6" />
          <div className="h-3 bg-white/8 rounded w-4/6" />
        </div>
      </div>
    )
  }
  if (!recap) return null
  return (
    <div className="p-6 rounded-xl border border-orange/20 bg-[linear-gradient(180deg,rgba(255,126,21,0.06),rgba(255,126,21,0.02))] backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-16 h-[1px] bg-orange shadow-[0_0_8px_rgba(255,126,21,0.6)]" />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse shadow-[0_0_8px_rgba(255,126,21,0.8)]" />
        <span className="text-[9px] font-black tracking-[0.25em] text-orange uppercase">
          Inteligencia SENTINEL · Mistral AI
        </span>
      </div>
      <p className="text-[14px] leading-relaxed text-text-1">{recap}</p>
    </div>
  )
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const date = new Date(article.publishedAt)
  const relativeTime = (() => {
    const diffMs = Date.now() - date.getTime()
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'Hace menos de 1h'
    if (diffH < 24) return `Hace ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    return `Hace ${diffD}d`
  })()

  return (
    <a
      href={article.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 rounded-xl border border-white/5 bg-surface/50 hover:border-white/12 hover:bg-surface/80 transition-all duration-200 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[9px] font-black tracking-[0.2em] text-text-muted uppercase px-2 py-0.5 rounded border border-white/8 bg-white/3">
          {article.source || 'Fuente desconocida'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] text-text-muted">{relativeTime}</span>
          <ExternalLink className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      <h3 className="text-[13px] font-bold text-foreground leading-snug mb-2 group-hover:text-orange transition-colors duration-200">
        {article.title}
      </h3>
      {article.snippet && (
        <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
          {article.snippet}
        </p>
      )}
    </a>
  )
}

function NewsContent() {
  const { tx } = useLang()
  const [data, setData] = useState<NewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/news', { cache: 'no-store' })
      const json: NewsResponse = await res.json()
      setData(json)
    } catch {
      setData({ recap: null, articles: [], cachedAt: new Date().toISOString(), error: 'No se pudo obtener noticias' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchNews() }, [fetchNews])

  const cachedAt = data?.cachedAt ? new Date(data.cachedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="w-5 h-5 text-orange" />
          <div>
            <h1 className="text-[15px] font-black tracking-[0.15em] text-foreground uppercase">
              {tx.navNews}
            </h1>
            <p className="text-[10px] text-text-muted tracking-widest uppercase">
              Incendios · Contaminación · Chile
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {cachedAt && (
            <span className="text-[10px] text-text-muted font-mono">
              Actualizado: {cachedAt}
            </span>
          )}
          <button
            onClick={() => fetchNews(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-surface/60 text-[10px] font-bold tracking-widest uppercase text-text-muted hover:text-foreground hover:border-white/20 transition-all duration-200 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error banner */}
      {data?.error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-orange/20 bg-orange/5 text-orange text-[12px]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {data.error}
        </div>
      )}

      {/* Mistral recap */}
      <RecapCard recap={data?.recap ?? null} loading={loading} />

      {/* Article grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-surface/50 animate-pulse space-y-2">
              <div className="h-3 bg-white/8 rounded w-1/3" />
              <div className="h-4 bg-white/10 rounded w-full" />
              <div className="h-4 bg-white/8 rounded w-4/5" />
              <div className="h-3 bg-white/6 rounded w-full" />
            </div>
          ))}
        </div>
      ) : data?.articles && data.articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.articles.map((article, i) => (
            <ArticleCard key={i} article={article} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Newspaper className="w-10 h-10 text-text-muted mb-4 opacity-40" />
          <p className="text-text-muted text-[13px]">No hay noticias disponibles</p>
          <p className="text-text-dim text-[11px] mt-1">Intenta actualizar en unos minutos</p>
        </div>
      )}
    </div>
  )
}

export default function NewsPage() {
  return (
    <AuthGuard>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TopBar />
        <NewsContent />
      </div>
    </AuthGuard>
  )
}
