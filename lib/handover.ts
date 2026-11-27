import { getDb } from "./db";
import type { UserRow } from "./db";

/**
 * 客户项目交接模块的服务层：全部读写逻辑集中在此。
 * 设计要点（对应技术方案 DES-001/008/009）：
 * - SQLite datetime('now') 存 UTC，展示时统一用 formatLocalTime 转本地时区；
 * - 负载提醒口径：csm_user_id 命中即计数（分配即敲定、已分配即已承接）；
 * - 每周一 C360 提醒接口幂等：按 user+project+当日去重。
 */

// ---------- 行类型 ----------

export interface HandoverProjectRow {
  id: number;
  company_name: string;
  feishu_edition: string | null;
  seat_count: number | null;
  expiry_date: string | null;
  mau: number | null;
  contact_persons: string | null;
  key_decision_makers: string | null;
  ai_usage: string | null;
  usage_scenes: string | null;
  potential_risks: string | null;
  pending_todos: string | null;
  csm_user_id: number | null;
  consultant_user_id: number | null;
  group_status_docking: string;
  group_status_internal: string;
  group_status_customer: string;
  archive_doc_done: number;
  contact_added_at: string | null;
  service_started_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface HandoverActionRow {
  id: number;
  project_id: number;
  action_type: string;
  operator_user_id: number | null;
  operator_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface HandoverLinkRow {
  id: number;
  project_id: number;
  link_type: string;
  title: string;
  url: string;
  created_by: number | null;
  created_at: string;
}

export interface ClientMeetingRow {
  id: number;
  project_id: number;
  planned_at: string;
  status: string;
  note: string | null;
  created_at: string;
}

export interface HandoverReminderRow {
  id: number;
  user_id: number;
  project_id: number;
  kind: string;
  created_at: string;
  read_at: string | null;
}

// ---------- 常量 ----------

export const LINK_TYPES = {
  handover_doc: "来源方交接文档",
  meeting_minutes: "会议妙计",
  client_archive: "一客一档",
  client_meeting: "客户交接会议材料",
} as const;
export type LinkType = keyof typeof LINK_TYPES;

export const GROUP_FIELDS = {
  docking: "group_status_docking",
  internal: "group_status_internal",
  customer: "group_status_customer",
} as const;
export type GroupKey = keyof typeof GROUP_FIELDS;

export const GROUP_LABELS: Record<GroupKey, string> = {
  docking: "对接群",
  internal: "团队内部群",
  customer: "客户服务群",
};

export const ACTION_LABELS: Record<string, string> = {
  assign_csm: "分配 CSM",
  assign_consultant: "指派实施顾问",
  record_contacts: "记录添加客户联系人",
  service_start_change: "变更服务开始时间",
  group_status: "群组状态变更",
  archive_doc: "一客一档勾选",
  client_meeting: "客户交接会议",
};

/** 负载提醒三档线（DES-008） */
const LOAD_LEVELS = [
  { min: 20, label: "警告", color: "red" },
  { min: 15, label: "饱和", color: "orange" },
  { min: 10, label: "繁忙", color: "yellow" },
] as const;

export interface LoadInfo {
  count: number;
  /** 达到提醒线时为繁忙/饱和/警告，未达线为 null */
  label: string | null;
  /** 徽标颜色：red / orange / yellow；未达线为 null */
  color: "red" | "orange" | "yellow" | null;
  text: string | null;
}

// ---------- 时间工具 ----------

/**
 * SQLite 里存的 datetime('now') 是 UTC 的「YYYY-MM-DD HH:MM:SS」。
 * 展示统一转服务器本地时区并格式化为 YYYY-MM-DD HH:mm。
 */
export function formatLocalTime(utcText: string | null): string | null {
  if (!utcText) return null;
  const iso = utcText.includes("T") ? utcText : `${utcText.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return utcText; // 非法值原样返回，不猜测
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 当前本地时间，格式化为可直接落库的 YYYY-MM-DD HH:MM:SS（本地时区） */
export function nowLocalText(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

// ---------- 项目查询 ----------

/** 项目池列表（本期所有用户可见全部，无权限过滤） */
export function listHandoverProjects(): HandoverProjectRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM handover_projects ORDER BY created_at DESC, id DESC")
    .all() as HandoverProjectRow[];
}

export function getHandoverProject(id: number): HandoverProjectRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM handover_projects WHERE id = ?")
    .get(id) as HandoverProjectRow | undefined;
  return row ?? null;
}

export function getUserName(userId: number | null): string | null {
  if (!userId) return null;
  const db = getDb();
  const row = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as
    | { name: string }
    | undefined;
  return row?.name ?? null;
}

/** 全部可选人员（分配 CSM / 指派实施顾问用，本期所有成员可选） */
export function listUsers(): UserRow[] {
  const db = getDb();
  return db
    .prepare("SELECT id, feishu_union_id, name, avatar_url FROM users ORDER BY name")
    .all() as UserRow[];
}

// ---------- 留痕 ----------

function logAction(params: {
  projectId: number;
  actionType: string;
  operator: UserRow;
  oldValue?: string | null;
  newValue?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO handover_actions (project_id, action_type, operator_user_id, operator_name, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    params.projectId,
    params.actionType,
    params.operator.id,
    params.operator.name,
    params.oldValue ?? null,
    params.newValue ?? null
  );
}

export function listActions(projectId: number): HandoverActionRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM handover_actions WHERE project_id = ? ORDER BY created_at DESC, id DESC"
    )
    .all(projectId) as HandoverActionRow[];
}

// ---------- 负载提醒（DES-008） ----------

/** CSM 已承接项目数：分配即敲定，csm_user_id 命中即计数 */
export function loadOfCsm(csmUserId: number): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM handover_projects WHERE csm_user_id = ?")
    .get(csmUserId) as { c: number };
  return row.c;
}

export function loadInfoOfCsm(csmUserId: number): LoadInfo {
  const count = loadOfCsm(csmUserId);
  for (const lv of LOAD_LEVELS) {
    if (count >= lv.min) {
      return { count, label: lv.label, color: lv.color, text: `该 CSM 已承接 ${count} 个项目，处于${lv.label}水平` };
    }
  }
  return { count, label: null, color: null, text: null };
}

// ---------- 站内提醒（DES-009） ----------

/**
 * 生成每周 C360 维护提醒：对「已进入交接流程（service_started_at 非空或已分配 CSM）」
 * 的项目，向其 CSM 写入站内提醒。幂等：同 user+project+当日只生成一条。
 * 返回各 CSM 新生成的提醒（按用户合并展示用）。
 */
export function generateC360Reminders(): { userId: number; userName: string; projects: string[] }[] {
  const db = getDb();
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const rows = db
    .prepare(
      `SELECT p.id AS project_id, p.company_name, u.id AS user_id, u.name AS user_name
       FROM handover_projects p JOIN users u ON u.id = p.csm_user_id
       WHERE p.csm_user_id IS NOT NULL OR p.service_started_at IS NOT NULL
       ORDER BY u.id, p.id`
    )
    .all() as { project_id: number; company_name: string; user_id: number; user_name: string }[];

  const insert = db.prepare(
    `INSERT INTO handover_reminders (user_id, project_id, kind, dedup_key)
     VALUES (?, ?, 'c360_maintenance', ?)
     ON CONFLICT(dedup_key) DO NOTHING`
  );
  const generated = new Map<number, { userId: number; userName: string; projects: string[] }>();
  for (const r of rows) {
    const dedupKey = `c360|${r.user_id}|${r.project_id}|${dayKey}`;
    const res = insert.run(r.user_id, r.project_id, dedupKey);
    if (res.changes > 0) {
      const entry = generated.get(r.user_id) ?? { userId: r.user_id, userName: r.user_name, projects: [] };
      entry.projects.push(r.company_name);
      generated.set(r.user_id, entry);
    }
  }
  return Array.from(generated.values());
}

export interface ReminderItemRow extends HandoverReminderRow {
  company_name: string;
}

/** 某用户的未读提醒（顶栏角标 + 下拉列表） */
export function listUnreadReminders(userId: number): ReminderItemRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.*, p.company_name FROM handover_reminders r
       JOIN handover_projects p ON p.id = r.project_id
       WHERE r.user_id = ? AND r.read_at IS NULL
       ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(userId) as ReminderItemRow[];
}

export function markReminderRead(reminderId: number, userId: number): void {
  const db = getDb();
  db.prepare(
    "UPDATE handover_reminders SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL"
  ).run(nowLocalText(), reminderId, userId);
}

export { logAction };

/** 项目的交接材料链接列表（倒序） */
export function listLinks(projectId: number): HandoverLinkRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM handover_links WHERE project_id = ? ORDER BY created_at DESC, id DESC")
    .all(projectId) as HandoverLinkRow[];
}

/** 项目的客户交接会议列表（按约定时间升序） */
export function listClientMeetings(projectId: number): ClientMeetingRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM handover_client_meetings WHERE project_id = ? ORDER BY planned_at ASC, id ASC")
    .all(projectId) as ClientMeetingRow[];
}
