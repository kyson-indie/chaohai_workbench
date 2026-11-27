import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { LINK_TYPES, getHandoverProject } from "@/lib/handover";
import type { HandoverLinkRow } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface LinkBody {
  link_type?: string;
  title?: string;
  url?: string;
}

function listLinks(projectId: number): HandoverLinkRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM handover_links WHERE project_id = ? ORDER BY created_at DESC, id DESC")
    .all(projectId) as HandoverLinkRow[];
}

/** 添加交接材料链接（REQ-005/006：类型 + 标题 + URL，URL 仅做非空与 http(s) 轻校验） */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: LinkBody;
  try {
    body = (await request.json()) as LinkBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const linkType = body.link_type ?? "";
  const title = (body.title ?? "").trim();
  const url = (body.url ?? "").trim();
  if (!(linkType in LINK_TYPES)) {
    return NextResponse.json({ error: "链接类型不正确" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "链接必须以 http(s):// 开头" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    "INSERT INTO handover_links (project_id, link_type, title, url, created_by) VALUES (?, ?, ?, ?, ?)"
  ).run(id, linkType, title, url, user.id);

  return NextResponse.json({ links: listLinks(id) }, { status: 201 });
}

/** 删除交接材料链接 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const linkId = Number(new URL(request.url).searchParams.get("link_id") ?? "");
  if (!Number.isInteger(linkId) || linkId <= 0) {
    return NextResponse.json({ error: "缺少有效的 link_id" }, { status: 400 });
  }

  const db = getDb();
  const res = db
    .prepare("DELETE FROM handover_links WHERE id = ? AND project_id = ?")
    .run(linkId, id);
  if (res.changes === 0) {
    return NextResponse.json({ error: "链接不存在" }, { status: 404 });
  }
  return NextResponse.json({ links: listLinks(id) });
}
