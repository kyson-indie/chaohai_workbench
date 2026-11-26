import type { ComponentType } from "react";

/**
 * 左侧菜单的集中配置（编译期静态数据）。
 * 扩展方式：数组加一项 + 新建 app/home/<key>/page.tsx，无需改其他代码。
 */
export type MenuItem = {
  /** 路由段，同时用于选中态匹配 */
  key: string;
  /** 中文菜单名 */
  label: string;
  /** 内联 SVG 图标组件（沿用登录页做法，不引第三方图标库） */
  icon: ComponentType<{ className?: string }>;
};

const PresalesIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M3 17l4-10 4 10M4.8 13.5h4.4" />
    <path d="M13 7l4.5 4.5L22 7" transform="translate(0,1)" />
  </svg>
);

const HandoverIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M16 3l5 5-5 5" />
    <path d="M4 20V12a4 4 0 0 1 4-4h13" />
  </svg>
);

const OperationsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5" cy="19" r="2.2" />
    <circle cx="19" cy="19" r="2.2" />
    <path d="M12 7.2v4.3M12 11.5L6.8 17M12 11.5l5.2 5.5" />
  </svg>
);

export const MENU_ITEMS: MenuItem[] = [
  { key: "presales", label: "售前", icon: PresalesIcon },
  { key: "handover", label: "交接", icon: HandoverIcon },
  { key: "operations", label: "运营", icon: OperationsIcon },
];
