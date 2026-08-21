import { describe, expect, it } from 'vitest'
import { assessTwitterAuthor, getSourcePolicy, getWebSourceQuality } from '../src/source-policy.js'

const policy = getSourcePolicy({
  TWITTER_TRUSTED_ACCOUNTS: 'creatorAlpha',
  TWITTER_MIN_FOLLOWERS: '10000',
  TWITTER_MIN_ENGAGEMENT: '75',
})

describe('source quality policy', () => {
  it('accepts configured trusted X accounts without engagement metadata', () => {
    expect(assessTwitterAuthor({ handle: '@CreatorAlpha' }, policy)).toMatchObject({
      accepted: true,
      reason: 'trusted-account',
    })
  })

  it('only admits unknown X accounts through the high-quality exception', () => {
    expect(assessTwitterAuthor({ handle: 'unknown', verified: true, followers: 20_000, engagement: 74 }, policy)).toMatchObject({
      accepted: false,
      reason: 'insufficient-author-quality',
    })
    expect(assessTwitterAuthor({ handle: 'unknown', verified: true, followers: 20_000, engagement: 75 }, policy)).toMatchObject({
      accepted: true,
      reason: 'high-quality-exception',
    })
  })

  it('keeps web discovery within trusted domains', () => {
    expect(getWebSourceQuality('https://openai.com/news/example', policy)).toBe(94)
    expect(getWebSourceQuality('https://random-example.invalid/post', policy)).toBe(0)
  })
})