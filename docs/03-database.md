# SQLite 数据库设计

## 1. `watch_keywords`

监控关键词配置。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| phrase | TEXT UNIQUE | 监控关键词 |
| scope | TEXT | 监控范围 |
| enabled | INTEGER | 是否启用 |
| notify_threshold | INTEGER | 邮件通知最低可信度 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

## 2. `stories`

统一后的热点内容。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| url | TEXT UNIQUE | 原始链接 |
| title | TEXT | 原始标题 |
| source_name | TEXT | 来源名称 |
| source_type | TEXT | web、rss、twitter |
| published_at | TEXT | 来源发布时间 |
| content | TEXT | 内容摘要或正文片段 |
| content_hash | TEXT UNIQUE | 内容指纹 |
| discovered_at | TEXT | 发现时间 |
| created_at | TEXT | 入库时间 |

## 3. `story_matches`

热点与关键词的匹配结果及 AI 判定。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| story_id | INTEGER FK | 热点 ID |
| keyword_id | INTEGER FK | 关键词 ID |
| relevance_score | INTEGER | 相关性 0-100 |
| credibility_score | INTEGER | 可信度 0-100 |
| classification | TEXT | verified、unverified、misleading、irrelevant |
| summary | TEXT | AI 中文摘要 |
| key_facts_json | TEXT | 关键事实 JSON |
| reasoning | TEXT | 判定理由 |
| evaluated_at | TEXT | 判定时间 |
| notified_at | TEXT | 通知时间 |
| read_at | TEXT | 已读时间 |

约束：`UNIQUE(story_id, keyword_id)`。

## 4. `scan_runs`

记录每次采集任务。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| trigger | TEXT | scheduled 或 manual |
| status | TEXT | running、completed、failed |
| source_count | INTEGER | 处理来源数量 |
| story_count | INTEGER | 发现内容数量 |
| error_message | TEXT | 错误信息 |
| started_at | TEXT | 开始时间 |
| finished_at | TEXT | 完成时间 |

## 5. `app_settings`

轻量应用配置，例如邮件接收地址和最近扫描状态。敏感凭据不落库，统一从环境变量读取。

## 索引

- `stories(discovered_at DESC)`
- `story_matches(keyword_id, evaluated_at DESC)`
- `story_matches(credibility_score DESC)`
- `scan_runs(started_at DESC)`
