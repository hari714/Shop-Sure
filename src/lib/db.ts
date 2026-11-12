// Small local cache + event log. PayPal stays the source of truth for all trust data.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const g = globalThis as unknown as { __shopsureDb?: DatabaseSync };

// Opened lazily so build-time workers never touch the file.
export function getDb(): DatabaseSync {
  if (g.__shopsureDb) return g.__shopsureDb;
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "shopsure.db"), { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS shops (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      site_url TEXT NOT NULL,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_slug TEXT,
      kind TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS score_cache (
      shop_slug TEXT PRIMARY KEY,
      report TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  g.__shopsureDb = db;
  return db;
}

export function logEvent(shopSlug: string | null, kind: string, detail: unknown) {
  getDb()
    .prepare("INSERT INTO events (shop_slug, kind, detail, created_at) VALUES (?, ?, ?, ?)")
    .run(shopSlug, kind, JSON.stringify(detail), Date.now());
}

export function recentEvents(shopSlug: string, limit = 20) {
  return getDb()
    .prepare("SELECT kind, detail, created_at FROM events WHERE shop_slug = ? ORDER BY id DESC LIMIT ?")
    .all(shopSlug, limit) as { kind: string; detail: string; created_at: number }[];
}
