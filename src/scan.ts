import crypto from 'node:crypto'
import { db, now } from './db/index.js'
import { evaluateStory } from './ai.js'
import { notifyNewStory } from './notifications.js'
import { collectStories, type RawStory } from './sources.js'
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
    const keywords = db.prepare('SELECT id, phrase, notify_threshold as notifyThreshold FROM watch_keywords WHERE enabled = 1').all() as Array<{ id: number; phrase: string; notifyThreshold: number }>
    const rawStories = await collectStories(keywords.map((keyword) => keyword.phrase))
    let inserted = 0
    for (const story of rawStories) {
      const contentHash = crypto.createHash('sha256').update(`${story.title}|${story.content}`).digest('hex')
      db.prepare('INSERT OR IGNORE INTO stories (url, title, source_name, source_type, published_at, content, content_hash, discovered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(story.url, story.title, story.sourceName, story.sourceType, story.publishedAt, story.content, contentHash, now(), now())
      const storedStory = db.prepare('SELECT id FROM stories WHERE url = ? OR content_hash = ? LIMIT 1').get(story.url, contentHash) as { id: number } | undefined
      if (!storedStory) continue
      const storyId = storedStory.id
      for (const keyword of keywords) {
        const existing = db.prepare('SELECT id FROM story_matches WHERE story_id = ? AND keyword_id = ?').get(storyId, keyword.id)
        if (existing) continue
        let verdict
        try { verdict = await evaluateStory(story, keyword.phrase) } catch (error) { verdict = { relevant: false, technical: false, contentType: 'other' as const, relevanceScore: 0, credibilityScore: 0, classification: 'unverified' as const, summary: story.content.slice(0, 300), keyFacts: [], reasoning: `AI 判定失败，已过滤：${error instanceof Error ? error.message : '未知错误'}` } }
        if (!verdict.relevant || !verdict.technical || verdict.contentType === 'other') continue
        db.prepare('INSERT OR IGNORE INTO story_matches (story_id, keyword_id, relevance_score, credibility_score, classification, summary, key_facts_json, reasoning, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(storyId, keyword.id, verdict.relevanceScore, verdict.credibilityScore, verdict.classification, verdict.summary, JSON.stringify(verdict.keyFacts), verdict.reasoning, now())
        await notifyNewStory(io, story, verdict, keyword.phrase, keyword.notifyThreshold).catch(() => false)
        inserted += 1
      }
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
