import type { Server } from 'socket.io'
import type { Verdict } from './ai.js'
import type { RawStory } from './sources.js'

export function notifyNewStory(io: Server, story: RawStory, verdict: Verdict, keyword: string) {
  const notification = { title: story.title, url: story.url, sourceName: story.sourceName, summary: verdict.summary, credibilityScore: verdict.credibilityScore, relevanceScore: verdict.relevanceScore, classification: verdict.classification, keywordPhrase: keyword }
  io.emit('story:new', notification)
}
