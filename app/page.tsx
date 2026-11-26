import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** 首页：已登录进工作主页，未登录去登录页 */
export default function Home() {
  if (getSessionUser()) redirect("/home");
  redirect("/login");
}
