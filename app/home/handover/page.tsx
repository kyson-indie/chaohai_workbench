import Link from "next/link";
import { formatLocalTime, getUserName, listHandoverProjects } from "@/lib/handover";

export const dynamic = "force-dynamic";

/** 状态点：绿色已完成 / 灰色未完成 */
function StatusDot({ done }: { done: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${done ? "bg-green-500" : "bg-gray-300"}`}
      aria-label={done ? "已完成" : "未完成"}
    />
  );
}

/** 交接项目池列表页（REQ-001：所有用户可见全部项目，本期无权限区分） */
export default function HandoverPage() {
  const projects = listHandoverProjects();

  return (
    <div className="mx-auto max-w-6xl px-8 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">待交接项目池</h1>
          <p className="mt-1 text-sm text-gray-500">登记待交接的客户项目，跟进分配、群组、材料与交接会议</p>
        </div>
        <Link
          href="/home/handover/new"
          className="flex h-9 items-center rounded-lg bg-[#3370ff] px-4 text-sm font-medium text-white transition hover:bg-[#2b5fe3]"
        >
          添加项目
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-medium">客户企业名称</th>
              <th className="px-4 py-3 font-medium">CSM</th>
              <th className="px-4 py-3 font-medium">实施顾问</th>
              <th className="px-4 py-3 font-medium">服务开始时间</th>
              <th className="px-4 py-3 font-medium">群组建立</th>
              <th className="px-4 py-3 font-medium">一客一档</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  暂无待交接项目，点击右上角「添加项目」登记第一个项目
                </td>
              </tr>
            )}
            {projects.map((p) => {
              const groupsDone = [p.group_status_docking, p.group_status_internal, p.group_status_customer];
              return (
                <tr key={p.id} className="border-b border-gray-50 transition hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link href={`/home/handover/${p.id}`} className="font-medium text-[#3370ff] hover:underline">
                      {p.company_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{getUserName(p.csm_user_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{getUserName(p.consultant_user_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{formatLocalTime(p.service_started_at) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {groupsDone.map((s, i) => (
                        <StatusDot key={i} done={s === "done"} />
                      ))}
                      <span className="text-xs text-gray-400">
                        {groupsDone.filter((s) => s === "done").length}/3
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot done={p.archive_doc_done === 1} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">时间均为本地时区（YYYY-MM-DD HH:mm）</p>
    </div>
  );
}
