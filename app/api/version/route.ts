import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * 版本接口（供部署后人工核对「线上到底跑的是哪个提交」）。
 * 部署脚本在每次构建后把 commit 写入 .build-info；本接口原样读出。
 * 文件缺失或损坏时返回 unknown，不做任何猜测。
 */
export async function GET() {
  let commit = "unknown";
  let builtAt = "unknown";
  try {
    const info = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), ".build-info"), "utf8")
    ) as { commit?: string; builtAt?: string };
    commit = info.commit ?? "unknown";
    builtAt = info.builtAt ?? "unknown";
  } catch {
    // .build-info 尚未生成（首次部署前）或读取失败：如实返回 unknown
  }
  return NextResponse.json({ commit, builtAt });
}
