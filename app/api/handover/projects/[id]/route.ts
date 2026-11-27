import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getHandoverProject, listActions, nowLocalText } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface ProjectPatchInput {
  feishu_edition?: string;
  seat_count?: number | null;
  expiry_date?: string;
  mau?: number | null;
  contact_persons?: string;
  key_decision_makers?: string;
  ai_usage?: string;
  usage_scenes?: string;
  potential_risks?: string;
  pending_todos?: string;
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project, actions: listActions(id) });
}

/** 补充编辑主数据字段（REQ-001/010：均非必填，空串落 NULL） */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: ProjectPatchInput;
  try {
    body = (await request.json()) as ProjectPatchInput;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const textOf = (v: string | undefined) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const intOf = (v: number | null | undefined) =>
    typeof v === "number" && Number.isInteger(v) ? v : null;

  const db = getDb();
  db.prepare(
    `UPDATE handover_projects SET
       feishu_edition = ?, seat_count = ?, expiry_date = ?, mau = ?,
       contact_persons = ?, key_decision_makers = ?, ai_usage = ?, usage_scenes = ?,
       potential_risks = ?, pending_todos = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    "feishu_edition" in body ? textOf(body.feishu_edition) : project.feishu_edition,
    "seat_count" in body ? intOf(body.seat_count) : project.seat_count,
    "expiry_date" in body ? textOf(body.expiry_date) : project.expiry_date,
    "mau" in body ? intOf(body.mau) : project.mau,
    "contact_persons" in body ? textOf(body.contact_persons) : project.contact_persons,
    "key_decision_makers" in body ? textOf(body.key_decision_makers) : project.key_decision_makers,
    "ai_usage" in body ? textOf(body.ai_usage) : project.ai_usage,
    "usage_scenes" in body ? textOf(body.usage_scenes) : project.usage_scenes,
    "potential_risks" in body ? textOf(body.potential_risks) : project.potential_risks,
    "pending_todos" in body ? textOf(body.pending_todos) : project.pending_todos,
    nowLocalText(),
    id
  );

  return NextResponse.json({ project: getHandoverProject(id) });
}
