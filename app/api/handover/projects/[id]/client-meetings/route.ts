import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/lib/db";
import { getHandoverProject, logAction } from "@/lib/handover";
import type { ClientMeetingRow } from "@/lib/handover";

export const dynamic = "force-dynamic";

interface MeetingCreateBody {
  planned_at?: string;
  note?: string;
}

interface MeetingPatchBody {
  meeting_id?: number;
  planned_at?: string;
  status?: string; // scheduled / done
  note?: string;
}

const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;

function listMeetings(projectId: number): ClientMeetingRow[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM handover_client_meetings WHERE project_id = ? ORDER BY planned_at ASC, id ASC"
    )
    .all(projectId) as ClientMeetingRow[];
}

/** 登记客户交接会议（REQ-008：填写约定时间与备注，保存后状态为「已安排」） */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: MeetingCreateBody;
  try {
    body = (await request.json()) as MeetingCreateBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const plannedAt = (body.planned_at ?? "").trim();
  if (!DATETIME_RE.test(plannedAt)) {
    return NextResponse.json(
      { error: "会议时间格式应为 YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss" },
      { status: 400 }
    );
  }

  const db = getDb();
  const write = db.transaction(() => {
    db.prepare(
      "INSERT INTO handover_client_meetings (project_id, planned_at, status, note) VALUES (?, ?, 'scheduled', ?)"
    ).run(id, plannedAt, body.note?.trim() || null);
    logAction({
      projectId: id,
      actionType: "client_meeting",
      operator: user,
      oldValue: null,
      newValue: `${plannedAt}|scheduled`,
    });
  });
  write();

  return NextResponse.json({ meetings: listMeetings(id) }, { status: 201 });
}

/** 标记完成 / 改期（REQ-008：改期即编辑 planned_at） */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const id = Number(params.id);
  const project = getHandoverProject(id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  let body: MeetingPatchBody;
  try {
    body = (await request.json()) as MeetingPatchBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const meetingId = body.meeting_id;
  if (!Number.isInteger(meetingId) || (meetingId ?? 0) <= 0) {
    return NextResponse.json({ error: "缺少有效的 meeting_id" }, { status: 400 });
  }
  const db = getDb();
  const meeting = db
    .prepare("SELECT * FROM handover_client_meetings WHERE id = ? AND project_id = ?")
    .get(meetingId, id) as ClientMeetingRow | undefined;
  if (!meeting) return NextResponse.json({ error: "会议不存在" }, { status: 404 });

  let plannedAt = meeting.planned_at;
  if (typeof body.planned_at === "string") {
    plannedAt = body.planned_at.trim();
    if (!DATETIME_RE.test(plannedAt)) {
      return NextResponse.json(
        { error: "会议时间格式应为 YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss" },
        { status: 400 }
      );
    }
  }

  let status = meeting.status;
  if (typeof body.status === "string") {
    if (!["scheduled", "done"].includes(body.status)) {
      return NextResponse.json({ error: "会议状态不正确" }, { status: 400 });
    }
    status = body.status;
  }

  const note = typeof body.note === "string" ? body.note.trim() || null : meeting.note;

  const write = db.transaction(() => {
    db.prepare(
      "UPDATE handover_client_meetings SET planned_at = ?, status = ?, note = ? WHERE id = ?"
    ).run(plannedAt, status, note, meetingId);
    if (plannedAt !== meeting.planned_at || status !== meeting.status) {
      logAction({
        projectId: id,
        actionType: "client_meeting",
        operator: user,
        oldValue: `${meeting.planned_at}|${meeting.status}`,
        newValue: `${plannedAt}|${status}`,
      });
    }
  });
  write();

  return NextResponse.json({ meetings: listMeetings(id) });
}
