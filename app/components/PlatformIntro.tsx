'use client';

import { useState } from 'react';

// 核心能力条目文案（建议稿，上线前需需求方确认，可整体替换）
const capabilities = [
  { title: '统一入口', desc: '顾问日常工作集中在一个工作台完成' },
  { title: '智能提效', desc: '借助 AI 能力简化重复性事务' },
  { title: '团队协同', desc: '顾问团体内的信息共享与协作' },
];

/**
 * 平台介绍区块：首页首屏顶部展示价值主张与核心能力，
 * 支持最小化折叠为一行折叠条，点击折叠条可重新展开。
 * 折叠状态不持久化，刷新后恢复默认展开（需求决策）。
 */
export default function PlatformIntro() {
  // 初始为展开态，由服务端渲染输出首屏 HTML，避免水合不一致
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-controls="platform-intro"
        onClick={() => setCollapsed(false)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-background px-4 py-3 text-left text-sm text-gray-600 transition-colors hover:bg-gray-50"
      >
        <span className="font-medium text-foreground">潮海顾问工作台 · 点击展开介绍</span>
        <span aria-hidden="true">▾</span>
      </button>
    );
  }

  return (
    <section id="platform-intro" role="region" className="w-full rounded-xl border border-gray-200 bg-background p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight sm:text-2xl">
            潮海顾问工作台 —— 用于潮海的顾问团体日常工作的提效与智能化
          </h2>
        </div>
        <button
          type="button"
          aria-expanded={true}
          aria-controls="platform-intro"
          onClick={() => setCollapsed(true)}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 sm:text-sm"
        >
          收起 ▴
        </button>
      </div>
      <ul className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-6">
        {capabilities.map((item) => (
          <li key={item.title} className="min-w-0 flex-1 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm font-semibold text-foreground sm:text-base">{item.title}</p>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">{item.desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
