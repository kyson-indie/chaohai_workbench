import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 登录页：标题 + 飞书登录按钮。已登录用户直接进工作主页。 */

const ERROR_TEXT: Record<string, string> = {
  not_configured: "系统尚未完成飞书应用配置，请联系管理员在服务器上填写应用凭证",
  external_tenant: "仅支持本企业飞书成员登录，外部账号已拒绝",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await getSessionUser()) redirect("/home");

  const errorText = searchParams.error ? (ERROR_TEXT[searchParams.error] ?? decodeURIComponent(searchParams.error)) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">潮海顾问工作台</h1>
        <p className="mt-3 text-sm text-gray-500">使用企业飞书账号登录</p>

        <a
          href="/api/auth/login"
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3370ff] text-base font-medium text-white transition hover:bg-[#2b5fd9]"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
            <path d="M3.55 6.11 10.99 1.6a2.16 2.16 0 0 1 2.32 0l7.13 4.51c.58.37.58 1.25 0 1.62l-7.2 4.55a1.73 1.73 0 0 1-1.87 0L3.5 7.73c-.58-.37-.57-1.25.05-1.62ZM2.2 11.05l1.33.84v4.3c0 .2.08.38.22.5l5.36 4.35c.42.34.5.95.17 1.38-.34.44-.98.5-1.42.13L2.6 18.7A2.9 2.9 0 0 1 1.5 16.4v-4.6c0-.55.14-1.02.7-.75Zm19.6 0c.56-.27.7.2.7.75v4.6c0 .87-.4 1.7-1.1 2.3l-5.26 4.35c-.44.37-1.08.3-1.42-.13a1.06 1.06 0 0 1 .17-1.38l5.36-4.35c.14-.12.22-.3.22-.5v-4.3l1.33-.84ZM9.9 14.5l1.04.66c.63.4 1.44.4 2.07 0l1.04-.66v3.06l5.2-3.28v1.87l-5.2 4.1a2.06 2.06 0 0 1-1.55.62 2.06 2.06 0 0 1-1.55-.62l-5.2-4.1v-1.87l5.15 3.28V14.5Z" />
          </svg>
          飞书登录
        </a>

        {errorText && (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorText}</p>
        )}
      </div>
      <p className="text-xs text-gray-400">登录即表示同意仅将飞书账号用于本工作台的身份识别</p>
    </main>
  );
}
