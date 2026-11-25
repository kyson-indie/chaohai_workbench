import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** 退出登录：删除服务端会话并清除 Cookie，回登录页 */
export async function POST() {
  await clearSession();
  return NextResponse.redirect(`${getSiteBaseUrl()}/login`);
}
