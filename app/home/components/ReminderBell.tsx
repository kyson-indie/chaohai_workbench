"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ReminderItem {
  id: number;
  project_id: number;
  company_name: string;
  kind: string;
  created_at: string;
}

const KIND_LABELS: Record<string, string> = {
  c360_maintenance: "C360 维护提醒",
};

/**
 * 工作台顶栏的站内提醒铃铛（DES-009）：
 * 未读提醒显示角标，点开下拉列表；点击某条即标记已读并跳转项目详情。
 * 每 5 分钟轮询一次兜底，日常以进入页面/操作后刷新为准。
 */
export default function ReminderBell() {
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/handover/reminders");
      if (!res.ok) return;
      const data = (await res.json()) as { items: ReminderItem[] };
      setItems(data.items);
    } catch {
      // 网络异常时保持现状，不打扰用户
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  // 点击页面其他位置收起下拉
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markRead(item: ReminderItem) {
    try {
      await fetch("/api/handover/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminder_id: item.id }),
      });
    } catch {
      // 标记失败不阻塞跳转
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    window.location.href = `/home/handover/${item.project_id}`;
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={`站内提醒${items.length ? `，${items.length} 条未读` : ""}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
      >
        {/* 铃铛图标（内联 SVG，不引第三方图标库） */}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {items.length > 99 ? "99+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-medium text-gray-500">站内提醒</p>
          {items.length === 0 && <p className="px-2 py-4 text-sm text-gray-400">暂无未读提醒</p>}
          <ul className="max-h-72 overflow-y-auto">
            {items.map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => markRead(i)}
                  className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-gray-50"
                >
                  <p className="text-sm text-gray-800">
                    {KIND_LABELS[i.kind] ?? i.kind}：{i.company_name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{i.created_at}（本地时区）</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
