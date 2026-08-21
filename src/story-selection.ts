import type { Verdict } from './ai.js'
import type { SourcePolicy } from './source-policy.js'
import type { RawStory } from './sources.js'

export type EvaluatedStory<TKeyword> = {
  story: RawStory
  keyword: TKeyword
  verdict: Verdict
}

function effectiveCredibility(story: RawStory, verdict: Verdict) {
  return Math.max(story.sourceQuality, verdict.credibilityScore)
}

export function shouldPublishStory(story: RawStory, verdict: Verdict, policy: SourcePolicy) {
  return verdict.relevant
    && verdict.technical
    && verdict.contentType !== 'other'
    && verdict.classification !== 'misleading'
    && verdict.classification !== 'irrelevant'
    && verdict.relevanceScore >= policy.minRelevanceScore
    && verdict.keywordFocusScore >= policy.minKeywordFocusScore
    && effectiveCredibility(story, verdict) >= policy.minCredibilityScore
}

function candidateScore<TKeyword>(candidate: EvaluatedStory<TKeyword>) {
  const credibility = effectiveCredibility(candidate.story, candidate.verdict)
  return candidate.verdict.relevanceScore * 0.45
    + candidate.verdict.keywordFocusScore * 0.3
    + credibility * 0.25
}

function storyKey(story: RawStory) {
  return `${story.sourceType}:${story.externalId ?? story.url}`
}

function maxTwitterCandidates(nonTwitterCount: number, policy: SourcePolicy) {
  if (!nonTwitterCount) return Math.min(policy.maxTwitterStories, policy.maxTwitterFallbackStories)
  if (policy.maxTwitterShare >= 1) return policy.maxTwitterStories
  const shareLimit = Math.floor((nonTwitterCount * policy.maxTwitterShare) / (1 - policy.maxTwitterShare))
  return Math.min(policy.maxTwitterStories, shareLimit)
}

export function selectDiverseStories<TKeyword>(candidates: Array<EvaluatedStory<TKeyword>>, policy: SourcePolicy) {
  const bestCandidateByStory = new Map<string, EvaluatedStory<TKeyword>>()
  for (const candidate of candidates) {
    if (!shouldPublishStory(candidate.story, candidate.verdict, policy)) continue
    const key = storyKey(candidate.story)
    const current = bestCandidateByStory.get(key)
    if (!current || candidateScore(candidate) > candidateScore(current)) bestCandidateByStory.set(key, candidate)
  }

  const ranked = [...bestCandidateByStory.values()].sort((left, right) => candidateScore(right) - candidateScore(left))
  const nonTwitter = ranked.filter((candidate) => candidate.story.sourceType !== 'twitter')
  const twitter = ranked.filter((candidate) => candidate.story.sourceType === 'twitter')
  const selected = [...nonTwitter, ...twitter.slice(0, maxTwitterCandidates(nonTwitter.length, policy))]
  return selected.sort((left, right) => candidateScore(right) - candidateScore(left))
}