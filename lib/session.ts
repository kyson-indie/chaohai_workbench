import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getDb, type UserRow } from "./db";

/**
 * 会话管理：Cookie 里只存随机 token（httpOnly），
 * 用户信息在服务端 sessions 表里，有效期 7 天。
 */

const COOKIE_NAME = "workbench_session";
const SESSION_DAYS = 7;

export function createSession(userId: number): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt
  );
  return token;
}

export function getSessionUser(): UserRow | null {
  const db = getDb();
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as UserRow | undefined;
  return row ?? null;
}

export async function clearSession(): Promise<void> {
  const db = getDb();
  const jar = cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE_NAME);
}

export function setSessionCookie(token: string): void {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}
