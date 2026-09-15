import { describe, expect, it } from 'vitest'
import { searchItems } from '../src/sources.js'

describe('Firecrawl search result parsing', () => {
  it('prefers Firecrawl v4 top-level web and news results over an empty compatibility data field', () => {
    const payload = {
      data: undefined,
      web: [{ title: 'Trusted web signal', url: 'https://openai.com/news/example' }],
      news: [{ title: 'Trusted news signal', url: 'https://venturebeat.com/ai/example' }],
    }

    expect(searchItems(payload)).toHaveLength(2)
  })

  it('continues to support the legacy nested search result shape', () => {
    expect(searchItems({
      data: { web: [{ title: 'Legacy signal', url: 'https://github.com/example' }] },
    })).toHaveLength(1)
  })
})