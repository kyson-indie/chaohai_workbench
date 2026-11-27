import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getHandoverProject, logAction, nowLocalText } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface ArchiveDocBody {
  done?: boolean;
}

/**
 * 一客一档「已完善」勾选切换（REQ-006：由 CSM 人工勾选，系统不校验文档实际内容）。
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: ArchiveDocBody;
  try {
    body = (await request.json()) as ArchiveDocBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (typeof body.done !== "boolean") {
    return NextResponse.json({ error: "done 必须是布尔值" }, { status: 400 });
  }

  const newDone = body.done ? 1 : 0;
  const oldDone = project.archive_doc_done;
  if (oldDone === newDone) {
    return NextResponse.json({ project });
  }

  const db = getDb();
  const write = db.transaction(() => {
    db.prepare("UPDATE handover_projects SET archive_doc_done = ?, updated_at = ? WHERE id = ?").run(
      newDone,
      nowLocalText(),
      id
    );
    logAction({
      projectId: id,
      actionType: "archive_doc",
      operator: user,
      oldValue: String(oldDone),
      newValue: String(newDone),
    });
  });
  write();

  return NextResponse.json({ project: getHandoverProject(id) });
}
