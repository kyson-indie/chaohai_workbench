/**
 * 飞书开放平台 OAuth（网页登录）封装。
 * 文档：https://open.feishu.cn/document/common-capabilities/sso/api/get-authorization-code
 * 使用新 OAuth 授权端点 passport.feishu.cn + authen/v2 换 token，authen/v1 取用户信息。
 */

const OPEN_BASE = "https://open.feishu.cn";
const AUTHORIZE_URL = "https://passport.feishu.cn/suite/passport/oauth/authorize";

export interface FeishuConfigError extends Error {
  code: "not_configured";
}

export function getFeishuEnv(): { appId: string; appSecret: string; redirectUri: string } {
  const appId = process.env.FEISHU_APP_ID ?? "";
  const appSecret = process.env.FEISHU_APP_SECRET ?? "";
  const baseUrl = (
    process.env.WORKBENCH_BASE_URL ?? "https://workbench.chaohai.ren"
  ).replace(/\/+$/, "");
  if (!appId || !appSecret) {
    const err = new Error("飞书应用凭证未配置（FEISHU_APP_ID / FEISHU_APP_SECRET）") as FeishuConfigError;
    err.code = "not_configured";
    throw err;
  }
  return { appId, appSecret, redirectUri: `${baseUrl}/api/auth/callback/feishu` };
}

/** 生成跳转飞书授权页的地址 */
export function buildAuthorizeUrl(state: string): string {
  const { appId, redirectUri } = getFeishuEnv();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface FeishuUserInfo {
  openId: string;
  unionId: string;
  name: string;
  avatarUrl: string | null;
  tenantKey: string;
}

/** 用授权码换 user_access_token，并取用户信息（含昵称、头像、租户） */
export async function exchangeCodeForUser(code: string): Promise<FeishuUserInfo> {
  const { appId, appSecret, redirectUri } = getFeishuEnv();
  const tokenResp = await fetch(`${OPEN_BASE}/open-apis/authen/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  const tokenJson = (await tokenResp.json()) as {
    code?: number;
    msg?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenResp.ok || !tokenJson.access_token) {
    throw new Error(
      `换取登录凭证失败：${tokenJson.error_description ?? tokenJson.msg ?? tokenJson.error ?? `HTTP ${tokenResp.status}`}`
    );
  }

  const infoResp = await fetch(`${OPEN_BASE}/open-apis/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    cache: "no-store",
  });
  const infoJson = (await infoResp.json()) as {
    code?: number;
    msg?: string;
    data?: {
      open_id?: string;
      union_id?: string;
      name?: string;
      avatar_url?: string;
      tenant_key?: string;
    };
  };
  const d = infoJson.data ?? {};
  if (infoJson.code !== 0 || !d.union_id) {
    throw new Error(`获取用户信息失败：${infoJson.msg ?? `HTTP ${infoResp.status}`}`);
  }
  return {
    openId: d.open_id ?? "",
    unionId: d.union_id,
    name: d.name || "飞书用户",
    avatarUrl: d.avatar_url ?? null,
    tenantKey: d.tenant_key ?? "",
  };
}

/** 取应用所属企业（租户）的 tenant_key，用于“仅本企业成员可登录”校验 */
export async function getAppTenantKey(): Promise<string> {
  const { appId, appSecret } = getFeishuEnv();
  const tokenResp = await fetch(`${OPEN_BASE}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    cache: "no-store",
  });
  const tokenJson = (await tokenResp.json()) as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
  };
  if (!tokenJson.tenant_access_token) {
    throw new Error(`获取应用凭证失败：${tokenJson.msg ?? `HTTP ${tokenResp.status}`}`);
  }
  const tenantResp = await fetch(`${OPEN_BASE}/open-apis/tenant/v2/tenant/query`, {
    headers: { Authorization: `Bearer ${tokenJson.tenant_access_token}` },
    cache: "no-store",
  });
  const tenantJson = (await tenantResp.json()) as {
    code?: number;
    msg?: string;
    data?: { tenant?: { tenant_key?: string } };
  };
  const key = tenantJson.data?.tenant?.tenant_key;
  if (tenantJson.code !== 0 || !key) {
    throw new Error(`获取企业信息失败：${tenantJson.msg ?? `HTTP ${tenantResp.status}`}`);
  }
  return key;
}
