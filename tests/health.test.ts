import request from 'supertest'
import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { db, now } from '../src/db/index.js'
import { app } from '../src/server.js'

describe('health API', () => {
  it('reports the service and default scan interval', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.scanIntervalMinutes).toBe(30)
  })

  it('does not report web search as ready without a Firecrawl key', async () => {
    const originalKey = process.env.FIRECRAWL_API_KEY
    delete process.env.FIRECRAWL_API_KEY

    try {
      const response = await request(app).get('/api/health')
      expect(response.body.sources.web).toBe('CONFIG')
    } finally {
      if (originalKey === undefined) delete process.env.FIRECRAWL_API_KEY
      else process.env.FIRECRAWL_API_KEY = originalKey
    }
  })

  it('hides a story match after its keyword is disabled', async () => {
    const suffix = crypto.randomUUID()
    const timestamp = now()
    let keywordId: number | undefined
    let storyId: number | undefined

    try {
      keywordId = Number(db.prepare('INSERT INTO watch_keywords (phrase, scope, created_at, updated_at) VALUES (?, ?, ?, ?)').run(`test-keyword-${suffix}`, 'test', timestamp, timestamp).lastInsertRowid)
      storyId = Number(db.prepare('INSERT INTO stories (url, title, source_name, source_type, published_at, content, content_hash, discovered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`https://example.test/${suffix}`, 'Test story', 'Test source', 'web', null, 'Test content', suffix, timestamp, timestamp).lastInsertRowid)
      const matchId = Number(db.prepare('INSERT INTO story_matches (story_id, keyword_id, relevance_score, credibility_score, classification, summary, key_facts_json, reasoning, evaluated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(storyId, keywordId, 90, 90, 'verified', 'Test summary', '[]', 'Test reasoning', timestamp).lastInsertRowid)

      expect((await request(app).get('/api/stories')).body.some((story: { id: number }) => story.id === matchId)).toBe(true)
      expect((await request(app).patch(`/api/keywords/${keywordId}`).send({ enabled: false })).status).toBe(200)
      expect((await request(app).get('/api/stories')).body.some((story: { id: number }) => story.id === matchId)).toBe(false)
    } finally {
      if (storyId !== undefined) db.prepare('DELETE FROM stories WHERE id = ?').run(storyId)
      if (keywordId !== undefined) db.prepare('DELETE FROM watch_keywords WHERE id = ?').run(keywordId)
    }
  })
})
