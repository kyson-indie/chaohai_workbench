import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { listHandoverProjects, type HandoverProjectRow } from "@/lib/handover";

export const dynamic = "force-dynamic";

export interface ProjectCreateInput {
  company_name?: string;
  feishu_edition?: string;
  seat_count?: number;
  expiry_date?: string;
  mau?: number;
  contact_persons?: string;
  key_decision_makers?: string;
  ai_usage?: string;
  usage_scenes?: string;
  potential_risks?: string;
  pending_todos?: string;
}

/** 新建交接项目（REQ-001：仅企业名称必填） */
export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: ProjectCreateInput;
  try {
    body = (await request.json()) as ProjectCreateInput;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const companyName = (body.company_name ?? "").trim();
  if (!companyName) {
    return NextResponse.json({ error: "客户企业名称不能为空" }, { status: 400 });
  }

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO handover_projects
       (company_name, feishu_edition, seat_count, expiry_date, mau,
        contact_persons, key_decision_makers, ai_usage, usage_scenes,
        potential_risks, pending_todos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      companyName,
      body.feishu_edition?.trim() || null,
      Number.isInteger(body.seat_count) ? body.seat_count : null,
      body.expiry_date?.trim() || null,
      Number.isInteger(body.mau) ? body.mau : null,
      body.contact_persons?.trim() || null,
      body.key_decision_makers?.trim() || null,
      body.ai_usage?.trim() || null,
      body.usage_scenes?.trim() || null,
      body.potential_risks?.trim() || null,
      body.pending_todos?.trim() || null
    );

  const row = db
    .prepare("SELECT * FROM handover_projects WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as HandoverProjectRow;
  return NextResponse.json({ project: row }, { status: 201 });
}

/** 项目池列表（本期所有用户可见全部） */
export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ projects: listHandoverProjects() });
}
