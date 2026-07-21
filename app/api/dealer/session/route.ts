import { NextRequest, NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealerSession";

/* Lightweight "am I logged in" probe. The session cookie is httpOnly, so
   client components can't just read it — this is the one cheap round trip
   pages use to decide whether to show a login/identity form or skip it. */
export async function GET(req: NextRequest) {
  const session = await getDealerSession(req);
  if (!session) return NextResponse.json({ loggedIn: false }, { status: 401 });
  return NextResponse.json({ loggedIn: true, name: session.name });
}
