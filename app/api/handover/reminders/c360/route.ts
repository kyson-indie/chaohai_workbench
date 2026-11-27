import { NextResponse } from "next/server";
import { generateC360Reminders } from "@/lib/handover";

export const dynamic = "force-dynamic";

/**
 * 生成每周 C360 维护提醒（REQ-009 / DES-009）。
 * 由服务器 crontab 每周一 10:00 curl 触发（见 deploy/README.md 的 cron 安装指引）；
 * 接口幂等（同 user+project+当日去重），非周一手动调用同样生效。
 * 未登录也可由本机 curl 调用，属内部触发入口。
 */
export async function POST() {
  const generated = generateC360Reminders();
  return NextResponse.json({
    ok: true,
    users: generated.map((g) => ({
      user_id: g.userId,
      user_name: g.userName,
      project_count: g.projects.length,
      projects: g.projects,
    })),
  });
}
