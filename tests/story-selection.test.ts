import { describe, expect, it } from 'vitest'
import type { Verdict } from '../src/ai.js'
import { getSourcePolicy } from '../src/source-policy.js'
import { selectDiverseStories, shouldPublishStory } from '../src/story-selection.js'
import type { RawStory } from '../src/sources.js'

const policy = getSourcePolicy({
  MIN_RELEVANCE_SCORE: '72',
  MIN_KEYWORD_FOCUS_SCORE: '78',
  MIN_CREDIBILITY_SCORE: '62',
  TWITTER_MAX_SHARE: '0.35',
  TWITTER_MAX_STORIES: '6',
  TWITTER_MAX_FALLBACK_STORIES: '2',
})

function story(id: string, sourceType: RawStory['sourceType']): RawStory {
  return {
    title: `Story ${id}`,
    url: `https://example.com/${id}`,
    sourceName: sourceType,
    sourceType,
    publishedAt: null,
    content: `Content ${id}`,
    sourceQuality: sourceType === 'twitter' ? 72 : 94,
    externalId: id,
  }
}

function verdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    relevant: true,
    technical: true,
    contentType: 'technical_release',
    relevanceScore: 88,
    keywordFocusScore: 90,
    credibilityScore: 80,
    classification: 'verified',
    summary: 'A direct technical update.',
    keyFacts: [],
    reasoning: 'The monitored topic is the primary subject.',
    ...overrides,
  }
}

describe('story selection', () => {
  it('rejects a technical post that only mentions the keyword incidentally', () => {
    expect(shouldPublishStory(story('incidental', 'twitter'), verdict({ keywordFocusScore: 30 }), policy)).toBe(false)
  })

  it('caps X stories to the configured share when trusted web and RSS signals exist', () => {
    const candidates = [
      ...['rss-1', 'rss-2', 'rss-3', 'web-1'].map((id, index) => ({ story: story(id, index === 3 ? 'web' : 'rss'), keyword: id, verdict: verdict() })),
      ...['x-1', 'x-2', 'x-3', 'x-4'].map((id) => ({ story: story(id, 'twitter'), keyword: id, verdict: verdict() })),
    ]
    const selected = selectDiverseStories(candidates, policy)
    expect(selected.filter((candidate) => candidate.story.sourceType === 'twitter')).toHaveLength(2)
    expect(selected).toHaveLength(6)
  })
})