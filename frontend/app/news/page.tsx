'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { TopBar } from '@/components/dashboard/top-bar'
import { AuthGuard } from '@/components/auth-guard'
import { useLang } from '@/contexts/language-context'
import { useSentinel } from '@/contexts/sentinel-context'
import type { AuthorityReport } from '@/hooks/use-socket'
import {
  ExternalLink, RefreshCw, Newspaper, AlertTriangle,
  Search, TrendingUp, Shield, Globe, Clock, Filter,
  Info, ChevronRight, Activity, FileText, AlertCircle,
  Users, MapPin, Zap
} from 'lucide-react'
import type { NewsArticle, NewsResponse } from '@/app/api/news/types'

// --- Report accumulation in localStorage ---

const REPORTS_LS_KEY = 'sentinel_reports'

function loadReports(): AuthorityReport[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(REPORTS_LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveReport(report: AuthorityReport): AuthorityReport[] {
  const existing = loadReports()
  if (existing.some(r => r.reporte_id === report.reporte_id)) return existing
  const updated = [report, ...existing]
  try { window.localStorage.setItem(REPORTS_LS_KEY, JSON.stringify(updated)) } catch {}
  return updated
}

// --- Visual Components ---

function Badge({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'orange' | 'blue' | 'red' }) {
  const styles = {
    default: 'bg-white/5 border-white/10 text-text-muted',
    orange:  'bg-orange/10 border-orange/20 text-orange-soft',
    blue:    'bg-blue/10 border-blue/20 text-blue-soft',
    red:     'bg-red/10 border-red/20 text-red-soft',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border ${styles[variant]}`}>
      {children}
    </span>
  )
}

function SectionLabel({ children, icon: Icon }: { children: React.ReactNode, icon?: any }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon className="w-3.5 h-3.5 text-orange/60" />}
      <span className="text-[10px] font-black tracking-[0.2em] text-text-muted uppercase">
        {children}
      </span>
    </div>
  )
}

// --- Logic Helpers ---

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'Hace momentos'
  if (diffH < 24) return `Hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `Hace ${diffD}d`
}

function cleanSnippet(snippet: string) {
  if (!snippet) return ''
  return snippet
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .trim()
}

// --- Main Page Sections ---

function NewsHeader({ articlesCount, cachedAt, onRefresh, isRefreshing }: { 
  articlesCount: number, 
  cachedAt: string | null, 
  onRefresh: () => void, 
  isRefreshing: boolean 
}) {
  const { tx } = useLang()
  
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/5">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange/10 border border-orange/20 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-orange" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
              {tx.navNews ?? 'Noticias'}
            </h1>
            <p className="text-[11px] font-bold text-orange-soft tracking-[0.3em] uppercase opacity-80">
              Incendios · Contaminación · Chile
            </p>
          </div>
        </div>
        <p className="max-w-xl text-[13px] text-text-muted leading-relaxed font-medium pt-2">
          Monitoreo de eventos, alertas y cobertura relevante para la toma de decisiones críticas en tiempo real.
        </p>
      </div>

      <div className="flex flex-col items-end gap-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">Registros</span>
            <span className="text-xl font-black text-white num">{articlesCount}</span>
          </div>
          <div className="w-[1px] h-8 bg-white/10" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">Sincronización</span>
            <span className="text-[11px] font-mono text-white/60">{cachedAt ?? '--:--'}</span>
          </div>
        </div>
        
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="group flex items-center gap-2.5 px-5 py-2 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black tracking-widest uppercase text-white/70 hover:text-white hover:bg-white/10 hover:border-orange/30 transition-all duration-300 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange' : 'group-hover:text-orange transition-colors'}`} />
          Refrescar Inteligencia
        </button>
      </div>
    </div>
  )
}

function NewsFilters({ activeFilter, setFilter, searchQuery, setSearch }: {
  activeFilter: string,
  setFilter: (f: string) => void,
  searchQuery: string,
  setSearch: (q: string) => void
}) {
  const filters = ['Todo', 'Incendios', 'Calidad del aire', 'Emergencias', 'Chile', 'Internacional']

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 py-6">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 border ${
              activeFilter === f
                ? 'bg-orange/15 border-orange/40 text-orange-soft shadow-[0_0_15px_rgba(255,126,21,0.1)]'
                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20 hover:text-text-2'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="relative group min-w-[320px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-orange transition-colors" />
        <input 
          type="text"
          placeholder="Buscar inteligencia informativa..."
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0a0b0e/60] backdrop-blur-xl border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-[12px] text-white placeholder:text-text-muted focus:outline-none focus:border-orange/30 focus:ring-1 focus:ring-orange/20 transition-all"
        />
      </div>
    </div>
  )
}

function isFire(title: string) {
  const t = title.toLowerCase()
  return t.includes('incendio') || t.includes('fuego') || t.includes('quema')
}

function articleColor(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('incendio') || t.includes('fuego') || t.includes('quema'))
    return "linear-gradient(135deg, #7f1d1d 0%, #3f0a0a 100%)"
  if (t.includes('contaminaci') || t.includes('calidad') || t.includes('aire') || t.includes('smog'))
    return "linear-gradient(135deg, #14532d 0%, #052e10 100%)"
  if (t.includes('lluvia') || t.includes('inundaci') || t.includes('agua'))
    return "linear-gradient(135deg, #1e3a5f 0%, #0a1a30 100%)"
  if (t.includes('sismo') || t.includes('terremoto'))
    return "linear-gradient(135deg, #4a3000 0%, #1c1000 100%)"
  return "linear-gradient(135deg, #1e293b 0%, #0a0f1a 100%)"
}

function ArticleImagePlaceholder({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div
      className={`w-full h-full ${className}`}
      style={{ background: articleColor(title) }}
    />
  )
}

function FeaturedCard({ article, loading }: { article?: NewsArticle, loading: boolean }) {
  if (loading) return <div className="w-full h-80 rounded-2xl border border-white/5 bg-surface/30 animate-pulse" />
  if (!article) return null

  const variant = article.title.toLowerCase().includes('incendio') ? 'orange' : 'blue'

  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0b0e/40] backdrop-blur-2xl transition-all duration-500 hover:border-orange/30">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-orange/40 to-transparent opacity-50" />
      
      <div className="flex flex-col lg:flex-row h-full">
        {/* Visual Side */}
        <div className="w-full lg:w-2/5 h-64 lg:h-auto relative bg-surface/40 overflow-hidden">
          {article.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={article.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 opacity-80 group-hover:opacity-100"
            />
          ) : (
            <ArticleImagePlaceholder title={article.title} className="absolute inset-0" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#04050a]/60" />
          <div className="absolute top-4 left-4 flex gap-1">
            <div className="w-1 h-1 rounded-full bg-orange" />
            <div className="w-1 h-1 rounded-full bg-orange/40" />
            <div className="w-1 h-1 rounded-full bg-orange/20" />
          </div>
        </div>

        {/* Content Side */}
        <div className="flex-1 p-8 lg:p-10 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-6">
            <Badge variant={variant === 'orange' ? 'orange' : 'blue'}>{article.source}</Badge>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(article.publishedAt)}
            </div>
          </div>

          <h2 className="text-2xl lg:text-3xl font-black text-white leading-tight mb-4 group-hover:text-orange-soft transition-colors tracking-tight italic">
            {article.title}
          </h2>

          <p className="text-[15px] text-text-muted leading-relaxed mb-8 line-clamp-3 font-medium">
            {cleanSnippet(article.snippet) || 'Analizando los detalles de este evento para proporcionar una respuesta estratégica y oportuna en las zonas afectadas.'}
          </p>

          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="self-start flex items-center gap-3 px-8 py-3 rounded-xl bg-white text-black text-[11px] font-black tracking-widest uppercase hover:bg-orange hover:text-white transition-all duration-300 shadow-[0_10px_20px_rgba(0,0,0,0.3)] hover:shadow-orange/20"
          >
            Ver Noticia Completa
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}

function ArticleCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-white/5 bg-surface/30 hover:border-white/15 hover:bg-surface/50 transition-all duration-300 backdrop-blur-md relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-8 h-[1px] bg-white/20 group-hover:bg-orange transition-colors z-10" />

      {/* Article image */}
      <div className="w-full h-36 relative overflow-hidden shrink-0">
        {article.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={article.imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
          />
        ) : (
          <ArticleImagePlaceholder title={article.title} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04050a]/80 to-transparent" />
      </div>

      <div className="flex flex-col p-6 flex-1">
      <div className="flex items-start justify-between gap-4 mb-5">
        <Badge variant={isFire(article.title) ? 'orange' : 'default'}>{article.source}</Badge>
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-dim uppercase tracking-wider">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(article.publishedAt)}
        </div>
      </div>

      <h3 className="text-[14px] font-black text-white leading-snug mb-3 group-hover:text-orange-soft transition-colors duration-300 line-clamp-3">
        {article.title}
      </h3>
      
      <p className="text-[12px] text-text-muted leading-relaxed line-clamp-2 mb-6 font-medium">
        {cleanSnippet(article.snippet) || 'Sin resumen disponible. Haga clic para consultar la fuente oficial.'}
      </p>

      <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
        <span className="text-[9px] font-black tracking-[0.2em] text-text-dim group-hover:text-white transition-colors uppercase">
          Leer Inteligencia
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-orange transition-all duration-300" />
      </div>
      </div>
    </a>
  )
}

const NIVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'NIVEL 1': { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  'NIVEL 2': { bg: 'bg-orange/10', border: 'border-orange/30', text: 'text-orange-soft' },
  'NIVEL 3': { bg: 'bg-red/10', border: 'border-red/30', text: 'text-red-soft' },
}

function ReportCard({ report }: { report: AuthorityReport }) {
  const colors = NIVEL_COLORS[report.nivel_emergencia] ?? NIVEL_COLORS['NIVEL 1']

  return (
    <div className="group flex flex-col rounded-xl border border-white/5 bg-surface/30 hover:border-white/15 hover:bg-surface/50 transition-all duration-300 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 left-0 w-8 h-[1px] bg-white/20 group-hover:bg-orange transition-colors z-10" />

      {/* Header */}
      <div className="p-6 pb-4 border-b border-white/5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Badge variant="red">{report.nivel_emergencia}</Badge>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-dim uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(report.timestamp)}
          </div>
        </div>
        <div className="text-[10px] font-mono text-text-muted mb-2">{report.reporte_id}</div>
        <div className="flex items-center gap-2 text-[12px] text-white font-bold">
          <MapPin className="w-3.5 h-3.5 text-orange/60 shrink-0" />
          {report.zona_impacto}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4 flex-1">
        <p className="text-[12px] text-text-muted leading-relaxed font-medium line-clamp-4">
          {report.resumen_ejecutivo}
        </p>

        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-orange/60" />
          <span className="text-[11px] text-text-muted font-medium">Población en riesgo:</span>
          <span className="text-[12px] text-white font-black">{report.poblacion_en_riesgo_estimada.toLocaleString('es-CL')}</span>
        </div>

        {report.acciones_inmediatas.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-soft uppercase tracking-wider">
              <Zap className="w-3 h-3" />
              Acciones Inmediatas
            </div>
            <ul className="space-y-1">
              {report.acciones_inmediatas.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-text-muted leading-snug">
                  <span className="text-orange mt-0.5 shrink-0">&#8250;</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.zonas_evacuacion_prioritaria.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-soft uppercase tracking-wider">
              <AlertCircle className="w-3 h-3" />
              Zonas de Evacuación
            </div>
            <div className="flex flex-wrap gap-1.5">
              {report.zonas_evacuacion_prioritaria.map((z, i) => (
                <span key={i} className="px-2 py-0.5 rounded border border-red/20 bg-red/5 text-[9px] font-bold text-red-soft uppercase">
                  {z}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-white/5 flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {report.recursos_recomendados.slice(0, 2).map((r, i) => (
            <span key={i} className="px-2 py-0.5 rounded border border-white/10 bg-white/5 text-[9px] font-bold text-text-dim uppercase">
              {r}
            </span>
          ))}
          {report.recursos_recomendados.length > 2 && (
            <span className="px-2 py-0.5 text-[9px] font-bold text-text-dim">
              +{report.recursos_recomendados.length - 2}
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border ${colors.bg} ${colors.border} ${colors.text}`}>
          {report.nivel_emergencia}
        </span>
      </div>
    </div>
  )
}

function SidebarModule({ title, icon: Icon, children }: { title: string, icon?: any, children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl border border-white/5 bg-[#0a0b0e/30] backdrop-blur-xl">
      <SectionLabel icon={Icon}>{title}</SectionLabel>
      {children}
    </div>
  )
}

// --- Main Page Component ---

function NewsContent() {
  const { tx } = useLang()
  const { sentinelUpdate } = useSentinel()
  const [data, setData] = useState<NewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState('Todo')
  const [search, setSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<'news' | 'reports'>('news')
  const [reports, setReports] = useState<AuthorityReport[]>([])

  useEffect(() => {
    setMounted(true)
    setReports(loadReports())
  }, [])

  // Accumulate new reports as they arrive from the socket
  useEffect(() => {
    if (!sentinelUpdate?.report) return
    const updated = saveReport(sentinelUpdate.report)
    setReports(updated)
  }, [sentinelUpdate?.report])

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

  const filteredArticles = useMemo(() => {
    if (!data?.articles) return []
    return data.articles.filter(a => {
      const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase()) || 
                           a.source.toLowerCase().includes(search.toLowerCase()) ||
                           a.snippet.toLowerCase().includes(search.toLowerCase())
      
      if (filter === 'Todo') return matchesSearch
      if (filter === 'Incendios') return matchesSearch && (a.title.toLowerCase().includes('incendio') || a.title.toLowerCase().includes('fuego'))
      if (filter === 'Calidad del aire') return matchesSearch && (a.title.toLowerCase().includes('aire') || a.title.toLowerCase().includes('contaminación') || a.title.toLowerCase().includes('calidad'))
      if (filter === 'Chile') return matchesSearch && a.title.toLowerCase().includes('chile')
      return matchesSearch
    })
  }, [data, filter, search])

  const sortedReports = useMemo(() =>
    [...reports].sort((a, b) => a.reporte_id.localeCompare(b.reporte_id)),
    [reports]
  )

  const featuredArticle = filteredArticles[0]
  const otherArticles = filteredArticles.slice(1)
  const cachedAtTime = (mounted && data?.cachedAt) ? new Date(data.cachedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 lg:px-12 scrollbar-none">
      <div className="max-w-[1400px] mx-auto">
        
        <NewsHeader 
          articlesCount={filteredArticles.length} 
          cachedAt={cachedAtTime}
          onRefresh={() => fetchNews(true)}
          isRefreshing={refreshing}
        />

        {/* View mode toggle */}
        <div className="flex items-center gap-2 pt-6">
          <button
            onClick={() => setViewMode('news')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all duration-300 border ${
              viewMode === 'news'
                ? 'bg-orange/15 border-orange/40 text-orange-soft shadow-[0_0_15px_rgba(255,126,21,0.1)]'
                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20 hover:text-text-2'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            Noticias
          </button>
          <button
            onClick={() => setViewMode('reports')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all duration-300 border ${
              viewMode === 'reports'
                ? 'bg-orange/15 border-orange/40 text-orange-soft shadow-[0_0_15px_rgba(255,126,21,0.1)]'
                : 'bg-white/5 border-white/10 text-text-muted hover:border-white/20 hover:text-text-2'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Reportes Automatizados
            {sortedReports.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange/20 text-orange text-[9px] font-black leading-none">
                {sortedReports.length}
              </span>
            )}
          </button>
        </div>

        {viewMode === 'news' && (
        <NewsFilters
          activeFilter={filter}
          setFilter={setFilter}
          searchQuery={search}
          setSearch={setSearch}
        />
        )}

        {data?.error && (
          <div className="flex items-center gap-3 p-4 mb-8 rounded-xl border border-red/20 bg-red/5 text-red-soft text-[12px] font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            SISTEMA: {data.error}
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-10">
          <div className="flex-1 space-y-10">
            {viewMode === 'news' ? (
              <>
                <section>
                   <SectionLabel icon={TrendingUp}>Información Destacada</SectionLabel>
                   <FeaturedCard article={featuredArticle} loading={loading} />
                </section>

                <section className="space-y-6">
                   <SectionLabel icon={Activity}>Feed de Inteligencia Global</SectionLabel>
                   {loading ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {Array.from({ length: 4 }).map((_, i) => (
                         <div key={i} className="h-48 rounded-xl border border-white/5 bg-surface/30 animate-pulse" />
                       ))}
                     </div>
                   ) : otherArticles.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {otherArticles.map((article, i) => (
                         <ArticleCard key={i} article={article} />
                       ))}
                     </div>
                   ) : (
                     <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 bg-white/2">
                       <Shield className="w-12 h-12 text-text-muted mb-4 opacity-20" />
                       <p className="text-text-muted font-bold text-[14px] uppercase tracking-widest italic">Sin registros adicionales bajo este criterio</p>
                     </div>
                   )}
                </section>
              </>
            ) : (
              <section className="space-y-6">
                <SectionLabel icon={FileText}>Reportes Automatizados</SectionLabel>
                {sortedReports.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedReports.map((report) => (
                      <ReportCard key={report.reporte_id} report={report} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-white/10 bg-white/2">
                    <FileText className="w-12 h-12 text-text-muted mb-4 opacity-20" />
                    <p className="text-text-muted font-bold text-[14px] uppercase tracking-widest italic">Sin reportes disponibles</p>
                    <p className="text-text-dim text-[11px] mt-2 font-medium">Los reportes se generan automáticamente con cada ciclo de análisis</p>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="w-full xl:w-80 space-y-6 shrink-0">
            <SidebarModule title="Estado del Sistema" icon={Shield}>
               <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green/5 border border-green/10">
                     <span className="text-[10px] font-bold text-green-soft uppercase tracking-wider">Fuentes Activas</span>
                     <span className="text-sm font-black text-white num leading-none">08</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange/5 border border-orange/10">
                     <span className="text-[10px] font-bold text-orange-soft uppercase tracking-wider">Alertas Hoy</span>
                     <span className="text-sm font-black text-white num leading-none">12</span>
                  </div>
               </div>
            </SidebarModule>

            <SidebarModule title="Temas en Monitoreo" icon={Info}>
               <div className="flex flex-wrap gap-2">
                  {['Incendios Forestales', 'Zonas Urbanas', 'Humo', 'CONAF', 'Bomberos', 'Senapred', 'Región Metropolitana', 'Biobío'].map(tag => (
                    <span key={tag} className="px-2 py-1 rounded border border-white/5 bg-white/5 text-[9px] font-bold text-text-dim uppercase hover:border-blue/30 hover:text-blue-soft cursor-default transition-colors">
                      #{tag}
                    </span>
                  ))}
               </div>
            </SidebarModule>

            <SidebarModule title="Fuentes de Inteligencia" icon={Globe}>
               <ul className="space-y-3 pt-1">
                  {[
                    { name: 'Google News Monitor', status: 'En Línea' },
                    { name: 'Nasa FIRMS API', status: 'Sincronizado' },
                    { name: 'Red Meteorológica', status: 'En Línea' },
                    { name: 'Análisis Mistral-AI', status: 'Operacional' },
                  ].map(src => (
                    <li key={src.name} className="flex items-center justify-between group">
                      <span className="text-[11px] font-medium text-text-muted group-hover:text-white transition-colors">{src.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-blue animate-pulse" />
                        <span className="text-[8px] font-black text-blue-soft uppercase tracking-widest">{src.status}</span>
                      </div>
                    </li>
                  ))}
               </ul>
            </SidebarModule>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-orange/20 to-blue/20 border border-white/10 relative overflow-hidden">
                <div className="relative z-10">
                  <h4 className="text-sm font-black text-white uppercase italic leading-tight mb-2">Suscripción Operativa</h4>
                  <p className="text-[11px] text-white/70 leading-relaxed font-medium mb-4">Recibe informes resumidos por IA directamente en tu terminal de mando.</p>
                  <button className="w-full py-2.5 rounded-lg bg-white text-black text-[10px] font-black tracking-widest uppercase hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-xl">
                    Activar Notificaciones
                  </button>
                </div>
                <Newspaper className="absolute -bottom-4 -right-4 w-24 h-24 text-white/5 -rotate-12" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default function NewsPage() {
  return (
    <AuthGuard>
      <div className="h-[calc(100dvh-4rem)] md:h-screen flex flex-col bg-[#04050a] text-foreground overflow-hidden">
        <TopBar />
        <NewsContent />
      </div>
    </AuthGuard>
  )
}
