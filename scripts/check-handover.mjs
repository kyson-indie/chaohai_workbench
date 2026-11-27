#!/usr/bin/env node
/**
 * 交接模块冒烟自测脚本（node scripts/check-handover.mjs）
 *
 * 前提：dev 服务已启动，且以 WORKBENCH_DATA_DIR 指向测试数据目录。
 * 做法：直接向测试 SQLite 库插入一个临时用户与会话（模拟已登录），
 * 然后按业务顺序调用各 API 并断言关键行为。全部跑在测试数据目录上，
 * 不触碰生产数据。
 *
 * 用法：
 *   WORKBENCH_DATA_DIR=<dir> BASE_URL=http://127.0.0.1:3199 node scripts/check-handover.mjs
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3199";
const DATA_DIR = process.env.WORKBENCH_DATA_DIR;
if (!DATA_DIR) {
  console.error("请设置 WORKBENCH_DATA_DIR 指向测试数据目录");
  process.exit(1);
}
const DB_PATH = path.join(DATA_DIR, "workbench.db");
if (!fs.existsSync(DB_PATH)) {
  console.error(`测试库不存在：${DB_PATH}（请先以同一 WORKBENCH_DATA_DIR 启动 dev 服务）`);
  process.exit(1);
}

const db = new Database(DB_PATH);
const TOKEN = "smoke-test-token-" + Date.now();
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.error(`✗ ${name} ${detail}`);
  }
}

async function api(method, url, body, withAuth = true) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(withAuth ? { cookie: `workbench_session=${TOKEN}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 空响应体 */
  }
  return { status: res.status, data };
}

// ---------- 0. 准备：临时用户 + 会话 ----------
const uid = Number(
  db
    .prepare("INSERT INTO users (feishu_union_id, name) VALUES (?, '冒烟测试用户')")
    .run(`smoke-${Date.now()}`).lastInsertRowid
);
db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, '2999-01-01 00:00:00')").run(
  TOKEN,
  uid
);

try {
  // 未登录必须被拦
  const anon = await api("GET", "/api/handover/projects", undefined, false);
  check("未登录访问项目列表返回 401", anon.status === 401);

  // REQ-001：企业名称为空被拦截
  const empty = await api("POST", "/api/handover/projects", { company_name: "  " });
  check("REQ-001 企业名称为空被拦截(400)", empty.status === 400, `got ${empty.status}`);

  // REQ-001：仅企业名称即可新建
  const created = await api("POST", "/api/handover/projects", { company_name: "冒烟测试公司A" });
  check("REQ-001 仅企业名称可新建(201)", created.status === 201);
  const pid = created.data?.project?.id;
  check("新建返回项目 id", Number.isInteger(pid));

  // REQ-002：分配 CSM + 留痕
  const assigned = await api("PUT", `/api/handover/projects/${pid}/csm`, { user_id: uid });
  check("REQ-002 分配 CSM 成功", assigned.status === 200 && assigned.data?.project?.csm_user_id === uid);
  const load = assigned.data?.load;
  check("REQ-011 分配返回负载信息", load && typeof load.count === "number");

  // REQ-003：指派实施顾问
  const cons = await api("PUT", `/api/handover/projects/${pid}/consultant`, { user_id: uid });
  check("REQ-003 指派实施顾问成功", cons.status === 200 && cons.data?.project?.consultant_user_id === uid);

  // REQ-004：群组状态切换（无卡点）
  const grp = await api("PUT", `/api/handover/projects/${pid}/groups`, { group: "internal", status: "done" });
  check("REQ-004 群组标记完成", grp.status === 200 && grp.data?.project?.group_status_internal === "done");

  // REQ-005：添加材料链接 + URL 轻校验
  const badLink = await api("POST", `/api/handover/projects/${pid}/links`, {
    link_type: "meeting_minutes",
    title: "非法链接",
    url: "ftp://x",
  });
  check("REQ-005 非 http(s) 链接被拦截(400)", badLink.status === 400);
  const link = await api("POST", `/api/handover/projects/${pid}/links`, {
    link_type: "client_archive",
    title: "一客一档文档",
    url: "https://example.com/doc",
  });
  check("REQ-005/006 添加一客一档链接(201)", link.status === 201);

  // REQ-006：一客一档勾选
  const arch = await api("PUT", `/api/handover/projects/${pid}/archive-doc`, { done: true });
  check("REQ-006 勾选一客一档已完善", arch.status === 200 && arch.data?.project?.archive_doc_done === 1);

  // REQ-007：记录添加客户联系人 → 服务开始时间认定；重复记录被拒
  const rec = await api("POST", `/api/handover/projects/${pid}/contacts`);
  check(
    "REQ-007 记录联系人后认定服务开始时间",
    rec.status === 201 && !!rec.data?.project?.service_started_at
  );
  const rec2 = await api("POST", `/api/handover/projects/${pid}/contacts`);
  check("REQ-007 重复记录被拒(409)", rec2.status === 409);

  // REQ-007/010：变更服务开始时间 + 留痕
  const chg = await api("PUT", `/api/handover/projects/${pid}/service-start`, {
    service_started_at: "2026-11-01 10:00",
  });
  check("REQ-007 变更服务开始时间", chg.status === 200 && chg.data?.project?.service_started_at === "2026-11-01 10:00");
  const chgBad = await api("PUT", `/api/handover/projects/${pid}/service-start`, {
    service_started_at: "不是时间",
  });
  check("REQ-007 非法时间格式被拦截(400)", chgBad.status === 400);

  // REQ-008：登记会议、标记完成
  const mt = await api("POST", `/api/handover/projects/${pid}/client-meetings`, {
    planned_at: "2026-12-01 15:00",
    note: "首次线上交接",
  });
  check("REQ-008 登记客户交接会议(201)", mt.status === 201);
  const mid = mt.data?.meetings?.[0]?.id;
  const mtDone = await api("PATCH", `/api/handover/projects/${pid}/client-meetings`, {
    meeting_id: mid,
    status: "done",
  });
  check("REQ-008 标记会议完成", mtDone.status === 200 && mtDone.data?.meetings?.[0]?.status === "done");

  // REQ-009：C360 提醒生成（幂等）
  const r1 = await api("POST", "/api/handover/reminders/c360");
  const r2 = await api("POST", "/api/handover/reminders/c360");
  const n1 = r1.data?.users?.length ?? 0;
  const n2 = r2.data?.users?.length ?? 0;
  check("REQ-009 首次生成提醒", r1.status === 200 && n1 >= 1);
  check("REQ-009 幂等（重复调用不重复生成）", r2.status === 200 && n2 === 0);

  // 未读提醒 + 已读
  const unread = await api("GET", "/api/handover/reminders");
  const first = unread.data?.items?.[0];
  check("REQ-009 站内未读提醒可查询", unread.status === 200 && (unread.data?.items?.length ?? 0) >= 1);
  const read = await api("POST", "/api/handover/reminders", { reminder_id: first?.id });
  check("REQ-009 提醒可标记已读", read.status === 200);

  // REQ-010：留痕完整性
  const detail = await api("GET", `/api/handover/projects/${pid}`);
  const types = new Set((detail.data?.actions ?? []).map((a) => a.action_type));
  for (const t of ["assign_csm", "assign_consultant", "record_contacts", "service_start_change"]) {
    check(`REQ-010 留痕含 ${t}`, types.has(t));
  }

  // REQ-011：负载档位（再造 9 个项目凑到 10 → 繁忙）
  for (let i = 0; i < 9; i++) {
    const p = await api("POST", "/api/handover/projects", { company_name: `冒烟负载项目${i}` });
    await api("PUT", `/api/handover/projects/${p.data?.project?.id}/csm`, { user_id: uid });
  }
  const assign10 = await api("POST", "/api/handover/projects", { company_name: "冒烟负载项目10" });
  const a10 = await api("PUT", `/api/handover/projects/${assign10.data?.project?.id}/csm`, { user_id: uid });
  check(
    "REQ-011 达到 10 个项目出现繁忙提醒且不拦截",
    a10.status === 200 && a10.data?.load?.label === "繁忙"
  );

  // REQ-001：列表包含全部项目
  const list = await api("GET", "/api/handover/projects");
  check("项目池列表可查询", list.status === 200 && (list.data?.projects?.length ?? 0) >= 11);
} finally {
  // ---------- 清理：删除本次冒烟产生的全部数据 ----------
  db.prepare("DELETE FROM handover_reminders WHERE user_id = ?").run(uid);
  db.prepare(
    "DELETE FROM handover_links WHERE project_id IN (SELECT id FROM handover_projects WHERE company_name LIKE '冒烟%')"
  ).run();
  db.prepare(
    "DELETE FROM handover_actions WHERE project_id IN (SELECT id FROM handover_projects WHERE company_name LIKE '冒烟%')"
  ).run();
  db.prepare(
    "DELETE FROM handover_client_meetings WHERE project_id IN (SELECT id FROM handover_projects WHERE company_name LIKE '冒烟%')"
  ).run();
  db.prepare("DELETE FROM handover_projects WHERE company_name LIKE '冒烟%'").run();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(TOKEN);
  db.prepare("DELETE FROM users WHERE id = ?").run(uid);
  db.close();
}

console.log(failed === 0 ? "\n冒烟自测全部通过" : `\n冒烟自测失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);
