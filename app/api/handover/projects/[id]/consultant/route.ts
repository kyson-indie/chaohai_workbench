import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getHandoverProject, getUserName, logAction, nowLocalText } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface AssignBody {
  user_id?: number | null;
}

/** 指派/更换实施顾问（REQ-003：形成「CSM+实施顾问」小组，分配即生效） */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: AssignBody;
  try {
    body = (await request.json()) as AssignBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const targetId = typeof body.user_id === "number" && Number.isInteger(body.user_id) ? body.user_id : null;
  if (targetId !== null && !getUserName(targetId)) {
    return NextResponse.json({ error: "所选成员不存在" }, { status: 400 });
  }

  const oldValue = project.consultant_user_id;
  const db = getDb();
  const write = db.transaction(() => {
    db.prepare("UPDATE handover_projects SET consultant_user_id = ?, updated_at = ? WHERE id = ?").run(
      targetId,
      nowLocalText(),
      id
    );
    logAction({
      projectId: id,
      actionType: "assign_consultant",
      operator: user,
      oldValue: oldValue ? String(oldValue) : null,
      newValue: targetId ? String(targetId) : null,
    });
  });
  write();

  return NextResponse.json({
    project: getHandoverProject(id),
    consultant_name: targetId ? getUserName(targetId) : null,
  });
}
