# Hot Monitor 学习指南

面向第一次打开本仓库的开发者：先理解产品在做什么，再按文件顺序把采集、判定、存储、通知和前端串起来。

配套产品文档：

- [01-requirements.md](./01-requirements.md) — 产品目标与 MVP 范围
- [02-solution.md](./02-solution.md) — 技术选型与安全约定
- [03-database.md](./03-database.md) — SQLite 表结构
- [04-development-and-acceptance.md](./04-development-and-acceptance.md) — 阶段验收

---

## 1. 这个项目是什么

Hot Monitor 是一个给 **AI 编程内容创作者** 用的热点雷达：你添加关键词，系统定时（默认对齐整点/半点，每 30 分钟）从可信 RSS、可选网页/新闻发现和经过质量门槛的 X/Twitter 抓内容，用 DeepSeek（或本地规则兜底）判断「关键词是否是核心事件、是否技术向、可信度多少」，再按来源配额筛选后实时推送，高可信时还可以发邮件。

它不是搜索引擎，也不是多用户 SaaS。单机 Web 控制台 + 本机 SQLite，密钥只放服务端环境变量。

本地默认入口：

| 角色 | 地址 | 启动方式 |
|---|---|---|
| 前端（Vite + React） | http://localhost:5173 | `npm run dev` 的 client 进程 |
| 后端（Express + Socket.IO） | http://localhost:8787 | `npm run dev` 的 server 进程 |
| Debug | VS Code / Cursor 配置「启动 Hot Monitor」 | `.vscode/launch.json` |

---

## 2. 建议具备的基础

读代码前不需要会 DeepSeek，但最好熟悉：

1. TypeScript 模块（本仓库 `"type": "module"`，导入带 `.js` 后缀）。
2. Express 路由与 JSON API。
3. React `useState` / `useEffect`。
4. SQL 主键、唯一约束、外键。
5. 环境变量与 `.env`（不要把 Key 写进前端或提交 Git）。

---

## 3. 推荐阅读顺序

按这个顺序读，心智负担最小。每一步都对应一个「可运行的问题」。

| 步 | 读什么 | 带着什么问题读 |
|---|---|---|
| 1 | `docs/01-requirements.md`、`docs/02-solution.md` | 用户能做什么？明确不做哪些？ |
| 2 | `package.json`、`.env.example` | 前后端怎么一起起？缺哪些 Key 仍能跑？ |
| 3 | `src/types.ts`、`src/db/schema.sql`、`src/db/index.ts` | 一条热点在库里长什么样？ |
| 4 | `src/server.ts` | 浏览器能调哪些 API？Socket 何时创建？ |
| 5 | `src/schedule.ts`、`tests/schedule.test.ts` | 为什么不是 `setInterval` 直接 30 分钟？ |
| 6 | `src/sources.ts` | 适配器如何互不影响？RSS 是怎么解析的？ |
| 7 | `src/ai.ts` | 没有 API Key 时会发生什么？JSON 如何校验？ |
| 8 | `src/scan.ts` | 一次扫描的事务顺序是什么？为何会清空旧数据？ |
| 9 | `src/notifications.ts` | 站内推送和邮件的触发条件差在哪？ |
| 10 | `client/src/App.tsx` | 前端如何订阅扫描状态并刷新列表？ |
| 11 | `tests/health.test.ts` | 测试如何避免真正 `listen`？ |

---

## 4. 目录与职责

```text
hot_monitor/
  src/                 后端 TypeScript
    server.ts          组合根：HTTP + Socket.IO + 启动调度
    scan.ts            扫描编排（采集 → 去重 → AI → 入库 → 通知）
      sources.ts         来源适配器（RSS、网页/新闻、质量筛选后的 X）
      source-policy.ts   可信来源、X 作者门槛和分数/配额配置
      story-selection.ts 入库前的相关性、可信度与来源多样性筛选
      ai.ts              DeepSeek 判定 + Zod 校验 + 本地兜底
    schedule.ts        对齐 :00 / :30 的定时器
    notifications.ts   Socket.IO 广播 + SMTP 邮件
    types.ts           前端列表用的 Story 形状
    db/schema.sql      建表与索引
    db/index.ts        better-sqlite3 连接、WAL、启动执行 schema
  client/src/          前端
    App.tsx            唯一页面：关键词、扫描、情报流
    App.css            「夜间情报台」视觉
  tests/               Vitest
  docs/                需求 / 方案 / 库表 / 验收
  data/hot-monitor.db  运行后生成的 SQLite 文件
```

根目录 `npm run dev` 用 `concurrently` 同时跑 `tsx watch src/server.ts` 和 Vite。生产则 `npm run build` 后 `npm start`（`node dist/server.js`）。

---

## 5. 一次扫描怎么走

这是本项目最值得画在纸上的路径。手动点「清空并重新扫描」或定时触发，都会进入 `runScan`。

```text
POST /api/scans 或 半点调度
        │
        ▼
  runScan(io, trigger)          src/scan.ts
        │  若已有扫描在跑 → 直接 skipped
        │  写入 scan_runs(status=running)
        │  io.emit('scan:started')
        │  DELETE story_matches + stories     ← 每次全量清空
        ▼
  collectStories(phrases)       src/sources.ts
        │  RSS × 8 + 每个关键词一次网页/新闻发现 + 一次 X
        │  X 先经过白名单或认证/粉丝/互动门槛；网页只留可信域名
        │  Promise.allSettled：单个来源失败不影响其他
        ▼
  对每条 RawStory × 每个启用关键词
        │  evaluateStory：关键词必须是核心事件
        ▼
  selectDiverseStories(...)     src/story-selection.ts
        │  相关性 / 关键词聚焦度 / 可信度达标
        │  限制 X 的总数、回退数与占比，优先 RSS / Web
        ▼
  对最终候选
        │  sha256(title|content) 去重并写入 stories / story_matches
        ▼
  notifyNewStory(...)           src/notifications.ts
        │  一定 io.emit('story:new')
        │  仅当 credibilityScore >= notifyThreshold 才发邮件
        ▼
  scan_runs → completed
  io.emit('scan:completed')
```

前端收到 `scan:started` 会清空列表并显示「正在扫描」；收到 `scan:completed` 再 `GET /api/stories` 拉最新结果。

**学习时务必抓住两点：**

1. **扫描是全量快照，不是增量历史。** `runScan` 开头会删掉全部 `stories` 和 `story_matches`。按钮文案「清空并重新扫描」就是这个语义。
2. **质量筛选在入库前完成。** `scan.ts` 先评估所有候选，再由 `selectDiverseStories` 检查相关性、关键词聚焦度、可信度和 X 来源比例；AI 失败会得到 0 分兜底，因此不会写入 `story_matches` 或发高优先级邮件。

---

## 6. 模块精读要点

### 6.1 `server.ts` — 组合根

- Express 与 Socket.IO 共用同一个 `http.Server`。
- 请求体用 Zod 校验关键词（长度、阈值 0–100）。
- `NODE_ENV === 'test'` 时不 `listen`、不启动调度，方便 Supertest。
- 健康检查会如实报告来源配置：RSS 始终 `READY`；网页/新闻发现取决于 `FIRECRAWL_API_KEY`；X 取决于是否配置 `TWITTERAPI_API_KEY`。

REST 一览：

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/health` | 服务状态、下次扫描时间、来源配置状态 |
| GET/POST | `/api/keywords` | 列出 / 新增关键词 |
| PATCH | `/api/keywords/:id` | 启用或暂停 |
| DELETE | `/api/keywords/:id` | 删除 |
| GET | `/api/stories` | 最近 100 条匹配结果（JOIN 三表） |
| PATCH | `/api/stories/:id/read` | 标记已读 |
| GET | `/api/scans/latest` | 最近一次扫描记录 |
| POST | `/api/scans` | 202 立即返回，后台 `runScan(..., 'manual')` |

Socket 事件：`monitor:connected`、`scan:started`、`scan:completed`、`scan:failed`、`story:new`。

### 6.2 `sources.ts` — 适配器

统一出口类型是 `RawStory`（title / url / sourceName / sourceType / publishedAt / content / sourceQuality）。

当前实现：

- RSS：Hugging Face、OpenAI、Google AI、AWS Machine Learning、Microsoft Research、GitHub、TechCrunch AI 与 VentureBeat AI。每源最多取 8 条，用正则从 XML 抽 `<item>` / `<entry>`，不是完整 XML 解析器。
- 网页/新闻：配置 `FIRECRAWL_API_KEY` 后按关键词经 Firecrawl 发现；只保留 `source-policy.ts` 中的一线或可信域名。
- X/Twitter：无 Key 则返回 `[]`；有 Key 后按关键词查 `twitterapi.io`，但只接受可信账号，或同时满足认证、粉丝和互动门槛的账号。每个关键词默认最多保留 3 条。
- 入库前：`story-selection.ts` 进一步要求技术相关、关键词聚焦、相关性和可信度达标，并将 X 默认限制在主情报流的 35% 以内。

`Promise.allSettled` 保证「一个 feed 挂了，其他来源照样入库」。这是多来源系统的标准写法。

### 6.3 `ai.ts` — 判定

有 `DEEPSEEK_API_KEY` 时调用 `https://api.deepseek.com/chat/completions`，`response_format: json_object`，正文截断到 6000 字。返回必须过 `verdictSchema`（Zod）：`relevant`、`technical`、`contentType`、相关性、关键词聚焦度、可信度、分类、摘要、关键事实、理由。仅“关键词是核心技术事件”才允许 `relevant=true`。

没有 Key 时走本地正则 `technicalSignals`：仅当关键词直接出现在技术内容中才保留，并继承来源质量作为可信度；仍会经过入库前质量/配额筛选。

### 6.4 `schedule.ts` — 对齐时钟

`getNextHalfHour` 把下一次运行钉在本地时钟的 `:00` 或 `:30`，再 `setTimeout` 等到那个时刻，之后才 `setInterval(30min)`。这样多实例/重启后仍对齐「整点情报」，而不是「启动后再过 30 分钟」。测试覆盖了半点前、半点后、恰好半点三种情况。

注意：`.env` 里的 `SCAN_INTERVAL_MINUTES` **目前没有被读取**，间隔写死在调度与 health 响应里。

### 6.5 `notifications.ts` — 双通道

- 站内：始终 `io.emit('story:new')`。
- 邮件：可信度达标 **并且** 配置了 `SMTP_HOST` + `MAIL_TO`。邮件失败在 `scan.ts` 里被 `.catch(() => false)` 吞掉，不拖垮扫描。

### 6.6 数据库

五张表：`watch_keywords`、`stories`、`story_matches`、`scan_runs`、`app_settings`。

核心关系：一篇 `stories` 可以匹配多个关键词（`story_matches` 上 `UNIQUE(story_id, keyword_id)`）。URL 与 `content_hash` 都有唯一约束，用于去重。

`app_settings` 已建表，**业务代码尚未使用**。敏感凭据按设计不落库。

启动时 `db.exec(schema.sql)` + WAL。`better-sqlite3` 是同步 API，扫描循环里直接 `prepare().run()` 即可。

### 6.7 前端 `App.tsx`

单文件控制台，没有路由库。

- `VITE_API_URL` 默认 `http://localhost:8787`。
- 挂载时拉 keywords / stories / health，并连接 Socket.IO。
- 情报流每页 6 条，可按来源筛选和搜索；侧栏可增删启停关键词。
- 卡片展示来源、关键词、相关性、可信度和已读状态；已读接口已接入 UI。

视觉约定见方案文档：夜间情报台、酸橙黄表示新情报。CSS 集中在 `client/src/App.css`。

---

## 7. 配置与安全

复制 `.env.example` 为 `.env`。最低可运行只需端口和数据库路径；DeepSeek、Firecrawl、Twitter、SMTP 都是增强项。

必须遵守：

- Key 只出现在服务端 `.env`，前端只有 `VITE_API_URL`。
- CORS / Socket origin 用 `CLIENT_ORIGIN`，默认 `http://localhost:5173`。
- 采集 `fetch` 带 10s 超时；AI 30s 超时。
- `FIRECRAWL_API_KEY` 只启用可信网页/新闻发现；`TWITTER_TRUSTED_ACCOUNTS`、`TWITTER_MIN_FOLLOWERS`、`TWITTER_MIN_ENGAGEMENT`、`TWITTER_MAX_SHARE` 和三个 `MIN_*_SCORE` 用于调整内容质量门槛。
- 当严格结果不足 `MIN_STORIES_PER_SCAN`（默认 8）时，仅来源质量达到 `TRUSTED_FALLBACK_MIN_SOURCE_QUALITY`（默认 90）的 RSS/Web 内容可按两项 `TRUSTED_FALLBACK_MIN_*_SCORE` 较温和地补位；X/Twitter 永不走此回退。

---

## 8. 文档与实现的差异（读代码时不要被文档带偏）

这些不是「文档写错了就忽略」，而是学习时用来对照「设计意图 vs 当前 MVP」的清单：

| 文档说法 | 当前代码 |
|---|---|
| `SCAN_INTERVAL_MINUTES` 可配 | 调度写死 30 分钟 |
| 热点按时间累积查看 | 每次扫描删除全部 stories / matches |
| `app_settings` 存邮件与扫描状态 | 表存在，无读写 |
| `story_matches.notified_at` | 字段存在，通知函数未回写 |

把差异记下来，比把文档背熟更有用：你能判断下一步该补产品还是补实现。

---

## 9. 动手练习

按难度从低到高，做完能验证自己真的读懂了编排层。

1. **跑通闭环**：加一个关键词，点扫描，看 `scan_runs` 与页面列表是否一致（可用任意 SQLite 客户端打开 `data/hot-monitor.db`）。
2. **关掉 DeepSeek Key** 再扫一次：确认技术向内容仍可能出现，但不会发邮件（可信度为 0）。
3. **只配 RSS、不配 Twitter**：确认 Twitter 状态为 `CONFIG`，扫描仍能完成；配置 Firecrawl 后确认网页状态变为 `READY`。
4. **给 `evaluateStory` 写一个单测**：伪造非法 JSON，断言 Zod 抛错，且 `runScan` 不会把该条写成高可信匹配。
5. **把间隔改成读环境变量**：让 `.env` 的 `SCAN_INTERVAL_MINUTES` 真正生效，并改 health 与测试。
6. **增量扫描**：去掉每次 DELETE，改为按 URL / hash 跳过已存在内容，并给 UI 一个「不清空」的扫描按钮。
7. **调整来源策略**：将一个账号加入 `TWITTER_TRUSTED_ACCOUNTS`，或调整 `TWITTER_MAX_SHARE`，然后观察主情报流中的来源分布。

---

## 10. 读完应能回答的问题

1. 为什么 `import` 写 `./db/index.js` 而源文件是 `.ts`？
2. 手动扫描为什么返回 202 而不是 200 + 完整结果？
3. `Promise.allSettled` 和 `Promise.all` 在采集里差在哪？
4. 没有 DeepSeek 时，系统如何避免「假高可信」？
5. 为什么调度要对齐半点，而不是进程启动后立刻每 30 分钟？
6. Socket 推送和 REST 拉列表如何避免状态打架？
7. 若 RSS XML 结构变了，应该改哪一层，才不碰到 AI 和数据库？
