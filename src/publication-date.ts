export type PublicationDateInput = {
  searchDate?: string | null
  metadata?: Record<string, unknown>
  rawHtml?: string | null
  markdown?: string | null
}

const publicationDateKeys = new Set([
  'articlepublishedtime',
  'publishedtime',
  'datepublished',
  'publisheddate',
  'publishdate',
  'pubdate',
  'datecreated',
  'uploaddate',
])

const monthNames: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
}

const visibleDatePattern = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b|\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/gi

function dateToIso(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null
  return date.toISOString()
}

function normalizeDate(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeDate(entry)
      if (normalized) return normalized
    }
    return null
  }

  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate) return null

  const isoDate = candidate.match(/^(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (isoDate) return dateToIso(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))

  const monthDate = candidate.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})$/i)
  if (monthDate) return dateToIso(Number(monthDate[3]), monthNames[monthDate[1].toLowerCase().replace('.', '')], Number(monthDate[2]))

  const relativeDate = candidate.match(/^(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/i)
  if (relativeDate) {
    const date = new Date()
    const amount = Number(relativeDate[1])
    const unit = relativeDate[2].toLowerCase()
    if (unit === 'minute') date.setMinutes(date.getMinutes() - amount)
    if (unit === 'hour') date.setHours(date.getHours() - amount)
    if (unit === 'day') date.setDate(date.getDate() - amount)
    if (unit === 'week') date.setDate(date.getDate() - amount * 7)
    if (unit === 'month') date.setMonth(date.getMonth() - amount)
    if (unit === 'year') date.setFullYear(date.getFullYear() - amount)
    return date.toISOString()
  }

  const timestamp = Date.parse(candidate)
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString()
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function attributeValue(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null
}

function metadataPublicationDate(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null
  for (const [key, value] of Object.entries(metadata)) {
    if (!publicationDateKeys.has(normalizedKey(key))) continue
    const date = normalizeDate(value)
    if (date) return date
  }
  return null
}

function metaPublicationDate(rawHtml: string | null | undefined) {
  if (!rawHtml) return null
  for (const match of rawHtml.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    const key = attributeValue(tag, 'property') ?? attributeValue(tag, 'name') ?? attributeValue(tag, 'itemprop')
    if (!key || !publicationDateKeys.has(normalizedKey(key))) continue
    const date = normalizeDate(attributeValue(tag, 'content') ?? attributeValue(tag, 'value'))
    if (date) return date
  }
  return null
}

function structuredPublicationDate(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const date = structuredPublicationDate(entry)
      if (date) return date
    }
    return null
  }

  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  for (const [key, entry] of Object.entries(record)) {
    if (!publicationDateKeys.has(normalizedKey(key))) continue
    const date = normalizeDate(entry)
    if (date) return date
  }
  for (const entry of Object.values(record)) {
    const date = structuredPublicationDate(entry)
    if (date) return date
  }
  return null
}

function jsonLdPublicationDate(rawHtml: string | null | undefined) {
  if (!rawHtml) return null
  for (const match of rawHtml.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const date = structuredPublicationDate(JSON.parse(match[1].trim()))
      if (date) return date
    } catch {
      continue
    }
  }
  return null
}

function timePublicationDate(rawHtml: string | null | undefined) {
  if (!rawHtml) return null
  for (const match of rawHtml.matchAll(/<time\b[^>]*>/gi)) {
    const date = normalizeDate(attributeValue(match[0], 'datetime'))
    if (date) return date
  }
  return null
}

function markdownPublicationDate(markdown: string | null | undefined) {
  if (!markdown) return null
  const dates = new Set<string>()
  for (const match of markdown.matchAll(visibleDatePattern)) {
    const date = normalizeDate(match[0])
    if (date) dates.add(date)
  }
  return dates.size === 1 ? [...dates][0] : null
}

export function extractPublicationDate(input: PublicationDateInput) {
  return metadataPublicationDate(input.metadata)
    ?? metaPublicationDate(input.rawHtml)
    ?? jsonLdPublicationDate(input.rawHtml)
    ?? timePublicationDate(input.rawHtml)
    ?? markdownPublicationDate(input.markdown)
    ?? normalizeDate(input.searchDate)
}