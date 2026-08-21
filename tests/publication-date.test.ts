import { describe, expect, it } from 'vitest'
import { extractPublicationDate } from '../src/publication-date.js'

describe('publication date extraction', () => {
  it('prefers structured article metadata', () => {
    expect(extractPublicationDate({
      searchDate: '2026-08-20',
      metadata: { 'article:published_time': '2026-08-19T06:30:00Z' },
    })).toBe('2026-08-19T06:30:00.000Z')
  })

  it('reads JSON-LD and time elements when metadata is unavailable', () => {
    expect(extractPublicationDate({
      rawHtml: '<script type="application/ld+json">{"@type":"Article","datePublished":"2026-08-19T12:30:00+08:00"}</script>',
    })).toBe('2026-08-19T04:30:00.000Z')

    expect(extractPublicationDate({
      rawHtml: '<time datetime="2026-08-20">August 20, 2026</time>',
    })).toBe('2026-08-20T00:00:00.000Z')
  })

  it('uses a unique visible date but ignores ambiguous article text', () => {
    expect(extractPublicationDate({ markdown: '# Post\n\nAugust 19, 2026' })).toBe('2026-08-19T00:00:00.000Z')
    expect(extractPublicationDate({ markdown: 'August 19, 2026\nAugust 20, 2026' })).toBeNull()
  })
})