import { NextRequest, NextResponse } from "next/server";
import { revokeDealerSession, clearDealerSessionCookie } from "@/lib/dealerSession";

/* Real logout — revokes the session row server-side (so the cookie value
   stops working immediately, not just on this device) and clears the
   cookie. Always succeeds even if there's no session to revoke, since the
   end state ("logged out") is the same either way. */
export async function POST(req: NextRequest) {
  await revokeDealerSession(req);
  const res = NextResponse.json({ ok: true });
  clearDealerSessionCookie(res);
  return res;
}
