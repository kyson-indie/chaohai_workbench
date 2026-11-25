/**
 * 站点对外地址的唯一出口。
 * 反代（nginx → 127.0.0.1:3100）之后，Next 里 request.url 的 origin 会
 * 被解析成 http://localhost:3100，所以所有服务端跳转（OAuth 回调、退出登录等）
 * 一律用本函数拼接绝对地址，禁止直接用 request.url / url.origin。
 */
export function getSiteBaseUrl(): string {
  return (process.env.WORKBENCH_BASE_URL ?? "https://workbench.chaohai.ren").replace(/\/+$/, "");
}
