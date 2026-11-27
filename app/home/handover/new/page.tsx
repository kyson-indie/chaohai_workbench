"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface FormState {
  company_name: string;
  feishu_edition: string;
  seat_count: string;
  expiry_date: string;
  mau: string;
  contact_persons: string;
  key_decision_makers: string;
  ai_usage: string;
  usage_scenes: string;
  potential_risks: string;
  pending_todos: string;
}

const EMPTY: FormState = {
  company_name: "",
  feishu_edition: "",
  seat_count: "",
  expiry_date: "",
  mau: "",
  contact_persons: "",
  key_decision_makers: "",
  ai_usage: "",
  usage_scenes: "",
  potential_risks: "",
  pending_todos: "",
};

const inputCls =
  "h-9 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-[#3370ff]";

/** 新建交接项目页（REQ-001：仅客户企业名称必填，其余为「补充信息」可留空） */
export default function NewHandoverProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showExtra, setShowExtra] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit() {
    if (!form.company_name.trim()) {
      setError("客户企业名称不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/handover/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name,
          feishu_edition: form.feishu_edition,
          seat_count: form.seat_count ? Number(form.seat_count) : undefined,
          expiry_date: form.expiry_date,
          mau: form.mau ? Number(form.mau) : undefined,
          contact_persons: form.contact_persons,
          key_decision_makers: form.key_decision_makers,
          ai_usage: form.ai_usage,
          usage_scenes: form.usage_scenes,
          potential_risks: form.potential_risks,
          pending_todos: form.pending_todos,
        }),
      });
      const data = (await res.json()) as { project?: { id: number }; error?: string };
      if (!res.ok || !data.project) {
        setError(data.error ?? "保存失败，请稍后重试");
        return;
      }
      router.push(`/home/handover/${data.project.id}`);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <h1 className="text-xl font-bold text-gray-900">添加交接项目</h1>
      <p className="mt-1 text-sm text-gray-500">只需填写客户企业名称即可保存，其余信息可稍后在详情页补充</p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <label className="block text-sm font-medium text-gray-700">
          客户企业名称 <span className="text-red-500">*</span>
        </label>
        <input
          value={form.company_name}
          onChange={set("company_name")}
          placeholder="例如：潮海科技有限公司"
          className={`mt-2 ${inputCls}`}
        />

        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          className="mt-5 text-sm font-medium text-[#3370ff] hover:underline"
        >
          {showExtra ? "收起补充信息" : "展开补充信息（选填）"}
        </button>

        {showExtra && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <label className="block text-sm text-gray-600">飞书版本</label>
              <input value={form.feishu_edition} onChange={set("feishu_edition")} className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">席位数</label>
              <input value={form.seat_count} onChange={set("seat_count")} type="number" className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">到期时间</label>
              <input value={form.expiry_date} onChange={set("expiry_date")} placeholder="YYYY-MM-DD" className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">MAU</label>
              <input value={form.mau} onChange={set("mau")} type="number" className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">客户联系人</label>
              <input value={form.contact_persons} onChange={set("contact_persons")} className={`mt-1 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-sm text-gray-600">关键决策人</label>
              <input value={form.key_decision_makers} onChange={set("key_decision_makers")} className={`mt-1 ${inputCls}`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600">AI 使用情况</label>
              <input value={form.ai_usage} onChange={set("ai_usage")} className={`mt-1 ${inputCls}`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600">使用场景</label>
              <input value={form.usage_scenes} onChange={set("usage_scenes")} className={`mt-1 ${inputCls}`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600">潜在风险</label>
              <input value={form.potential_risks} onChange={set("potential_risks")} className={`mt-1 ${inputCls}`} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600">待办事项</label>
              <input value={form.pending_todos} onChange={set("pending_todos")} className={`mt-1 ${inputCls}`} />
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={submit}
            disabled={saving}
            className="h-9 rounded-lg bg-[#3370ff] px-5 text-sm font-medium text-white transition hover:bg-[#2b5fe3] disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            onClick={() => router.push("/home/handover")}
            className="h-9 rounded-lg border border-gray-200 px-5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
