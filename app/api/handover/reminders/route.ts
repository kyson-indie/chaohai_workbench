import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { formatLocalTime, listUnreadReminders, markReminderRead } from "@/lib/handover";

export const dynamic = "force-dynamic";

/** 当前登录用户的未读提醒列表（顶栏角标与下拉） */
export async function GET() {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const items = listUnreadReminders(user.id).map((r) => ({
    id: r.id,
    project_id: r.project_id,
    company_name: r.company_name,
    kind: r.kind,
    created_at: formatLocalTime(r.created_at) ?? r.created_at,
  }));
  return NextResponse.json({ items });
}

/** 标记一条提醒已读 */
export async function POST(request: Request) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { reminder_id?: number };
  try {
    body = (await request.json()) as { reminder_id?: number };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const reminderId = body.reminder_id;
  if (typeof reminderId !== "number" || !Number.isInteger(reminderId) || reminderId <= 0) {
    return NextResponse.json({ error: "缺少有效的 reminder_id" }, { status: 400 });
  }

  markReminderRead(reminderId, user.id);
  return NextResponse.json({ items: listUnreadReminders(user.id).map((r) => ({ id: r.id })) });
}
