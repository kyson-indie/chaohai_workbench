import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACTION_LABELS,
  GROUP_LABELS,
  LINK_TYPES,
  formatLocalTime,
  getHandoverProject,
  getUserName,
  listActions,
  listClientMeetings,
  listLinks,
  listUsers,
  loadInfoOfCsm,
} from "@/lib/handover";
import {
  AssignSection,
  GroupsSection,
  MaterialsSection,
  MeetingsSection,
  ServiceStartSection,
} from "../components/DetailSections";

export const dynamic = "force-dynamic";

/** 项目基础信息字段清单（REQ-001：新建后可补充编辑） */
const BASIC_FIELDS: { key: string; label: string }[] = [
  { key: "feishu_edition", label: "飞书版本" },
  { key: "seat_count", label: "席位数" },
  { key: "expiry_date", label: "到期时间" },
  { key: "mau", label: "MAU" },
  { key: "contact_persons", label: "客户联系人" },
  { key: "key_decision_makers", label: "关键决策人" },
  { key: "ai_usage", label: "AI 使用情况" },
  { key: "usage_scenes", label: "使用场景" },
  { key: "potential_risks", label: "潜在风险" },
  { key: "pending_todos", label: "待办事项" },
];

/** 交接项目详情页（服务端取数 + client 局部交互） */
export default async function HandoverDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const project = getHandoverProject(id);
  if (!project) notFound();

  const members = listUsers().map((u) => ({ id: u.id, name: u.name }));
  const csmName = getUserName(project.csm_user_id);
  const consultantName = getUserName(project.consultant_user_id);
  const csmLoad = project.csm_user_id ? loadInfoOfCsm(project.csm_user_id) : null;

  const dbLinks = listLinks(id).map((l) => ({ id: l.id, link_type: l.link_type, title: l.title, url: l.url }));
  const dbMeetings = listClientMeetings(id).map((m) => ({
    id: m.id,
    planned_at: m.planned_at,
    status: m.status,
    note: m.note,
  }));

  // 服务开始时间相关流水（记录联系人 + 变更），倒序展示
  const timeChanges = listActions(id)
    .filter((a) => a.action_type === "record_contacts" || a.action_type === "service_start_change")
    .map((a) => ({
      id: a.id,
      operator_name: a.operator_name,
      old_value: a.old_value,
      new_value: a.new_value,
      created_at: formatLocalTime(a.created_at) ?? a.created_at,
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-8 py-6">
      <div className="flex items-center gap-3">
        <Link href="/home/handover" className="text-sm text-[#3370ff] hover:underline">
          ← 返回项目池
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900">{project.company_name}</h1>
        <p className="mt-1 text-xs text-gray-400">
          创建于 {formatLocalTime(project.created_at) ?? project.created_at}（本地时区）
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">项目基础信息</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {BASIC_FIELDS.map(({ key, label }) => {
            const value = (project as unknown as Record<string, unknown>)[key];
            return (
              <div key={key} className="flex gap-2">
                <dt className="w-24 shrink-0 text-gray-500">{label}</dt>
                <dd className="text-gray-800">{value === null || value === undefined || value === "" ? "—" : String(value)}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <AssignSection
        project={project}
        members={members}
        csmName={csmName}
        consultantName={consultantName}
        csmLoad={csmLoad}
      />
      <GroupsSection project={project} groupLabels={GROUP_LABELS} />
      <MaterialsSection project={project} links={dbLinks} linkTypeLabels={LINK_TYPES} />
      <ServiceStartSection
        project={project}
        serviceStartFormatted={formatLocalTime(project.service_started_at)}
        changes={timeChanges}
      />
      <MeetingsSection projectId={project.id} meetings={dbMeetings} />

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-900">操作留痕</h2>
        <ul className="mt-4 space-y-2 text-xs text-gray-600">
          {listActions(id).map((a) => (
            <li key={a.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-gray-800">{formatLocalTime(a.created_at) ?? a.created_at}</span> ·{" "}
              {ACTION_LABELS[a.action_type] ?? a.action_type} · {a.operator_name}
              {a.old_value || a.new_value ? (
                <span className="text-gray-500">
                  {" "}
                  {a.old_value ? `${a.old_value} → ` : ""}
                  {a.new_value ?? ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
