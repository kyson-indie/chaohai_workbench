import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import SideMenu from "./components/SideMenu";
import ReminderBell from "./components/ReminderBell";

export const dynamic = "force-dynamic";

/**
 * 工作主页布局：左侧菜单栏 + 右侧工作区（独立滚动）。
 * 未登录访问 /home 下任意路径统一重定向到登录页（与原欢迎页行为一致）。
 * 工作区顶部为通栏：站内提醒铃铛（交接模块的 C360 维护提醒等）。
 */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SideMenu user={user} />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-12 items-center justify-end border-b border-gray-200 bg-white/90 px-6 backdrop-blur">
          <ReminderBell />
        </div>
        {children}
      </div>
    </div>
  );
}
