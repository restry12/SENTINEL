export interface NewsArticle {
  title: string
  source: string
  publishedAt: string
  url: string
  snippet: string
  imageUrl?: string
}

export interface NewsResponse {
  recap: string | null
  articles: NewsArticle[]
  cachedAt: string
  error?: string
}
