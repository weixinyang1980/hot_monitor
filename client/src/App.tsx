import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import { io } from 'socket.io-client'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  AtSign,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe2,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Rss,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { BackgroundBeams } from './components/ui/background-beams'
import { Meteors } from './components/ui/meteors'
import { Spotlight } from './components/ui/spotlight-new'
import './App.css'

type Keyword = { id: number; phrase: string; scope: string; enabled: number }
type Story = {
  id: number; title: string; url: string; sourceName: string; sourceType: string
  summary: string; publishedAt: string | null; discoveredAt: string | null; credibilityScore: number; relevanceScore: number
  classification: string; keywordPhrase: string; readAt: string | null
}
type Health = { nextScheduledAt: string; sources: { web: string; rss: string; twitter: string } }
type SourceFilter = 'all' | 'web' | 'rss' | 'twitter'
type SortMode = 'latest' | 'relevance'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
const SOURCE_FILTERS: Array<{ id: SourceFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'rss', label: 'RSS' },
  { id: 'web', label: '网页' },
]

async function requestJson<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, options)
  if (!response.ok) throw new Error(`请求失败（${response.status}）`)
  return response.json() as Promise<T>
}

function formatRelativeTime(value: string | null) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return null
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function formatStoryTime(story: Story) {
  const publishedTime = formatRelativeTime(story.publishedAt)
  return publishedTime ?? '时间未知'
}

function publishedTimestamp(value: string | null) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function subscribeToReducedMotion(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useReducedMotionPreference() {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotionSnapshot, () => true)
}

function SourceGlyph({ sourceType }: { sourceType: string }) {
  if (sourceType === 'twitter') return <AtSign aria-hidden="true" size={14} strokeWidth={2.2} />
  if (sourceType === 'rss') return <Rss aria-hidden="true" size={14} strokeWidth={2.2} />
  return <Globe2 aria-hidden="true" size={14} strokeWidth={2.2} />
}

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
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [keywordFilterId, setKeywordFilterId] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('latest')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const prefersReducedMotion = useReducedMotionPreference()
  const pageSize = 6

  async function refresh() {
    const [nextKeywords, nextStories, health] = await Promise.all([
      requestJson<Keyword[]>('/api/keywords'),
      requestJson<Story[]>('/api/stories'),
      requestJson<Health>('/api/health'),
    ])
    setKeywords(nextKeywords)
    setStories(nextStories)
    setKeywordFilterId((currentKeywordId) => (
      currentKeywordId !== null && !nextKeywords.some((keyword) => keyword.id === currentKeywordId && keyword.enabled)
        ? null
        : currentKeywordId
    ))
    setNextScheduledAt(health.nextScheduledAt)
    setSourceStatus(health.sources)
    setError('')
    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(refresh).catch(() => {
      setError('无法连接情报服务，请确认本地 API 已启动。')
      setLoading(false)
    })
    const socket = io(API_URL)
    socket.on('scan:started', () => { setScanning(true); setStories([]); setPage(1) })
    socket.on('scan:completed', () => {
      setScanning(false)
      void refresh().catch(() => setError('扫描已完成，但最新情报未能刷新。'))
    })
    socket.on('scan:failed', () => {
      setScanning(false)
      setError('本次扫描未能完成，请稍后重试。')
    })
    socket.on('story:new', () => {
      void refresh().catch(() => setError('收到新信号，但列表未能刷新。'))
    })
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    const updateCountdown = () => {
      if (!nextScheduledAt) return
      const remaining = Math.max(0, new Date(nextScheduledAt).getTime() - Date.now())
      const totalSeconds = Math.floor(remaining / 1000)
      const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
      const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
      const seconds = (totalSeconds % 60).toString().padStart(2, '0')
      setCountdown(`${hours}:${minutes}:${seconds}`)
    }
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [nextScheduledAt])

  async function addKeyword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextPhrase = phrase.trim()
    if (!nextPhrase) return
    try {
      await requestJson<Keyword>('/api/keywords', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: nextPhrase }),
      })
      setPhrase('')
      await refresh()
    } catch {
      setError('未能添加监控词，请检查后重试。')
    }
  }

  async function toggleKeyword(keyword: Keyword) {
    try {
      await requestJson<{ ok: boolean }>(`/api/keywords/${keyword.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !keyword.enabled }),
      })
      await refresh()
    } catch {
      setError('未能更新监控词状态。')
    }
  }

  async function deleteKeyword(keyword: Keyword) {
    if (!window.confirm(`确定删除监控词“${keyword.phrase}”吗？`)) return
    try {
      await requestJson<void>(`/api/keywords/${keyword.id}`, { method: 'DELETE' })
      await refresh()
    } catch {
      setError('未能删除监控词。')
    }
  }

  async function scanNow() {
    setScanning(true)
    setStories([])
    setPage(1)
    try {
      await requestJson<{ status: string }>('/api/scans', { method: 'POST' })
    } catch {
      setScanning(false)
      setError('扫描请求未能发出，请稍后重试。')
    }
  }

  async function markStoryAsRead(storyId: number) {
    try {
      await requestJson<{ ok: boolean }>(`/api/stories/${storyId}/read`, { method: 'PATCH' })
      setStories((currentStories) => currentStories.map((story) => (
        story.id === storyId ? { ...story, readAt: new Date().toISOString() } : story
      )))
    } catch {
      setError('未能标记这条情报。')
    }
  }

  function resetFeedControls() {
    setSearchQuery('')
    setSourceFilter('all')
    setKeywordFilterId(null)
    setSortMode('latest')
    setPage(1)
  }

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase()
  const enabledKeywords = keywords.filter((keyword) => Boolean(keyword.enabled))
  const selectedKeywordPhrase = enabledKeywords.find((keyword) => keyword.id === keywordFilterId)?.phrase
  const filteredStories = stories.filter((story) => {
    const matchesSource = sourceFilter === 'all' || story.sourceType === sourceFilter
    const matchesKeyword = !selectedKeywordPhrase || story.keywordPhrase === selectedKeywordPhrase
    const searchableText = `${story.title} ${story.summary} ${story.sourceName} ${story.keywordPhrase}`.toLocaleLowerCase()
    return matchesSource && matchesKeyword && (!normalizedSearchQuery || searchableText.includes(normalizedSearchQuery))
  })
  const sortedStories = [...filteredStories].sort((left, right) => {
    if (sortMode === 'relevance') return right.relevanceScore - left.relevanceScore
    const leftTimestamp = publishedTimestamp(left.publishedAt)
    const rightTimestamp = publishedTimestamp(right.publishedAt)
    if (leftTimestamp === null && rightTimestamp === null) return 0
    if (leftTimestamp === null) return 1
    if (rightTimestamp === null) return -1
    return rightTimestamp - leftTimestamp
  })
  const pageCount = Math.max(1, Math.ceil(sortedStories.length / pageSize))
  const activePage = Math.min(page, pageCount)
  const visibleStories = sortedStories.slice((activePage - 1) * pageSize, activePage * pageSize)
  const sortedKeywords = [...keywords].sort((left, right) => Number(right.enabled) - Number(left.enabled))
  const nextScanLabel = nextScheduledAt ? new Date(nextScheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--'
  const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())
  const activeKeywordCount = keywords.filter((keyword) => keyword.enabled).length
  const twitterStoryCount = stories.filter((story) => story.sourceType === 'twitter').length
  const hasActiveFeedControls = Boolean(normalizedSearchQuery) || sourceFilter !== 'all' || keywordFilterId !== null || sortMode !== 'latest'

  return (
    <main className="app-shell">
      {!prefersReducedMotion && <div className="ambient-effects" aria-hidden="true">
        <Spotlight className="signal-spotlight" duration={9} height={1280} translateY={-420} width={720} xOffset={78} />
        <Meteors className="signal-meteors" number={9} />
        <BackgroundBeams className="signal-beams" beamCount={8} />
      </div>}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true"><Activity size={20} strokeWidth={2.4} /></span>
            <div><span className="brand-kicker">creator signal desk</span><strong>HOT MONITOR</strong></div>
          </div>
          <div className="header-actions">
            <div className="system-status" role="status">
              <span className={`status-dot ${scanning ? 'is-scanning' : ''}`} aria-hidden="true" />
              <span>{scanning ? '正在捕捉信号' : '情报台在线'}</span>
              <span className="status-detail">下次 {nextScanLabel} · {countdown || '--:--:--'}</span>
            </div>
            <button className="scan-action" type="button" onClick={scanNow} disabled={scanning}>
              {scanning ? <LoaderCircle className="is-spinning" aria-hidden="true" size={17} /> : <RefreshCw aria-hidden="true" size={17} />}
              <span>{scanning ? '扫描中' : '立即扫描'}</span>
            </button>
          </div>
        </div>
      </header>
      <section className="signal-overview" aria-labelledby="page-title">
        <div>
          <div className="eyebrow"><Sparkles aria-hidden="true" size={14} /> LIVE SIGNALS / {today}</div>
          <h1 id="page-title">快一步，看到真正值得分享的 <em>AI 热点。</em></h1>
          <p className="overview-copy">捕捉现在，分享下一刻。</p>
        </div>
        <div className="scan-clock" aria-label="下次自动扫描">
          <span>下一轮收集</span>
          <strong>{nextScanLabel}</strong>
          <small>{countdown ? `还有 ${countdown}` : '同步中'}</small>
        </div>
      </section>
      {error && <div className="error-notice" role="alert"><AlertTriangle aria-hidden="true" size={17} /><span>{error}</span><button type="button" aria-label="关闭提示" title="关闭提示" onClick={() => setError('')}><X aria-hidden="true" size={17} /></button></div>}
      <div className="workspace-grid">
        <aside className="watch-panel" aria-labelledby="watchlist-title">
          <div className="panel-heading">
            <div><div className="eyebrow">WATCHLIST</div><h2 id="watchlist-title">监控清单</h2></div>
            <span className="panel-count" aria-label={`${activeKeywordCount} 个启用的监控词`}>{activeKeywordCount.toString().padStart(2, '0')}</span>
          </div>
          <form className="keyword-form" onSubmit={addKeyword}>
            <label htmlFor="phrase">添加监控词</label>
            <div className="keyword-input">
              <input id="phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="例如：DeepSeek 更新" />
              <button type="submit" aria-label="添加关键词" title="添加关键词"><Plus aria-hidden="true" size={19} /></button>
            </div>
          </form>
          <div className="keyword-list">
            {sortedKeywords.map((keyword) => (
              <div className={`keyword ${keyword.enabled ? 'is-active' : ''}`} key={keyword.id}>
                <button className="keyword-toggle" type="button" aria-pressed={Boolean(keyword.enabled)} onClick={() => toggleKeyword(keyword)}>
                  <span className="keyword-indicator" aria-hidden="true" />
                  <span className="keyword-name">{keyword.phrase}</span>
                  <small>{keyword.enabled ? 'ON' : 'OFF'}</small>
                </button>
                <button className="keyword-delete" type="button" aria-label={`删除监控词 ${keyword.phrase}`} title="删除监控词" onClick={() => deleteKeyword(keyword)}><Trash2 aria-hidden="true" size={16} /></button>
              </div>
            ))}
            {!keywords.length && <p className="muted">等待第一个监控词。</p>}
          </div>
          <section className="source-health" aria-labelledby="source-status-title">
            <div className="section-heading"><span id="source-status-title">来源状态</span><span>30 MIN</span></div>
            <dl>
              <div><dt><Globe2 aria-hidden="true" size={15} />网页搜索</dt><dd className={sourceStatus.web === 'READY' ? 'is-ready' : 'is-config'}>{sourceStatus.web}</dd></div>
              <div><dt><Rss aria-hidden="true" size={15} />RSS 聚合</dt><dd className={sourceStatus.rss === 'READY' ? 'is-ready' : 'is-config'}>{sourceStatus.rss}</dd></div>
              <div><dt><AtSign aria-hidden="true" size={15} />X / Twitter</dt><dd className={sourceStatus.twitter === 'READY' ? 'is-ready' : 'is-config'}>{sourceStatus.twitter}</dd></div>
            </dl>
          </section>
        </aside>
        <section className="feed-panel" aria-labelledby="feed-title">
          <div className="feed-heading">
            <div><div className="eyebrow">SIGNAL STREAM</div><h2 id="feed-title">最新情报</h2></div>
            <span className="feed-count"><strong>{sortedStories.length.toString().padStart(2, '0')}</strong> 条</span>
          </div>
          <div className="feed-tools">
            <div className="search-field">
              <Search aria-hidden="true" size={17} />
              <label className="sr-only" htmlFor="signal-search">搜索情报</label>
              <input id="signal-search" type="search" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }} placeholder="搜索标题、来源或监控词" />
              {searchQuery && <button type="button" aria-label="清除搜索" title="清除搜索" onClick={() => { setSearchQuery(''); setPage(1) }}><X aria-hidden="true" size={16} /></button>}
            </div>
            <div className="filter-row" aria-label="按来源筛选">
              {SOURCE_FILTERS.map((filter) => <button className={sourceFilter === filter.id ? 'is-selected' : ''} key={filter.id} type="button" aria-pressed={sourceFilter === filter.id} onClick={() => { setSourceFilter(filter.id); setPage(1) }}>{filter.label}</button>)}
            </div>
            <div className="feed-selects">
              <label className="select-control" htmlFor="keyword-filter">
                <span>监控词</span>
                <select id="keyword-filter" value={keywordFilterId ?? ''} onChange={(event) => { setKeywordFilterId(event.target.value ? Number(event.target.value) : null); setPage(1) }}>
                  <option value="">全部监控词</option>
                  {enabledKeywords.map((keyword) => <option key={keyword.id} value={keyword.id}>{keyword.phrase}</option>)}
                </select>
              </label>
              <label className="select-control" htmlFor="story-sort">
                <span>排序</span>
                <select id="story-sort" value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setPage(1) }}>
                  <option value="latest">最新</option>
                  <option value="relevance">最相关</option>
                </select>
              </label>
              {hasActiveFeedControls && <button className="feed-reset" type="button" aria-label="重置情报筛选与排序" title="重置筛选与排序" onClick={resetFeedControls}><RotateCcw aria-hidden="true" size={17} /></button>}
            </div>
          </div>
          <div className="metric-strip" aria-label="当前情报概览">
            <div><span>已捕捉</span><strong>{stories.length}</strong></div>
            <div><span>X 信号</span><strong>{twitterStoryCount}</strong></div>
            <div><span>监控词</span><strong>{activeKeywordCount}</strong></div>
          </div>
          {loading ? <div className="loading-state" role="status"><LoaderCircle className="is-spinning" aria-hidden="true" size={24} />正在编排情报流</div> : visibleStories.length ? <><div className="story-list">{visibleStories.map((story) => <article className={`story-card ${story.readAt ? 'is-read' : 'is-unread'}`} key={story.id}>
            <div className="story-card-top">
              <div className="story-source"><span className="source-icon"><SourceGlyph sourceType={story.sourceType} /></span><span>{story.sourceName}</span></div>
              <div className="story-actions"><span className="story-time">{formatStoryTime(story)}</span><a className="icon-action" href={story.url} target="_blank" rel="noreferrer" aria-label={`打开原文：${story.title}`} title="打开原文"><ArrowUpRight aria-hidden="true" size={17} /></a>{story.readAt ? <span className="read-status"><Check aria-hidden="true" size={15} />已读</span> : <button className="icon-action" type="button" aria-label={`标记已读：${story.title}`} title="标记已读" onClick={() => markStoryAsRead(story.id)}><Eye aria-hidden="true" size={17} /></button>}</div>
            </div>
            <h3><a href={story.url} target="_blank" rel="noreferrer">{story.title}</a></h3>
            <p>{story.summary}</p>
            <footer className="story-footer"><span className="keyword-tag"><Sparkles aria-hidden="true" size={13} />{story.keywordPhrase}</span><div className="story-scores"><span>可信 <b>{Math.round(story.credibilityScore)}</b></span><span>相关 <b>{Math.round(story.relevanceScore)}</b></span></div></footer>
          </article>)}</div><nav className="pagination" aria-label="情报分页"><button type="button" disabled={activePage === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft aria-hidden="true" size={17} /><span>上一页</span></button><span>第 {activePage} / {pageCount} 页</span><button type="button" disabled={activePage === pageCount} onClick={() => setPage((current) => current + 1)}><span>下一页</span><ChevronRight aria-hidden="true" size={17} /></button></nav></> : <div className="empty-state"><Activity aria-hidden="true" size={28} /><strong>{stories.length ? '没有匹配的情报' : '情报流暂时安静'}</strong><span>{stories.length ? '换个来源或搜索词试试。' : '下一次捕捉正在准备。'}</span>{stories.length > 0 && hasActiveFeedControls && <button className="empty-reset" type="button" onClick={resetFeedControls}><RotateCcw aria-hidden="true" size={16} />重置筛选</button>}</div>}
        </section>
      </div>
    </main>
  )
}

export default App
