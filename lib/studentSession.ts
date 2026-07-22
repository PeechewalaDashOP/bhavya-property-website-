/* Student session — server-side, DB-backed, sliding expiry. Exact mirror
   of lib/dealerSession.ts (same crypto, same cookie pattern, same table
   shape via student_sessions) so the two identity systems can never be
   confused or revoked together by accident. This is the first persistent
   account a customer/student can log into — previously they were
   phone-ephemeral (OTP -> leads row + a 30-day device cookie, nothing to
   log into). */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const STUDENT_SESSION_COOKIE = "p100_ss";
const SESSION_MAX_AGE_S = 45 * 24 * 3600; // 45 days, sliding
const SLIDE_THRESHOLD_MS = 60 * 60 * 1000;

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function randomSessionId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export type StudentSessionInfo = { id: number; name: string | null; phone: string };

export async function createStudentSession(
  studentId: number,
  userAgent: string | null
): Promise<string> {
  const db = serviceDb();
  const sessionId = randomSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_S * 1000).toISOString();
  const { error } = await db.from("student_sessions").insert({
    id: sessionId,
    student_id: studentId,
    expires_at: expiresAt,
    user_agent: userAgent,
  });
  if (error) throw new Error(`Failed to create student session: ${error.message}`);
  return sessionId;
}

export function setStudentSessionCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(STUDENT_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function clearStudentSessionCookie(res: NextResponse) {
  res.cookies.set(STUDENT_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

type SessionRow = {
  id: string;
  expires_at: string;
  revoked: boolean;
  last_seen_at: string;
  students: { id: number; name: string | null; phone: string } | null;
};

export async function getStudentSession(req: NextRequest): Promise<StudentSessionInfo | null> {
  const sessionId = req.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = serviceDb();
  const { data: row } = await db
    .from("student_sessions")
    .select("id, expires_at, revoked, last_seen_at, students(id, name, phone)")
    .eq("id", sessionId)
    .maybeSingle<SessionRow>();

  if (!row || row.revoked) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const student = row.students;
  if (!student) return null;

  const lastSeenMs = new Date(row.last_seen_at).getTime();
  if (Date.now() - lastSeenMs > SLIDE_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_S * 1000).toISOString();
    await db
      .from("student_sessions")
      .update({ last_seen_at: new Date().toISOString(), expires_at: newExpiry })
      .eq("id", sessionId);
  }

  return { id: student.id, name: student.name, phone: student.phone };
}

export async function revokeStudentSession(req: NextRequest): Promise<void> {
  const sessionId = req.cookies.get(STUDENT_SESSION_COOKIE)?.value;
  if (!sessionId) return;
  await serviceDb().from("student_sessions").update({ revoked: true }).eq("id", sessionId);
}
