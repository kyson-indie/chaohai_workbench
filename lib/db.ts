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

    -- ===== 客户项目交接模块（story 7184169862）=====
    -- 交接项目主表：一项目一行；仅 company_name 必填，其余字段后续环节补充
    CREATE TABLE IF NOT EXISTS handover_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      -- 项目基础信息（均非必填，补充录入）
      feishu_edition TEXT,
      seat_count INTEGER,
      expiry_date TEXT,
      mau INTEGER,
      contact_persons TEXT,
      key_decision_makers TEXT,
      ai_usage TEXT,
      usage_scenes TEXT,
      potential_risks TEXT,
      pending_todos TEXT,
      -- 人员分配（users.id）
      csm_user_id INTEGER REFERENCES users(id),
      consultant_user_id INTEGER REFERENCES users(id),
      -- 三类群组状态：pending 未完成 / done 已完成（仅展示，不做流程卡点）
      group_status_docking TEXT NOT NULL DEFAULT 'pending',
      group_status_internal TEXT NOT NULL DEFAULT 'pending',
      group_status_customer TEXT NOT NULL DEFAULT 'pending',
      -- 一客一档「已完善」勾选（0/1，由 CSM 人工勾选，系统不校验内容）
      archive_doc_done INTEGER NOT NULL DEFAULT 0,
      -- 服务开始时间（记录添加客户联系人动作时认定）
      contact_added_at TEXT,
      service_started_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_handover_projects_csm ON handover_projects(csm_user_id);

    -- 动作留痕表：分配 / 指派 / 记录联系人 / 服务开始时间变更 / 群组状态变更等操作流水
    CREATE TABLE IF NOT EXISTS handover_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES handover_projects(id),
      -- assign_csm / assign_consultant / record_contacts / service_start_change / group_status / archive_doc / client_meeting
      action_type TEXT NOT NULL,
      operator_user_id INTEGER REFERENCES users(id),
      operator_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_handover_actions_project ON handover_actions(project_id, created_at DESC);

    -- 交接材料链接表：一项目多链接
    CREATE TABLE IF NOT EXISTS handover_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES handover_projects(id),
      -- handover_doc 来源方交接文档 / meeting_minutes 会议妙计 / client_archive 一客一档 / client_meeting 客户交接会议材料
      link_type TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_handover_links_project ON handover_links(project_id);

    -- 客户交接会议表：一项目多场
    CREATE TABLE IF NOT EXISTS handover_client_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES handover_projects(id),
      planned_at TEXT NOT NULL,
      -- scheduled 已安排 / done 已完成
      status TEXT NOT NULL DEFAULT 'scheduled',
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_handover_meetings_project ON handover_client_meetings(project_id);

    -- 站内提醒表：每周 C360 维护提醒（周一 10 点由服务器 crontab curl 触发生成）
    CREATE TABLE IF NOT EXISTS handover_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER NOT NULL REFERENCES handover_projects(id),
      -- c360_maintenance 等
      kind TEXT NOT NULL,
      -- 幂等去重键：同 user+project+kind+当日只生成一条
      dedup_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_handover_reminders_user ON handover_reminders(user_id, read_at);
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
