import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import PlatformIntro from "@/app/components/PlatformIntro";

export const dynamic = "force-dynamic";

/** 欢迎页：登录成功后展示平台介绍与当前飞书账号昵称与头像 */
export default async function WelcomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gray-50 px-4 py-6">
      <PlatformIntro />
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">潮海顾问工作台</h1>

        <div className="mt-8 flex flex-col items-center gap-3">
          {user.avatar_url ? (
            // 飞书头像来自外部域名，用原生 img 即可，不走 next/image 域名白名单
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt={`${user.name}的头像`}
              className="h-20 w-20 rounded-full border border-gray-200 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3370ff]/10 text-2xl font-semibold text-[#3370ff]">
              {user.name.slice(0, 1)}
            </div>
          )}
          <p className="text-lg font-medium text-gray-900">{user.name}</p>
          <p className="text-sm text-green-600">飞书账号登录成功</p>
        </div>

        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="h-11 w-full rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            退出登录
          </button>
        </form>
      </div>
    </main>
  );
}
