import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const databasePath = process.env.DATABASE_PATH ?? './data/hot-monitor.db'
fs.mkdirSync(path.dirname(databasePath), { recursive: true })

export const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.exec(fs.readFileSync(path.join(process.cwd(), 'src/db/schema.sql'), 'utf8'))

export function now() {
  return new Date().toISOString()
}
