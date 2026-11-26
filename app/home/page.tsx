import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** /home 根路径：重定向到默认菜单（第一个菜单「售前」） */
export default function HomePage() {
  redirect("/home/presales");
}
