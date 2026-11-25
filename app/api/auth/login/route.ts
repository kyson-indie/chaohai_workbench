import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl } from "@/lib/feishu";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** 登录入口：生成防重放 state，跳转飞书授权页 */
export async function GET() {
  // 跳转地址统一用配置的对外域名，不依赖反代后的请求 origin
  const baseUrl = getSiteBaseUrl();
  try {
    const state = crypto.randomBytes(16).toString("hex");
    const res = NextResponse.redirect(buildAuthorizeUrl(state));
    res.cookies.set("workbench_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 分钟内完成授权
    });
    return res;
  } catch {
    // 凭证未配置等场景：回登录页给出可读提示
    return NextResponse.redirect(`${baseUrl}/login?error=not_configured`);
  }
}
