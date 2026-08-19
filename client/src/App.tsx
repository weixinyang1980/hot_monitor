import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import './App.css'

type Keyword = { id: number; phrase: string; scope: string; enabled: number }
type Story = {
  id: number; title: string; url: string; sourceName: string; sourceType: string
  summary: string; credibilityScore: number; relevanceScore: number
  classification: string; keywordPhrase: string; readAt: string | null
}
type Health = { nextScheduledAt: string; sources: { web: string; rss: string; twitter: string } }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

function App() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [phrase, setPhrase] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [nextScheduledAt, setNextScheduledAt] = useState('')
  const [countdown, setCountdown] = useState('')
  const [sourceStatus, setSourceStatus] = useState<Health['sources']>({ web: 'READY', rss: 'READY', twitter: 'CONFIG' })
  const [page, setPage] = useState(1)
  const pageSize = 5

  async function refresh() {
    const [keywordResponse, storyResponse, healthResponse] = await Promise.all([
      fetch(`${API_URL}/api/keywords`),
      fetch(`${API_URL}/api/stories`),
      fetch(`${API_URL}/api/health`),
    ])
    setKeywords(await keywordResponse.json())
    setStories(await storyResponse.json())
    const health = await healthResponse.json() as Health
    setNextScheduledAt(health.nextScheduledAt)
    setSourceStatus(health.sources)
    setLoading(false)
  }

  useEffect(() => {
    refresh().catch(() => setLoading(false))
    const socket = io(API_URL)
    socket.on('scan:started', () => { setScanning(true); setStories([]); setPage(1) })
    socket.on('scan:completed', () => { setScanning(false); refresh() })
    socket.on('scan:failed', () => setScanning(false))
    socket.on('story:new', refresh)
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!nextScheduledAt) return
      const remaining = Math.max(0, new Date(nextScheduledAt).getTime() - Date.now())
      const totalSeconds = Math.floor(remaining / 1000)
      const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
      const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
      const seconds = (totalSeconds % 60).toString().padStart(2, '0')
      setCountdown(`${hours}:${minutes}:${seconds}`)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [nextScheduledAt])

  useEffect(() => { setPage(1) }, [stories.length])

  async function addKeyword(event: React.FormEvent) {
    event.preventDefault()
    if (!phrase.trim()) return
    await fetch(`${API_URL}/api/keywords`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase }),
    })
    setPhrase('')
    refresh()
  }

  async function toggleKeyword(keyword: Keyword) {
    await fetch(`${API_URL}/api/keywords/${keyword.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !keyword.enabled }),
    })
    refresh()
  }

  async function deleteKeyword(keyword: Keyword) {
    if (!window.confirm(`确定删除监控词“${keyword.phrase}”吗？`)) return
    await fetch(`${API_URL}/api/keywords/${keyword.id}`, { method: 'DELETE' })
    refresh()
  }

  async function scanNow() {
    setScanning(true)
    setStories([])
    setPage(1)
    await fetch(`${API_URL}/api/scans`, { method: 'POST' })
  }

  const pageCount = Math.max(1, Math.ceil(stories.length / pageSize))
  const visibleStories = stories.slice((page - 1) * pageSize, page * pageSize)
  const sortedKeywords = [...keywords].sort((left, right) => Number(right.enabled) - Number(left.enabled))
  const nextScanLabel = nextScheduledAt ? new Date(nextScheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--'

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /></span><span className="brand-name">HOT MONITOR</span></div>
        <div className="topbar-status"><span className={`status-dot ${scanning ? 'is-live' : ''}`} />{scanning ? '正在扫描' : '系统在线'}<span className="interval">下次 {nextScanLabel} 扫描 · {countdown}</span></div>
      </header>
      <div className="dashboard-grid">
        <aside className="sidebar">
          <div className="eyebrow">AI SIGNAL DESK</div>
          <h1>AI 热点雷达</h1>
          <div className="sidebar-readout"><div className="readout-row"><span>监控频率</span><b>30 MIN</b></div><div className="source-health"><div className="section-label">来源状态</div><p><i className="health-dot" />网页搜索 <span>{sourceStatus.web}</span></p><p><i className="health-dot" />RSS 聚合 <span>{sourceStatus.rss}</span></p><p><i className={`health-dot ${sourceStatus.twitter === 'READY' ? '' : 'warning'}`} />X/Twitter <span>{sourceStatus.twitter}</span></p></div></div>
          <form className="keyword-form" onSubmit={addKeyword}>
            <label htmlFor="phrase">新增监控词</label>
            <div className="input-row"><input id="phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="例如：DeepSeek 更新" /><button aria-label="添加关键词" title="添加关键词">+</button></div>
          </form>
          <div className="keyword-list">
            <div className="section-label">监控中的词 <span>{keywords.filter((keyword) => keyword.enabled).length}</span></div>
            {sortedKeywords.map((keyword) => <div className={`keyword ${keyword.enabled ? 'active' : ''}`} key={keyword.id}><button className="keyword-toggle" onClick={() => toggleKeyword(keyword)}><span>{keyword.enabled ? '●' : '○'}</span>{keyword.phrase}<small>{keyword.enabled ? 'ON' : 'OFF'}</small></button><button className="keyword-delete" aria-label={`删除监控词 ${keyword.phrase}`} title="删除监控词" onClick={() => deleteKeyword(keyword)}>×</button></div>)}
            {!keywords.length && <p className="muted">还没有监控词，先添加一个。</p>}
          </div>
          <button className="scan-button" onClick={scanNow}><span>↗</span>{scanning ? '扫描已排队' : '清空并重新扫描'}</button>
        </aside>
        <section className="feed-panel">
          <div className="feed-heading"><div><div className="eyebrow">LIVE SIGNALS / {new Date().toLocaleDateString('zh-CN')}</div><h2>最新情报</h2></div><div className="feed-count">{stories.length.toString().padStart(2, '0')} <span>条</span></div></div>
          {loading ? <div className="empty-state">正在接入情报源...</div> : stories.length ? <><div className="story-list">{visibleStories.map((story) => <article className="story" key={story.id}><div className="story-meta"><span className="source-tag">{story.sourceName}</span><span>{story.keywordPhrase}</span><span className="story-time">刚刚</span></div><h3><a href={story.url} target="_blank" rel="noreferrer">{story.title}</a></h3><p>{story.summary}</p></article>)}</div><div className="pagination"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>上一页</button><span>{page} / {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>下一页</button></div></> : <div className="empty-state"><strong>情报流暂时安静</strong><span>添加监控词并点击“立即扫描”，开始建立你的第一条信号。</span></div>}
        </section>
      </div>
    </main>
  )
}

export default App
