import { NextRequest, NextResponse } from "next/server";
import { getStudentSession } from "@/lib/studentSession";

/* Lightweight "am I logged in" probe — same pattern as
   /api/dealer/session. The session cookie is httpOnly, so client
   components can't just read it. */
export async function GET(req: NextRequest) {
  const session = await getStudentSession(req);
  if (!session) return NextResponse.json({ loggedIn: false }, { status: 401 });
  return NextResponse.json({ loggedIn: true, name: session.name, phone: session.phone });
}
