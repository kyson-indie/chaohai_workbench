import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { GROUP_FIELDS, GROUP_LABELS, getHandoverProject, logAction, nowLocalText } from "@/lib/handover";
import type { GroupKey } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface GroupBody {
  group?: string;
  status?: string; // pending / done
}

const VALID_STATUS = new Set(["pending", "done"]);

/**
 * 三类群组状态切换（REQ-004：仅记录状态与留痕，实际建群拉人在飞书客户端人工完成；
 * 群组状态不做任何流程前置校验，未完成不拦截其他操作）。
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: GroupBody;
  try {
    body = (await request.json()) as GroupBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const group = body.group as GroupKey | undefined;
  const status = body.status ?? "";
  if (!group || !(group in GROUP_FIELDS)) {
    return NextResponse.json({ error: "群组类型不正确" }, { status: 400 });
  }
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "状态值不正确" }, { status: 400 });
  }

  const field = GROUP_FIELDS[group];
  const oldValue = project[field];
  if (oldValue === status) {
    return NextResponse.json({ project });
  }

  const db = getDb();
  const write = db.transaction(() => {
    db.prepare(`UPDATE handover_projects SET ${field} = ?, updated_at = ? WHERE id = ?`).run(
      status,
      nowLocalText(),
      id
    );
    logAction({
      projectId: id,
      actionType: "group_status",
      operator: user,
      oldValue: `${GROUP_LABELS[group]}:${oldValue}`,
      newValue: `${GROUP_LABELS[group]}:${status}`,
    });
  });
  write();

  return NextResponse.json({ project: getHandoverProject(id) });
}
