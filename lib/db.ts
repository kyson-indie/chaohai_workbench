import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite 数据库（文件库）。
 * 账号模型：users 主表（飞书 union_id 唯一）+ user_identities 平台绑定表 + sessions 会话表。
 * 将来绑定企业微信等平台时，只需往 user_identities 里加 platform='wecom' 的记录。
 */

const DATA_DIR = process.env.WORKBENCH_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "workbench.db");

// 全局单例，避免开发模式下每个请求都重新打开数据库连接
const globalForDb = globalThis as unknown as { __workbenchDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__workbenchDb) return globalForDb.__workbenchDb;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feishu_union_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 平台账号绑定表：同一 user_id 可绑定多个平台账号（feishu / wecom / ...）
    CREATE TABLE IF NOT EXISTS user_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      platform TEXT NOT NULL,
      platform_user_id TEXT NOT NULL,
      tenant_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (platform, platform_user_id)
    );

    -- 会话表：Cookie 里只存随机 token，不存任何飞书凭证
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);

  globalForDb.__workbenchDb = db;
  return db;
}

export interface UserRow {
  id: number;
  feishu_union_id: string;
  name: string;
  avatar_url: string | null;
}
