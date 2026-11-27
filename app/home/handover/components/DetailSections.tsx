"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HandoverProjectRow, LoadInfo } from "@/lib/handover";

/**
 * 详情页各交互区（client component）：服务端取数渲染初始状态，
 * 写操作走 /api/handover/* 成功后 router.refresh() 局部刷新，沿用现有模式。
 */

const inputCls =
  "h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-[#3370ff]";
const btnPrimary =
  "h-9 rounded-lg bg-[#3370ff] px-4 text-sm font-medium text-white transition hover:bg-[#2b5fe3] disabled:opacity-50";
const btnGhost =
  "h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50";

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{msg}</p>;
}

async function callJson(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "操作失败，请稍后重试" };
  } catch {
    return { ok: false, error: "网络异常，请稍后重试" };
  }
}

const LOAD_COLORS: Record<string, string> = {
  yellow: "bg-yellow-100 text-yellow-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-800",
};

/** 负载徽标（DES-008：繁忙/饱和/警告三档，仅提示不拦截） */
export function LoadBadge({ load }: { load: LoadInfo | null }) {
  if (!load || !load.label || !load.color) return null;
  return (
    <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LOAD_COLORS[load.color]}`}>
      {load.label}（{load.count} 个项目）
    </span>
  );
}

export interface MemberOption {
  id: number;
  name: string;
}

/** 人员分配区（REQ-002/003：分配 CSM、指派实施顾问，分配即生效） */
export function AssignSection({
  project,
  members,
  csmName,
  consultantName,
  csmLoad,
}: {
  project: HandoverProjectRow;
  members: MemberOption[];
  csmName: string | null;
  consultantName: string | null;
  csmLoad: LoadInfo | null;
}) {
  const router = useRouter();
  const [csmId, setCsmId] = useState<string>(project.csm_user_id ? String(project.csm_user_id) : "");
  const [consultantId, setConsultantId] = useState<string>(
    project.consultant_user_id ? String(project.consultant_user_id) : ""
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(kind: "csm" | "consultant") {
    const raw = kind === "csm" ? csmId : consultantId;
    const userId = raw ? Number(raw) : null;
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/${kind}`, "PUT", { user_id: userId });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">人员分配</h2>
      <p className="mt-1 text-xs text-gray-500">CSM 由 BP 分配、实施顾问由页面指派，保存即生效（无确认环节）</p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm text-gray-600">CSM</label>
          <div className="mt-1 flex items-center gap-2">
            <select value={csmId} onChange={(e) => setCsmId(e.target.value)} className={`${inputCls} w-56`}>
              <option value="">未分配</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button onClick={() => save("csm")} disabled={busy} className={btnPrimary}>
              保存分配
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-700">
            当前：{csmName ?? "未分配"}
            {csmLoad && csmLoad.text && <LoadBadge load={csmLoad} />}
          </p>
        </div>

        <div>
          <label className="text-sm text-gray-600">实施顾问</label>
          <div className="mt-1 flex items-center gap-2">
            <select value={consultantId} onChange={(e) => setConsultantId(e.target.value)} className={`${inputCls} w-56`}>
              <option value="">未指派</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button onClick={() => save("consultant")} disabled={busy} className={btnPrimary}>
              指派实施顾问
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-700">当前：{consultantName ?? "未指派"}</p>
          {csmName && (
            <p className="mt-1 text-xs text-gray-500">
              服务小组：{csmName}
              {consultantName ? ` + ${consultantName}` : "（指派实施顾问前仅 CSM）"}
            </p>
          )}
        </div>
      </div>
      <Err msg={err} />
    </section>
  );
}

const GROUP_GUIDES: Record<string, string> = {
  docking: "对接群：由 BP 在飞书客户端将 CSM 拉入群并声明交接安排，完成后在此标记",
  internal: "团队内部群：由 CSM 在飞书客户端组建内部协作群，完成后在此标记",
  customer: "客户服务群：由 CSM 与客户协商后建立客户服务群，完成后在此标记",
};

/** 群组建立区（REQ-004：仅状态记录，实际建群在飞书客户端人工完成，无流程卡点） */
export function GroupsSection({
  project,
  groupLabels,
}: {
  project: HandoverProjectRow;
  groupLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const groups: { key: string; field: "group_status_docking" | "group_status_internal" | "group_status_customer" }[] = [
    { key: "docking", field: "group_status_docking" },
    { key: "internal", field: "group_status_internal" },
    { key: "customer", field: "group_status_customer" },
  ];

  async function toggle(group: string, current: string) {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/groups`, "PUT", {
      group,
      status: current === "done" ? "pending" : "done",
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">群组建立</h2>
      <p className="mt-1 text-xs text-gray-500">仅记录完成状态；实际建群拉人请在飞书客户端人工完成</p>
      <ul className="mt-4 space-y-3">
        {groups.map(({ key, field }) => {
          const done = project[field] === "done";
          return (
            <li key={key} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{groupLabels[key]}</p>
                <p className="mt-0.5 text-xs text-gray-500">{GROUP_GUIDES[key]}</p>
              </div>
              <button
                onClick={() => toggle(key, project[field])}
                disabled={busy}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                  done ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {done ? "已完成" : "未完成"}
              </button>
            </li>
          );
        })}
      </ul>
      <Err msg={err} />
    </section>
  );
}

export interface LinkItem {
  id: number;
  link_type: string;
  title: string;
  url: string;
}

const LINK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "handover_doc", label: "来源方交接文档" },
  { value: "meeting_minutes", label: "会议妙计" },
  { value: "client_archive", label: "一客一档" },
  { value: "client_meeting", label: "客户交接会议材料" },
];

/** 交接材料区（REQ-005/006：链接归档 + 一客一档「已完善」勾选） */
export function MaterialsSection({
  project,
  links,
  linkTypeLabels,
}: {
  project: HandoverProjectRow;
  links: LinkItem[];
  linkTypeLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [type, setType] = useState("handover_doc");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addLink() {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/links`, "POST", {
      link_type: type,
      title,
      url,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    setTitle("");
    setUrl("");
    router.refresh();
  }

  async function removeLink(linkId: number) {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/links?link_id=${linkId}`, "DELETE");
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    router.refresh();
  }

  async function toggleArchive() {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/archive-doc`, "PUT", {
      done: project.archive_doc_done !== 1,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">交接材料</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={project.archive_doc_done === 1}
            onChange={toggleArchive}
            disabled={busy}
            className="h-4 w-4 accent-[#3370ff]"
          />
          一客一档已完善
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-500">会议妙计、交接文档等统一挂接到这里；「已完善」由 CSM 人工勾选</p>

      <ul className="mt-4 space-y-2">
        {links.length === 0 && <li className="text-sm text-gray-400">暂无材料链接</li>}
        {links.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-2">
            <span className="shrink-0 rounded bg-[#3370ff]/10 px-2 py-0.5 text-xs text-[#3370ff]">
              {linkTypeLabels[l.link_type] ?? l.link_type}
            </span>
            <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-gray-800 hover:text-[#3370ff] hover:underline">
              {l.title}
            </a>
            <button onClick={() => removeLink(l.id)} disabled={busy} className="shrink-0 text-xs text-gray-400 hover:text-red-500">
              删除
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${inputCls} w-40`}>
          {LINK_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" className={`${inputCls} w-44`} />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https:// 链接地址" className={`${inputCls} flex-1 min-w-52`} />
        <button onClick={addLink} disabled={busy} className={btnPrimary}>
          添加链接
        </button>
      </div>
      <Err msg={err} />
    </section>
  );
}

export interface ServiceStartChange {
  id: number;
  operator_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

/** 客户交接区（REQ-007：记录添加客户联系人即认定服务开始时间；变更留痕） */
export function ServiceStartSection({
  project,
  serviceStartFormatted,
  changes,
}: {
  project: HandoverProjectRow;
  serviceStartFormatted: string | null;
  changes: ServiceStartChange[];
}) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [newTime, setNewTime] = useState(project.service_started_at?.slice(0, 16) ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function recordContacts() {
    if (!window.confirm("确认已完成添加客户联系人？记录后将以当前时间认定为服务开始时间。")) return;
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/contacts`, "POST");
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    router.refresh();
  }

  async function changeTime() {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${project.id}/service-start`, "PUT", {
      service_started_at: newTime,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    setShowEdit(false);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">客户交接</h2>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-gray-700">
            服务开始时间：<span className="font-medium">{serviceStartFormatted ?? "未认定"}</span>
          </p>
          {project.contact_added_at ? (
            <button onClick={() => setShowEdit((v) => !v)} disabled={busy} className={btnGhost}>
              修改时间
            </button>
          ) : (
            <>
              <button onClick={recordContacts} disabled={busy} className={btnPrimary}>
                记录添加客户联系人
              </button>
              <span className="text-xs text-gray-500">
                完成后请通知原厂交接负责人与我方项目经理（人工通知）
              </span>
            </>
          )}
        </div>

        {showEdit && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-3">
            <input
              type="datetime-local"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className={inputCls}
            />
            <button onClick={changeTime} disabled={busy || !newTime} className={btnPrimary}>
              保存新时间
            </button>
          </div>
        )}

        {project.contact_added_at && (
          <button onClick={() => setShowHistory((v) => !v)} className="text-sm text-[#3370ff] hover:underline">
            {showHistory ? "收起变更历史" : "查看变更历史"}
          </button>
        )}
        {showHistory && (
          <ul className="space-y-2 rounded-lg bg-gray-50 px-4 py-3">
            {changes.length === 0 && <li className="text-sm text-gray-400">暂无变更记录</li>}
            {changes.map((c) => (
              <li key={c.id} className="text-xs text-gray-600">
                {c.created_at.slice(0, 16)}（本地时区） · {c.operator_name}：
                {c.old_value ? `${c.old_value} → ${c.new_value}` : `初始认定 ${c.new_value}`}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Err msg={err} />
    </section>
  );
}

export interface MeetingItem {
  id: number;
  planned_at: string;
  status: string;
  note: string | null;
}

/** 客户交接会议区（REQ-008：登记会议、标记完成、改期） */
export function MeetingsSection({ projectId, meetings }: { projectId: number; meetings: MeetingItem[] }) {
  const router = useRouter();
  const [plannedAt, setPlannedAt] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMeeting() {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${projectId}/client-meetings`, "POST", {
      planned_at: plannedAt.replace("T", " "),
      note,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    setPlannedAt("");
    setNote("");
    router.refresh();
  }

  async function patchMeeting(meetingId: number, body: Record<string, string>) {
    setBusy(true);
    setErr(null);
    const r = await callJson(`/api/handover/projects/${projectId}/client-meetings`, "PATCH", {
      meeting_id: meetingId,
      ...body,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error ?? null);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">客户交接会议</h2>
      <p className="mt-1 text-xs text-gray-500">CSM 邀约客户对接人与关键决策人线上交接；在此登记安排与完成情况</p>

      <ul className="mt-4 space-y-2">
        {meetings.length === 0 && <li className="text-sm text-gray-400">暂无会议安排</li>}
        {meetings.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-4 py-2">
            <span className="text-sm text-gray-800">{m.planned_at}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                m.status === "done" ? "bg-green-100 text-green-700" : "bg-[#3370ff]/10 text-[#3370ff]"
              }`}
            >
              {m.status === "done" ? "已完成" : "已安排"}
            </span>
            {m.note && <span className="text-xs text-gray-500">{m.note}</span>}
            {m.status !== "done" && (
              <>
                <button
                  onClick={() => patchMeeting(m.id, { status: "done" })}
                  disabled={busy}
                  className="text-xs text-[#3370ff] hover:underline"
                >
                  标记完成
                </button>
                <button
                  onClick={() => {
                    const v = window.prompt("新的会议时间（YYYY-MM-DD HH:mm）", m.planned_at.slice(0, 16));
                    if (v) patchMeeting(m.id, { planned_at: v });
                  }}
                  disabled={busy}
                  className="text-xs text-[#3370ff] hover:underline"
                >
                  改期
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <input
          type="datetime-local"
          value={plannedAt}
          onChange={(e) => setPlannedAt(e.target.value)}
          className={inputCls}
        />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（选填）" className={`${inputCls} flex-1 min-w-40`} />
        <button onClick={addMeeting} disabled={busy || !plannedAt} className={btnPrimary}>
          登记会议
        </button>
      </div>
      <Err msg={err} />
    </section>
  );
}
