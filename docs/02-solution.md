# Hot Monitor 技术方案

## 1. 总体规划

开发顺序固定为：

1. 基础框架搭建
2. 数据库设计（SQLite 表结构）
3. 热点数据获取
4. AI 集成
5. 前端 UI 开发
6. 通知系统（WebSocket 和邮件）
7. 测试验收

每个阶段都先形成可运行结果，再进入下一阶段。

## 2. 技术选型

- 前端：React、Vite、TypeScript、原生 CSS
- 后端：Node.js、Express、TypeScript
- 实时通信：Socket.IO
- 数据库：SQLite + better-sqlite3
- AI：DeepSeek Chat Completions，OpenAI 兼容协议
- 邮件：Nodemailer SMTP
- 测试：Vitest、Supertest

## 3. 服务边界

```text
Browser
  -> Express REST API
  -> Socket.IO notification channel

Scheduler
  -> Source adapters
  -> Normalizer and deduplicator
  -> DeepSeek classifier
  -> SQLite repositories
  -> Socket.IO + Nodemailer notification services
```

## 4. DeepSeek 接入原则

- 使用服务端环境变量 `DEEPSEEK_API_KEY`。
- Base URL：`https://api.deepseek.com`。
- 默认模型通过 `DEEPSEEK_MODEL` 配置，默认值为 `deepseek-chat`。
- 使用 JSON 输出模式，并在服务端做 schema 校验。
- 发送给模型的文本截断到合理长度，避免无界输入。
- API 超时、限流和返回格式异常都要进入错误日志，不产生高可信通知。

## 5. 数据采集原则

采集器统一输出 `RawStory`：

- `title`
- `url`
- `sourceName`
- `sourceType`
- `publishedAt`
- `content`
- `externalId`

不同来源通过适配器隔离：`web-search`、`rss`、`twitter`。任何一个来源失败都不阻塞其他来源。

## 6. UI 视觉方向

产品采用“夜间情报台”视觉：

- 背景：深墨绿与暖灰，不使用紫色默认风格。
- 强调色：酸橙黄表示新情报，珊瑚红表示低可信风险，青绿色表示已验证。
- 标题字体：`Space Grotesk`。
- 正文字体：`Noto Sans SC`。
- 数据和标签：`IBM Plex Mono`。
- 核心签名：情报流顶部的扫描仪状态条，随采集状态显示脉冲和最近扫描时间。

布局以信息流为中心，不使用营销式 Hero 或嵌套卡片。桌面端为三栏，移动端为单栏。

## 7. 安全与配置

```env
PORT=8787
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/hot-monitor.db
SCAN_INTERVAL_MINUTES=30
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
TWITTERAPI_API_KEY=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
MAIL_TO=
```

真实凭据只写入本机 `.env`，`.env` 必须被 Git 忽略。

## 8. 风险与应对

- 网页结构变化：采集器做成独立适配器，并保存失败状态。
- 搜索或 X API 限额：缓存查询、顺序限频、多来源降级。
- AI 误判：展示判定理由和来源，默认对低分内容不发邮件。
- 邮件服务不可用：站内通知和 WebSocket 不受影响。
- 本机进程停止：在运行状态面板显示最后一次扫描与错误信息。
