/**
 * 本期占位页：右侧工作区的统一内容，文案对非技术人员可读。
 */
export default function Placeholder({ menuName }: { menuName: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
      <h2 className="text-xl font-semibold text-gray-700">{menuName}模块建设中，敬请期待</h2>
      <p className="text-sm text-gray-400">该功能将在后续版本开放，当前页面仅作占位展示</p>
    </div>
  );
}
