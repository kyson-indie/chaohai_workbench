import { redirect } from "next/navigation";
import { MENU_ITEMS } from "./menu";

export const dynamic = "force-dynamic";

/** /home 根路径：重定向到默认菜单（MENU_ITEMS 第一项，当前为「售前」） */
export default function HomePage() {
  redirect(`/home/${MENU_ITEMS[0].key}`);
}
