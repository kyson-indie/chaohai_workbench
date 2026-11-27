import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getHandoverProject, logAction, nowLocalText } from "@/lib/handover";

export const dynamic = "force-dynamic";

/**
 * 记录「已添加客户联系人」动作（REQ-007）：
 * 首次点击写入 contact_added_at 与 service_started_at（同一时刻认定）并留痕；
 * 已记录过时重复提交返回提示，不重复认定。
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  if (project.contact_added_at) {
    return NextResponse.json(
      { error: "已记录过添加客户联系人时间，请通过「修改时间」变更服务开始时间" },
      { status: 409 }
    );
  }

  const now = nowLocalText();
  const db = getDb();
  const write = db.transaction(() => {
    db.prepare(
      "UPDATE handover_projects SET contact_added_at = ?, service_started_at = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, now, id);
    logAction({
      projectId: id,
      actionType: "record_contacts",
      operator: user,
      oldValue: null,
      newValue: now,
    });
  });
  write();

  return NextResponse.json({ project: getHandoverProject(id) }, { status: 201 });
}
