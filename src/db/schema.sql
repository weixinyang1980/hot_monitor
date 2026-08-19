PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS watch_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phrase TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'AI 大模型、AI 编程、开源模型、科技公司动态',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  published_at TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  discovered_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS story_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  keyword_id INTEGER NOT NULL REFERENCES watch_keywords(id) ON DELETE CASCADE,
  relevance_score INTEGER NOT NULL DEFAULT 0,
  credibility_score INTEGER NOT NULL DEFAULT 0,
  classification TEXT NOT NULL DEFAULT 'unverified',
  summary TEXT NOT NULL,
  key_facts_json TEXT NOT NULL DEFAULT '[]',
  reasoning TEXT NOT NULL DEFAULT '',
  evaluated_at TEXT NOT NULL,
  notified_at TEXT,
  read_at TEXT,
  UNIQUE(story_id, keyword_id)
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  story_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_discovered_at ON stories(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_matches_keyword_time ON story_matches(keyword_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_matches_credibility ON story_matches(credibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at ON scan_runs(started_at DESC);
