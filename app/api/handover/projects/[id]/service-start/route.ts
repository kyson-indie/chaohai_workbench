import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getHandoverProject, logAction, nowLocalText } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface ServiceStartBody {
  service_started_at?: string;
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

/**
 * 变更服务开始时间（REQ-007/010：本期所有用户可变更，每次变更留痕含旧值、新值、操作人与时间）。
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: ServiceStartBody;
  try {
    body = (await request.json()) as ServiceStartBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const newValue = (body.service_started_at ?? "").trim();
  if (!DATETIME_RE.test(newValue)) {
    return NextResponse.json(
      { error: "时间格式应为 YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss" },
      { status: 400 }
    );
  }

  const oldValue = project.service_started_at;
  const db = getDb();
  const write = db.transaction(() => {
    db.prepare("UPDATE handover_projects SET service_started_at = ?, updated_at = ? WHERE id = ?").run(
      newValue,
      nowLocalText(),
      id
    );
    logAction({
      projectId: id,
      actionType: "service_start_change",
      operator: user,
      oldValue,
      newValue,
    });
  });
  write();

  return NextResponse.json({ project: getHandoverProject(id) });
}
