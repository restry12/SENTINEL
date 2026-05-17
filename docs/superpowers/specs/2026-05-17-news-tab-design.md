# News Tab — Design Spec

## Goal

Add a "Noticias / News" tab to the SENTINEL dashboard. Fetches wildfire and air quality news from Google News RSS, summarizes the most impactful with Mistral, and displays a recap + article list.

## Architecture

### New files
- `frontend/app/api/news/route.ts` — Next.js API route: RSS fetch + Mistral summarization + ISR cache
- `frontend/app/news/page.tsx` — News page behind AuthGuard

### Modified files
- `frontend/components/dashboard/top-bar.tsx` — add `/news` nav link
- `frontend/contexts/language-context.tsx` — add `navNews` key to ES/EN translations

## Data Flow

```
User visits /news
→ page fetches GET /api/news
→ route checks Next.js ISR cache (revalidate: 1800s = 30min)
  → cache fresh: return cached { recap, articles, cachedAt }
  → cache stale:
    → fetch RSS in parallel:
        "incendio forestal Chile" (Google News RSS)
        "contaminación aire Chile" (Google News RSS)
    → parse XML, merge, dedupe by title, sort by date, take top 10
    → call Mistral (mistralai/mistral-large via OpenRouter):
        system: "Eres analista de emergencias. Resume en 3-4 oraciones las noticias más impactantes sobre incendios y contaminación. Conciso y directo."
        user: [titles + snippets]
    → return { recap, articles, cachedAt }
→ page renders recap card + article grid
```

## API Route (`/api/news`)

**Response shape:**
```ts
interface NewsArticle {
  title: string
  source: string
  publishedAt: string   // ISO string
  url: string           // Google News redirect URL
  snippet: string
}

interface NewsResponse {
  recap: string | null  // null if Mistral failed
  articles: NewsArticle[]
  cachedAt: string      // ISO string
  error?: string        // present if RSS failed
}
```

**Google News RSS URLs:**
- `https://news.google.com/rss/search?q=incendio+forestal+Chile&hl=es-419&gl=CL&ceid=CL:es-419`
- `https://news.google.com/rss/search?q=contaminaci%C3%B3n+aire+Chile&hl=es-419&gl=CL&ceid=CL:es-419`

**Cache:** `fetch(url, { next: { revalidate: 1800 } })` — Vercel ISR. 30-min TTL. No module-level state needed.

**XML parsing:** Native string/regex parsing (no DOMParser — not available in Node.js/Edge). Google News RSS format is predictable; extract `<item>` blocks then pull `<title>`, `<link>`, `<description>`, `<source>`, `<pubDate>` via regex.

**Manual refresh:** Refresh button re-calls GET `/api/news`. Next.js serves stale-while-revalidate — user sees current cache, background refresh happens if TTL expired. No force-bust needed.

**Error handling:**
- RSS fetch throws → `articles: [], recap: null, error: "No se pudo obtener noticias"`
- Mistral throws → `articles: [parsed], recap: null` (show articles without recap)
- Both fail → same error response, page shows empty state

**Env var required:** `OPENROUTER_API_KEY` — same key already on Render, must be added to Vercel env vars.

## Page (`/news`)

- `AuthGuard` wrapping (same as `/dashboard`, `/air`)
- `TopBar` included (same layout as other pages)
- On mount: fetch `/api/news`, show loading skeleton
- Layout:
  - **Recap card** (top): Mistral summary styled as intelligence briefing. If null, show "Resumen no disponible".
  - **Article grid** (below): cards with title, source badge, relative date, external link icon. Max 10 articles.
  - **Footer**: "Actualizado: {cachedAt}" + manual refresh button (re-fetches, shows spinner)
- Responsive: 1 col mobile, 2 col tablet, 3 col desktop

## TopBar

Add `/news` to nav array:
```ts
{ href: '/news', label: tx.navNews }
```

## i18n

Add to `contexts/language-context.tsx` translations:
- `es.navNews: 'NOTICIAS'`
- `en.navNews: 'NEWS'`

## Constraints

- No backend changes — runs entirely on Vercel (Next.js API route)
- No new npm packages — use native `fetch` + `DOMParser` or regex for XML parsing
- `OPENROUTER_API_KEY` must be set in Vercel env (server-side only, not `NEXT_PUBLIC_`)
- Auth guard same as existing pages
