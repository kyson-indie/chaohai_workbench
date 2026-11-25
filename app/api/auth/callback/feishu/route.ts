import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForUser, getAppTenantKey } from "@/lib/feishu";
import { getDb } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/session";
import { getSiteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * 飞书授权回调：校验 state → 换取用户信息 → 校验本企业租户 →
 * 落库（users / user_identities）→ 建会话 → 跳欢迎页。
 */
export async function GET(request: Request) {
  // 反代后 request.url 的 origin 会错误解析成 localhost:3100，跳转地址统一用配置的对外域名
  const url = new URL(request.url);
  const baseUrl = getSiteBaseUrl();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = cookies();
  const expectedState = jar.get("workbench_oauth_state")?.value;
  jar.delete("workbench_oauth_state");

  const fail = (msg: string) => NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(msg)}`);

  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("授权流程校验失败，请重新点击飞书登录");
  }

  try {
    const user = await exchangeCodeForUser(code);

    // 仅本企业飞书租户成员可登录：对比用户租户与应用所属租户
    try {
      const appTenantKey = await getAppTenantKey();
      if (user.tenantKey !== appTenantKey) {
        return fail("仅支持本企业飞书成员登录，外部账号已拒绝");
      }
    } catch {
      // 租户校验依赖「获取企业信息」权限；未开通时先放行，不阻塞登录
      console.error("租户校验失败（跳过）", new Date().toISOString());
    }

    const db = getDb();
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    db
      .prepare(
        `INSERT INTO users (feishu_union_id, name, avatar_url) VALUES (?, ?, ?)
         ON CONFLICT(feishu_union_id) DO UPDATE SET name = excluded.name, avatar_url = excluded.avatar_url, updated_at = ?`
      )
      .run(user.unionId, user.name, user.avatarUrl, now);
    const userId = Number(
      (
        db.prepare("SELECT id FROM users WHERE feishu_union_id = ?").get(user.unionId) as {
          id: number;
        }
      ).id
    );

    // 平台账号绑定表（为将来企业微信等多平台绑定预留）
    db.prepare(
      `INSERT INTO user_identities (user_id, platform, platform_user_id, tenant_key)
       VALUES (?, 'feishu', ?, ?)
       ON CONFLICT(platform, platform_user_id) DO UPDATE SET tenant_key = excluded.tenant_key`
    ).run(userId, user.unionId, user.tenantKey);

    const token = createSession(userId);
    const res = NextResponse.redirect(`${baseUrl}/welcome`);
    setSessionCookie(token);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "登录失败，请稍后重试";
    console.error("飞书登录回调失败:", msg);
    return fail(msg);
  }
}
