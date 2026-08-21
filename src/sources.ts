import crypto from 'node:crypto'
import { Firecrawl } from 'firecrawl'
import { assessTwitterAuthor, getSourcePolicy, getWebSourceQuality, type SourcePolicy, type TwitterAuthor } from './source-policy.js'

export type RawStory = {
  title: string
  url: string
  sourceName: string
  sourceType: 'web' | 'rss' | 'twitter'
  publishedAt: string | null
  content: string
  sourceQuality: number
  author?: TwitterAuthor
  externalId?: string
}

const feeds: Array<{ name: string; url: string; sourceQuality: number }> = [
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', sourceQuality: 96 },
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', sourceQuality: 96 },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', sourceQuality: 96 },
  { name: 'AWS Machine Learning Blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', sourceQuality: 92 },
  { name: 'Microsoft Research Blog', url: 'https://www.microsoft.com/en-us/research/feed/', sourceQuality: 94 },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', sourceQuality: 90 },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', sourceQuality: 78 },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', sourceQuality: 78 },
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
    return {
      title,
      url: linkMatch?.[1]?.trim() ?? `${feed.url}#${crypto.createHash('sha1').update(title).digest('hex')}`,
      sourceName: feed.name,
      sourceType: 'rss',
      publishedAt: extractTag(block, 'pubDate') || extractTag(block, 'published') || null,
      content,
      sourceQuality: feed.sourceQuality,
    }
  })
}

type TwitterApiTweet = {
  id?: string
  text?: string
  url?: string
  createdAt?: string
  likeCount?: number | string
  favoriteCount?: number | string
  replyCount?: number | string
  retweetCount?: number | string
  repostCount?: number | string
  quoteCount?: number | string
  author?: {
    userName?: string
    screenName?: string
    verified?: boolean
    isVerified?: boolean
    isBlueVerified?: boolean
    followers?: number | string
    followersCount?: number | string
  }
}

type FirecrawlSearchItem = {
  title?: string
  description?: string
  snippet?: string
  url?: string
  markdown?: string
  date?: string
}

function numericValue(value: number | string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function twitterAuthor(tweet: TwitterApiTweet): TwitterAuthor {
  const author = tweet.author
  return {
    handle: author?.userName ?? author?.screenName,
    verified: author?.verified === true || author?.isVerified === true || author?.isBlueVerified === true,
    followers: numericValue(author?.followers ?? author?.followersCount),
    engagement: [tweet.likeCount, tweet.favoriteCount, tweet.replyCount, tweet.retweetCount, tweet.repostCount, tweet.quoteCount]
      .reduce<number>((total, value) => total + numericValue(value), 0),
  }
}

function searchItems(payload: unknown): FirecrawlSearchItem[] {
  if (!payload || typeof payload !== 'object') return []
  const response = payload as { data?: { web?: FirecrawlSearchItem[]; news?: FirecrawlSearchItem[] }; web?: FirecrawlSearchItem[]; news?: FirecrawlSearchItem[] }
  if (response.web || response.news) return [...(response.web ?? []), ...(response.news ?? [])]
  return [...(response.data?.web ?? []), ...(response.data?.news ?? [])]
}

function sourceNameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Trusted web source'
  }
}

async function fetchWeb(query: string, policy: SourcePolicy): Promise<RawStory[]> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) return []
  const client = new Firecrawl({ apiKey: key })
  const payload = await client.search(`${query} AI technology release developer research`, {
    sources: ['web', 'news'],
    limit: 8,
    tbs: 'qdr:w',
    includeDomains: [...policy.trustedWebDomains],
    ignoreInvalidURLs: true,
    timeout: 10_000,
  })

  return searchItems(payload).flatMap((item) => {
    const url = item.url?.trim()
    if (!url) return []
    const sourceQuality = getWebSourceQuality(url, policy)
    if (!sourceQuality) return []
    const title = item.title?.trim() || 'Web signal'
    const content = item.markdown?.trim() || item.description?.trim() || item.snippet?.trim() || title
    return [{
      title,
      url,
      sourceName: sourceNameFromUrl(url),
      sourceType: 'web' as const,
      publishedAt: item.date ?? null,
      content,
      sourceQuality,
    }]
  }).slice(0, 6)
}

async function fetchTwitter(query: string, policy: SourcePolicy): Promise<RawStory[]> {
  const key = process.env.TWITTERAPI_API_KEY
  if (!key) return []
  const endpoint = process.env.TWITTERAPI_SEARCH_URL ?? 'https://api.twitterapi.io/twitter/tweet/advanced_search'
  const searchUrl = new URL(endpoint)
  searchUrl.searchParams.set('query', query)
  searchUrl.searchParams.set('queryType', 'Top')
  const response = await fetch(searchUrl, { signal: AbortSignal.timeout(10_000), headers: { 'X-API-Key': key, Accept: 'application/json' } })
  if (!response.ok) throw new Error(`twitterapi.io returned ${response.status}`)
  const payload = await response.json() as { tweets?: TwitterApiTweet[] }
  return (payload.tweets ?? []).flatMap((tweet) => {
    const author = twitterAuthor(tweet)
    const decision = assessTwitterAuthor(author, policy)
    if (!decision.accepted) return []
    return [{
      title: tweet.text?.slice(0, 120) ?? 'X signal',
      url: tweet.url ?? `https://x.com/i/web/status/${tweet.id ?? ''}`,
      sourceName: `X / ${author.handle ?? 'unknown'}`,
      sourceType: 'twitter' as const,
      publishedAt: tweet.createdAt ?? null,
      content: tweet.text ?? '',
      sourceQuality: decision.sourceQuality,
      author,
      externalId: tweet.id,
    }]
  }).slice(0, policy.maxTwitterResultsPerKeyword)
}

export async function collectStories(phrases: string[]) {
  const policy = getSourcePolicy()
  const results = await Promise.allSettled([
    ...feeds.map(fetchFeed),
    ...phrases.map((phrase) => fetchWeb(phrase, policy)),
    ...phrases.map((phrase) => fetchTwitter(phrase, policy)),
  ])
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}
