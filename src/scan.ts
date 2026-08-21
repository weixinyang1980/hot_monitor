import crypto from 'node:crypto'
import { db, now } from './db/index.js'
import { evaluateStory } from './ai.js'
import { notifyNewStory } from './notifications.js'
import { collectStories, type RawStory } from './sources.js'
import { getSourcePolicy } from './source-policy.js'
import { selectDiverseStories } from './story-selection.js'
import type { Server } from 'socket.io'
import { startHalfHourScheduler } from './schedule.js'

let running = false

export async function runScan(io: Server, trigger: 'manual' | 'scheduled' = 'scheduled') {
  if (running) return { skipped: true }
  running = true
  const startedAt = now()
  const scan = db.prepare('INSERT INTO scan_runs (trigger, status, started_at) VALUES (?, ?, ?)').run(trigger, 'running', startedAt)
  io.emit('scan:started', { id: scan.lastInsertRowid, startedAt })
  try {
    const clearStories = db.transaction(() => {
      db.prepare('DELETE FROM story_matches').run()
      db.prepare('DELETE FROM stories').run()
    })
    clearStories()
    const keywords = db.prepare('SELECT id, phrase FROM watch_keywords WHERE enabled = 1').all() as Array<{ id: number; phrase: string }>
    const rawStories = await collectStories(keywords.map((keyword) => keyword.phrase))
    const policy = getSourcePolicy()
    const evaluationTasks = rawStories.flatMap((story) => keywords.map((keyword) => ({ story, keyword })))
    const candidates = [] as Array<{ story: RawStory; keyword: { id: number; phrase: string }; verdict: Awaited<ReturnType<typeof evaluateStory>> }>
    const evaluationConcurrency = 4
    let nextTask = 0

    await Promise.all(Array.from({ length: Math.min(evaluationConcurrency, evaluationTasks.length) }, async () => {
      while (true) {
        const task = evaluationTasks[nextTask++]
        if (!task) return
        let verdict
        try {
          verdict = await evaluateStory(task.story, task.keyword.phrase)
        } catch (error) {
          verdict = {
            relevant: false,
            technical: false,
            contentType: 'other' as const,
            relevanceScore: 0,
            keywordFocusScore: 0,
            credibilityScore: 0,
            classification: 'unverified' as const,
            summary: task.story.content.slice(0, 300),
            keyFacts: [],
            reasoning: `AI 判定失败，已过滤：${error instanceof Error ? error.message : '未知错误'}`,
          }
        }
        candidates.push({ story: task.story, keyword: task.keyword, verdict })
      }
    }))

    const selectedCandidates = selectDiverseStories(candidates, policy)
    let inserted = 0
    for (const { story, keyword, verdict } of selectedCandidates) {
      const contentHash = crypto.createHash('sha256').update(`${story.title}|${story.content}`).digest('hex')
      db.prepare('INSERT OR IGNORE INTO stories (url, title, source_name, source_type, published_at, content, content_hash, discovered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(story.url, story.title, story.sourceName, story.sourceType, story.publishedAt, story.content, contentHash, now(), now())
      const storedStory = db.prepare('SELECT id FROM stories WHERE url = ? OR content_hash = ? LIMIT 1').get(story.url, contentHash) as { id: number } | undefined
      if (!storedStory) continue
      const storyId = storedStory.id
      const existing = db.prepare('SELECT id FROM story_matches WHERE story_id = ? AND keyword_id = ?').get(storyId, keyword.id)
      if (existing) continue
      db.prepare('INSERT OR IGNORE INTO story_matches (story_id, keyword_id, relevance_score, credibility_score, classification, summary, key_facts_json, reasoning, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(storyId, keyword.id, verdict.relevanceScore, verdict.credibilityScore, verdict.classification, verdict.summary, JSON.stringify(verdict.keyFacts), verdict.reasoning, now())
      notifyNewStory(io, story, verdict, keyword.phrase)
      inserted += 1
    }
    db.prepare('UPDATE scan_runs SET status = ?, source_count = ?, story_count = ?, finished_at = ? WHERE id = ?').run('completed', rawStories.length, inserted, now(), scan.lastInsertRowid)
    io.emit('scan:completed', { id: scan.lastInsertRowid, sourceCount: rawStories.length, storyCount: inserted })
    return { skipped: false, sourceCount: rawStories.length, storyCount: inserted }
  } catch (error) {
    db.prepare('UPDATE scan_runs SET status = ?, error_message = ?, finished_at = ? WHERE id = ?').run('failed', error instanceof Error ? error.message : 'Unknown scan error', now(), scan.lastInsertRowid)
    io.emit('scan:failed', { id: scan.lastInsertRowid })
    return { skipped: false, error: true }
  } finally { running = false }
}

export function startScheduler(io: Server) {
  return startHalfHourScheduler(() => { void runScan(io, 'scheduled') })
}
