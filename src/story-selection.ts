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

function shouldUseTrustedFallback(story: RawStory, verdict: Verdict, policy: SourcePolicy) {
  return story.sourceType !== 'twitter'
    && story.sourceQuality >= policy.minTrustedFallbackSourceQuality
    && verdict.relevant
    && verdict.technical
    && verdict.contentType !== 'other'
    && verdict.classification !== 'misleading'
    && verdict.classification !== 'irrelevant'
    && verdict.relevanceScore >= policy.minTrustedFallbackRelevanceScore
    && verdict.keywordFocusScore >= policy.minTrustedFallbackKeywordFocusScore
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

function keywordKey(keyword: unknown) {
  if (typeof keyword === 'object' && keyword !== null && 'id' in keyword) {
    return `id:${String((keyword as { id?: unknown }).id)}`
  }
  return `value:${String(keyword)}`
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
    if (!shouldPublishStory(candidate.story, candidate.verdict, policy)
      && !shouldUseTrustedFallback(candidate.story, candidate.verdict, policy)) continue
    const key = storyKey(candidate.story)
    const current = bestCandidateByStory.get(key)
    if (!current || candidateScore(candidate) > candidateScore(current)) bestCandidateByStory.set(key, candidate)
  }

  const ranked = [...bestCandidateByStory.values()].sort((left, right) => candidateScore(right) - candidateScore(left))
  const strictCandidates = ranked.filter((candidate) => shouldPublishStory(candidate.story, candidate.verdict, policy))
  const nonTwitter = strictCandidates.filter((candidate) => candidate.story.sourceType !== 'twitter')
  const twitter = strictCandidates.filter((candidate) => candidate.story.sourceType === 'twitter')
  const selected = [...nonTwitter, ...twitter.slice(0, maxTwitterCandidates(nonTwitter.length, policy))]

  if (selected.length < policy.minStoriesPerScan) {
    const selectedStoryKeys = new Set(selected.map((candidate) => storyKey(candidate.story)))
    const selectedKeywordKeys = new Set(selected.map((candidate) => keywordKey(candidate.keyword)))
    const fallback = ranked.filter((candidate) => (
      !selectedStoryKeys.has(storyKey(candidate.story))
      && shouldUseTrustedFallback(candidate.story, candidate.verdict, policy)
    ))
    const uncoveredKeywords: Array<EvaluatedStory<TKeyword>> = []
    const remainingFallback: Array<EvaluatedStory<TKeyword>> = []
    for (const candidate of fallback) {
      const key = keywordKey(candidate.keyword)
      if (selectedKeywordKeys.has(key)) remainingFallback.push(candidate)
      else {
        selectedKeywordKeys.add(key)
        uncoveredKeywords.push(candidate)
      }
    }

    for (const candidate of [...uncoveredKeywords, ...remainingFallback]) {
      if (selected.length >= policy.minStoriesPerScan) break
      selected.push(candidate)
    }
  }

  return selected.sort((left, right) => candidateScore(right) - candidateScore(left))
}