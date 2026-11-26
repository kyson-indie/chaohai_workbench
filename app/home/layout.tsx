import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import SideMenu from "./components/SideMenu";

export const dynamic = "force-dynamic";

/**
 * 工作主页布局：左侧菜单栏 + 右侧工作区（独立滚动）。
 * 未登录访问 /home 下任意路径统一重定向到登录页（与原欢迎页行为一致）。
 */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SideMenu user={user} />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
