import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

const RSS_QUERIES = [
  'incendio+forestal+Chile',
  'contaminaci%C3%B3n+aire+Chile',
]

export interface NewsArticle {
  title: string
  source: string
  publishedAt: string
  url: string
  snippet: string
}

export interface NewsResponse {
  recap: string | null
  articles: NewsArticle[]
  cachedAt: string
  error?: string
}

function extractTag(xml: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i')
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const cdataMatch = xml.match(cdataRe)
  if (cdataMatch) return cdataMatch[1].trim()
  const plainMatch = xml.match(plainRe)
  return plainMatch ? plainMatch[1].trim() : ''
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function parseRSS(xml: string): NewsArticle[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []
  return items.flatMap(item => {
    let title = decodeHTMLEntities(extractTag(item, 'title'))
    if (!title) return []
    
    let source = decodeHTMLEntities(extractTag(item, 'source'))
    const pubDate = extractTag(item, 'pubDate')
    
    // Clean title: "Headline - Source Name" -> "Headline"
    if (source && title.toLowerCase().endsWith(source.toLowerCase())) {
      const lastHyphen = title.lastIndexOf(' - ')
      if (lastHyphen > -1) title = title.substring(0, lastHyphen).trim()
    }

    // AGGRESSIVE SNIPPET CLEANING
    let rawDesc = extractTag(item, 'description')
    
    // 1. Remove all HTML tags
    let cleanDesc = rawDesc.replace(/<[^>]+>/g, ' ')
    
    // 2. Decode entities
    cleanDesc = decodeHTMLEntities(cleanDesc)
    
    // 3. REMOVE LONG LINKS (Google News often dumps huge base64 links here)
    // This removes any string longer than 40 chars that looks like a URL or base64 junk
    cleanDesc = cleanDesc.replace(/https?:\/\/[^\s]+/g, '')
    cleanDesc = cleanDesc.replace(/[a-zA-Z0-9_-]{40,}/g, '') // Long alphanumeric junk
    
    // 4. Final trim and whitespace normalization
    cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim()
    
    // 5. If it's too short or still looks like junk, clear it
    if (cleanDesc.length < 10) cleanDesc = ''

    const linkMatch = item.match(/<link>([^<]+)<\/link>/)
    const url = linkMatch ? linkMatch[1].trim() : ''
    
    return [{
      title,
      source: source || 'Fuente externa',
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      url,
      snippet: cleanDesc.slice(0, 180),
    }]
  })
}

async function fetchRSS(query: string): Promise<NewsArticle[]> {
  const url = `https://news.google.com/rss/search?q=${query}&hl=es-419&gl=CL&ceid=CL:es-419`
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) return []
    return parseRSS(await res.text())
  } catch {
    return []
  }
}

async function callMistral(articles: NewsArticle[]): Promise<string | null> {
  if (!OPENROUTER_KEY || articles.length === 0) return null
  const headlines = articles
    .slice(0, 10)
    .map((a, i) => `${i + 1}. ${a.title}${a.snippet ? ` — ${a.snippet}` : ''}`)
    .join('\n')
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sentinel.vercel.app',
        'X-Title': 'SENTINEL',
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large',
        messages: [
          {
            role: 'system',
            content:
              'Eres un analista de emergencias de SENTINEL. Resume en 3-4 oraciones las noticias más impactantes sobre incendios forestales y contaminación del aire. Sé conciso, directo y objetivo. Solo menciona los eventos más relevantes.',
          },
          { role: 'user', content: `Noticias recientes:\n\n${headlines}` },
        ],
        temperature: 0.2,
      }),
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

export async function GET(): Promise<NextResponse<NewsResponse>> {
  try {
    const [fires, air] = await Promise.all([
      fetchRSS(RSS_QUERIES[0]),
      fetchRSS(RSS_QUERIES[1]),
    ])

    const seen = new Set<string>()
    const articles = [...fires, ...air]
      .filter(a => {
        if (seen.has(a.title)) return false
        seen.add(a.title)
        return true
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 10)

    const recap = await callMistral(articles)

    return NextResponse.json({ recap, articles, cachedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({
      recap: null,
      articles: [],
      cachedAt: new Date().toISOString(),
      error: 'No se pudo obtener noticias',
    })
  }
}
