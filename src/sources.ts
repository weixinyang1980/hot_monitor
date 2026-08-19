import crypto from 'node:crypto'

export type RawStory = {
  title: string
  url: string
  sourceName: string
  sourceType: 'web' | 'rss' | 'twitter'
  publishedAt: string | null
  content: string
  externalId?: string
}

const feeds = [
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
]

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? stripTags(match[1]) : ''
}

async function fetchFeed(feed: typeof feeds[number]): Promise<RawStory[]> {
  const response = await fetch(feed.url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'HotMonitor/1.0' } })
  if (!response.ok) throw new Error(`${feed.name} returned ${response.status}`)
  const xml = await response.text()
  return [...xml.matchAll(/<(item|entry)[^>]*>([\s\S]*?)<\/(item|entry)>/gi)].slice(0, 8).map((match) => {
    const block = match[2]
    const linkMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i) ?? block.match(/<link[^>]*>([^<]+)<\/link>/i)
    const title = extractTag(block, 'title') || 'Untitled signal'
    const content = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content') || title
    return { title, url: linkMatch?.[1]?.trim() ?? `${feed.url}#${crypto.createHash('sha1').update(title).digest('hex')}`, sourceName: feed.name, sourceType: 'rss', publishedAt: extractTag(block, 'pubDate') || extractTag(block, 'published') || null, content }
  })
}

async function fetchTwitter(query: string): Promise<RawStory[]> {
  const key = process.env.TWITTERAPI_API_KEY
  if (!key) return []
  const endpoint = process.env.TWITTERAPI_SEARCH_URL ?? 'https://api.twitterapi.io/twitter/tweet/advanced_search'
  const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&queryType=Latest`, { signal: AbortSignal.timeout(10_000), headers: { 'X-API-Key': key, Accept: 'application/json' } })
  if (!response.ok) throw new Error(`twitterapi.io returned ${response.status}`)
  const payload = await response.json() as { tweets?: Array<{ id?: string; text?: string; url?: string; createdAt?: string; author?: { userName?: string } }> }
  return (payload.tweets ?? []).slice(0, 10).map((tweet) => ({ title: tweet.text?.slice(0, 120) ?? 'X signal', url: tweet.url ?? `https://x.com/i/web/status/${tweet.id ?? ''}`, sourceName: `X / ${tweet.author?.userName ?? 'unknown'}`, sourceType: 'twitter', publishedAt: tweet.createdAt ?? null, content: tweet.text ?? '', externalId: tweet.id }))
}

export async function collectStories(phrases: string[]) {
  const results = await Promise.allSettled([
    ...feeds.map(fetchFeed),
    ...phrases.map(fetchTwitter),
  ])
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}
