import 'dotenv/config'
import http from 'node:http'
import cors from 'cors'
import express from 'express'
import { Server } from 'socket.io'
import { z } from 'zod'
import { db, now } from './db/index.js'
import { runScan, startScheduler } from './scan.js'
import { getNextHalfHour } from './schedule.js'

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' },
})

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

const keywordSchema = z.object({
  phrase: z.string().trim().min(1).max(120),
  scope: z.string().trim().min(1).max(240).default('AI 大模型、AI 编程、开源模型、科技公司动态'),
})

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'hot-monitor',
    scanIntervalMinutes: 30,
    nextScheduledAt: getNextHalfHour().toISOString(),
    sources: {
      web: 'READY',
      rss: 'READY',
      twitter: process.env.TWITTERAPI_API_KEY ? 'READY' : 'CONFIG',
    },
  })
})

app.get('/api/keywords', (_request, response) => {
  const rows = db.prepare('SELECT id, phrase, scope, enabled, updated_at as updatedAt FROM watch_keywords ORDER BY updated_at DESC').all()
  response.json(rows)
})

app.post('/api/keywords', (request, response) => {
  const parsed = keywordSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: '关键词格式不正确' })
    return
  }

  const timestamp = now()
  try {
    const result = db.prepare('INSERT INTO watch_keywords (phrase, scope, created_at, updated_at) VALUES (?, ?, ?, ?)').run(parsed.data.phrase, parsed.data.scope, timestamp, timestamp)
    const keyword = db.prepare('SELECT id, phrase, scope, enabled, updated_at as updatedAt FROM watch_keywords WHERE id = ?').get(result.lastInsertRowid)
    response.status(201).json(keyword)
  } catch {
    response.status(409).json({ error: '这个关键词已经存在' })
  }
})

app.patch('/api/keywords/:id', (request, response) => {
  const id = Number(request.params.id)
  const enabled = z.object({ enabled: z.boolean() }).safeParse(request.body)
  if (!Number.isInteger(id) || !enabled.success) {
    response.status(400).json({ error: '请求参数不正确' })
    return
  }
  db.prepare('UPDATE watch_keywords SET enabled = ?, updated_at = ? WHERE id = ?').run(enabled.data.enabled ? 1 : 0, now(), id)
  response.json({ ok: true })
})

app.delete('/api/keywords/:id', (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id)) {
    response.status(400).json({ error: '关键词 ID 不正确' })
    return
  }
  db.prepare('DELETE FROM watch_keywords WHERE id = ?').run(id)
  response.status(204).end()
})

app.get('/api/stories', (_request, response) => {
  const rows = db.prepare(`
    SELECT sm.id, s.title, s.url, s.source_name as sourceName, s.source_type as sourceType,
      s.published_at as publishedAt, sm.summary, sm.relevance_score as relevanceScore,
      sm.credibility_score as credibilityScore, sm.classification, sm.reasoning,
      wk.phrase as keywordPhrase, sm.read_at as readAt
    FROM story_matches sm
    JOIN stories s ON s.id = sm.story_id
    JOIN watch_keywords wk ON wk.id = sm.keyword_id
    ORDER BY sm.evaluated_at DESC
    LIMIT 100
  `).all()
  response.json(rows)
})

app.get('/api/scans/latest', (_request, response) => {
  const scan = db.prepare('SELECT id, trigger, status, source_count as sourceCount, story_count as storyCount, error_message as errorMessage, started_at as startedAt, finished_at as finishedAt FROM scan_runs ORDER BY id DESC LIMIT 1').get()
  response.json(scan ?? null)
})

app.patch('/api/stories/:id/read', (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id)) {
    response.status(400).json({ error: '热点 ID 不正确' })
    return
  }
  db.prepare('UPDATE story_matches SET read_at = ? WHERE id = ?').run(now(), id)
  response.json({ ok: true })
})

app.post('/api/scans', (_request, response) => {
  void runScan(io, 'manual')
  response.status(202).json({ status: 'queued' })
})

io.on('connection', (socket) => {
  socket.emit('monitor:connected', { connectedAt: now() })
})

const port = Number(process.env.PORT ?? 8787)
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => console.log(`Hot Monitor API listening on http://localhost:${port}`))
  startScheduler(io)
}

export { app, io, server }
