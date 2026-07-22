import { NextRequest, NextResponse } from "next/server";
import { revokeStudentSession, clearStudentSessionCookie } from "@/lib/studentSession";

export async function POST(req: NextRequest) {
  await revokeStudentSession(req);
  const res = NextResponse.json({ ok: true });
  clearStudentSessionCookie(res);
  return res;
}
