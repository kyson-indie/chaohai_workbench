import type { UserRow } from "@/lib/db";

/**
 * 用户信息区（菜单栏底部固定）：头像 + 昵称 + 退出登录。
 * 渲染逻辑与原欢迎页完全一致：有头像用原生 img（飞书头像来自外部域名，
 * 不走 next/image），否则用昵称首字的圆形占位。
 */
export default function UserInfo({ user }: { user: UserRow }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-gray-100 px-3 py-4">
      {user.avatar_url ? (
        // 飞书头像来自外部域名，用原生 img 即可，不走 next/image 域名白名单
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt={`${user.name}的头像`}
          className="h-10 w-10 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3370ff]/10 text-sm font-semibold text-[#3370ff]">
          {user.name.slice(0, 1)}
        </div>
      )}
      <p className="max-w-full truncate text-sm font-medium text-gray-900">{user.name}</p>
      <form action="/api/auth/logout" method="post" className="w-full">
        <button
          type="submit"
          className="h-9 w-full rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          退出登录
        </button>
      </form>
    </div>
  );
}
