export type TwitterAuthor = {
  handle?: string
  verified?: boolean
  followers?: number
  engagement?: number
}

export type SourcePolicy = {
  trustedTwitterAccounts: Set<string>
  primaryWebDomains: Set<string>
  trustedWebDomains: Set<string>
  minTwitterFollowers: number
  minTwitterEngagement: number
  minRelevanceScore: number
  minKeywordFocusScore: number
  minCredibilityScore: number
  minTrustedFallbackRelevanceScore: number
  minTrustedFallbackKeywordFocusScore: number
  minTrustedFallbackSourceQuality: number
  minStoriesPerScan: number
  maxTwitterResultsPerKeyword: number
  maxTwitterStories: number
  maxTwitterFallbackStories: number
  maxTwitterShare: number
}

export type TwitterSourceDecision = {
  accepted: boolean
  reason: 'trusted-account' | 'high-quality-exception' | 'insufficient-author-quality'
  sourceQuality: number
}

const defaultTrustedTwitterAccounts = [
  'openai',
  'anthropicai',
  'googledeepmind',
  'huggingface',
  'mistralai',
  'microsoftai',
  'metaai',
  'xai',
  'github',
]

const defaultPrimaryWebDomains = [
  'openai.com',
  'anthropic.com',
  'deepmind.google',
  'ai.google',
  'blog.google',
  'microsoft.com',
  'github.com',
  'huggingface.co',
  'mistral.ai',
  'deepseek.com',
  'meta.com',
  'x.ai',
  'aws.amazon.com',
  'nvidia.com',
  'arxiv.org',
]

const defaultTrustedWebDomains = [
  'techcrunch.com',
  'venturebeat.com',
  'theverge.com',
  'wired.com',
  'spectrum.ieee.org',
  'mit.edu',
]

function normalizedSet(values: string[]) {
  return new Set(values.map((value) => value.trim().toLowerCase().replace(/^@/, '')).filter(Boolean))
}

function configuredValues(value: string | undefined) {
  return value?.split(',') ?? []
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

function percentage(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

export function getSourcePolicy(environment: NodeJS.ProcessEnv = process.env): SourcePolicy {
  const primaryWebDomains = normalizedSet([
    ...defaultPrimaryWebDomains,
    ...configuredValues(environment.WEB_PRIMARY_DOMAINS),
  ])

  return {
    trustedTwitterAccounts: normalizedSet([
      ...defaultTrustedTwitterAccounts,
      ...configuredValues(environment.TWITTER_TRUSTED_ACCOUNTS),
    ]),
    primaryWebDomains,
    trustedWebDomains: normalizedSet([
      ...primaryWebDomains,
      ...defaultTrustedWebDomains,
      ...configuredValues(environment.WEB_TRUSTED_DOMAINS),
    ]),
    minTwitterFollowers: positiveInteger(environment.TWITTER_MIN_FOLLOWERS, 10_000),
    minTwitterEngagement: positiveInteger(environment.TWITTER_MIN_ENGAGEMENT, 75),
    minRelevanceScore: positiveInteger(environment.MIN_RELEVANCE_SCORE, 72),
    minKeywordFocusScore: positiveInteger(environment.MIN_KEYWORD_FOCUS_SCORE, 78),
    minCredibilityScore: positiveInteger(environment.MIN_CREDIBILITY_SCORE, 62),
    minTrustedFallbackRelevanceScore: positiveInteger(environment.TRUSTED_FALLBACK_MIN_RELEVANCE_SCORE, 65),
    minTrustedFallbackKeywordFocusScore: positiveInteger(environment.TRUSTED_FALLBACK_MIN_KEYWORD_FOCUS_SCORE, 62),
    minTrustedFallbackSourceQuality: positiveInteger(environment.TRUSTED_FALLBACK_MIN_SOURCE_QUALITY, 90),
    minStoriesPerScan: positiveInteger(environment.MIN_STORIES_PER_SCAN, 8),
    maxTwitterResultsPerKeyword: positiveInteger(environment.TWITTER_MAX_RESULTS_PER_KEYWORD, 3),
    maxTwitterStories: positiveInteger(environment.TWITTER_MAX_STORIES, 6),
    maxTwitterFallbackStories: positiveInteger(environment.TWITTER_MAX_FALLBACK_STORIES, 2),
    maxTwitterShare: percentage(environment.TWITTER_MAX_SHARE, 0.35),
  }
}

function normalizedHandle(handle: string | undefined) {
  return handle?.trim().toLowerCase().replace(/^@/, '')
}

export function assessTwitterAuthor(author: TwitterAuthor | undefined, policy: SourcePolicy): TwitterSourceDecision {
  const handle = normalizedHandle(author?.handle)
  if (handle && policy.trustedTwitterAccounts.has(handle)) {
    return { accepted: true, reason: 'trusted-account', sourceQuality: 96 }
  }

  const isHighQualityException = Boolean(author?.verified)
    && (author?.followers ?? 0) >= policy.minTwitterFollowers
    && (author?.engagement ?? 0) >= policy.minTwitterEngagement

  if (isHighQualityException) {
    return { accepted: true, reason: 'high-quality-exception', sourceQuality: 72 }
  }

  return { accepted: false, reason: 'insufficient-author-quality', sourceQuality: 0 }
}

function hostnameMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

export function getWebSourceQuality(url: string, policy: SourcePolicy) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    if ([...policy.primaryWebDomains].some((domain) => hostnameMatches(hostname, domain))) return 94
    if ([...policy.trustedWebDomains].some((domain) => hostnameMatches(hostname, domain))) return 78
  } catch {
    return 0
  }
  return 0
}