export type SourceType = 'web' | 'rss' | 'twitter'

export type Story = {
  id: number
  title: string
  url: string
  sourceName: string
  sourceType: SourceType
  publishedAt: string | null
  summary: string
  relevanceScore: number
  credibilityScore: number
  classification: string
  reasoning: string
  keywordPhrase: string
  readAt: string | null
}
