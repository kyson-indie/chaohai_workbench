"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_ITEMS } from "../menu";
import UserInfo from "./UserInfo";
import type { UserRow } from "@/lib/db";

/**
 * 左侧菜单栏（client component）：
 * - 菜单项垂直排列、图标 + 文字、选中高亮（浅色背景 + 主题色文字）
 * - 用户信息区固定在菜单栏底部
 * - 选中态用 usePathname() 前缀匹配 /home/<key>
 */
export default function SideMenu({ user }: { user: UserRow }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="px-4 py-5">
        <p className="text-base font-bold tracking-tight text-gray-900">潮海顾问工作台</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="主导航">
        {MENU_ITEMS.map(({ key, label, icon: Icon }) => {
          const selected = pathname === `/home/${key}` || pathname.startsWith(`/home/${key}/`);
          return (
            <Link
              key={key}
              href={`/home/${key}`}
              aria-current={selected ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                selected
                  ? "bg-[#3370ff]/10 text-[#3370ff]"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto">
        <UserInfo user={user} />
      </div>
    </aside>
  );
}
