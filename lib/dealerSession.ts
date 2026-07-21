/* Dealer session — server-side, DB-backed, sliding expiry.
   Replaces the old stateless HMAC token (signed once, stored in browser
   localStorage, only revocable by rotating one global secret for every
   dealer at once). This version:
     - lives in an httpOnly cookie (p100_ds) — never readable by page JS
     - is a random opaque id, not a signed payload — the DB row is the
       source of truth, so a single session can be revoked without
       touching anyone else's
     - slides forward on use (SESSION_MAX_AGE_S from the last request),
       so a daily-active dealer never sees a login screen while an
       abandoned session self-expires on schedule
   This sliding cookie IS the "trusted device" in the frozen auth design
   — there is deliberately no separate long-lived trusted-device token;
   one mechanism does both jobs. */

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const DEALER_SESSION_COOKIE = "p100_ds";
const SESSION_MAX_AGE_S = 45 * 24 * 3600; // 45 days, sliding
// Only re-touch expires_at if the last slide was over an hour ago — a
// single dashboard page load can fire several parallel authenticated
// requests; this keeps that from writing to dealer_sessions 4-5 times
// for one visit.
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

export type DealerSessionInfo = { id: number; name: string; phone: string };

/* Call after a successful OTP verify. Creates the session row and returns
   the opaque id — the caller sets it as the cookie via
   setDealerSessionCookie(). */
export async function createDealerSession(
  dealerId: number,
  userAgent: string | null
): Promise<string> {
  const db = serviceDb();
  const sessionId = randomSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_S * 1000).toISOString();
  const { error } = await db.from("dealer_sessions").insert({
    id: sessionId,
    dealer_id: dealerId,
    expires_at: expiresAt,
    user_agent: userAgent,
  });
  if (error) throw new Error(`Failed to create dealer session: ${error.message}`);
  return sessionId;
}

export function setDealerSessionCookie(res: NextResponse, sessionId: string) {
  res.cookies.set(DEALER_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export function clearDealerSessionCookie(res: NextResponse) {
  res.cookies.set(DEALER_SESSION_COOKIE, "", {
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
  dealers: { id: number; name: string; phone: string; can_login: boolean } | null;
};

/* Reads the session cookie, validates it against the DB, and slides the
   expiry forward on a live session. Returns null for any invalid,
   expired, revoked session, or a dealer whose login has been disabled
   (can_login=false) — callers never need to distinguish why, "null" just
   means "not logged in, send them to /dealer/login." */
export async function getDealerSession(req: NextRequest): Promise<DealerSessionInfo | null> {
  const sessionId = req.cookies.get(DEALER_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = serviceDb();
  const { data: row } = await db
    .from("dealer_sessions")
    .select("id, expires_at, revoked, last_seen_at, dealers(id, name, phone, can_login)")
    .eq("id", sessionId)
    .maybeSingle<SessionRow>();

  if (!row || row.revoked) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const dealer = row.dealers;
  if (!dealer || !dealer.can_login) return null;

  const lastSeenMs = new Date(row.last_seen_at).getTime();
  if (Date.now() - lastSeenMs > SLIDE_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_S * 1000).toISOString();
    await db
      .from("dealer_sessions")
      .update({ last_seen_at: new Date().toISOString(), expires_at: newExpiry })
      .eq("id", sessionId);
  }

  return { id: dealer.id, name: dealer.name, phone: dealer.phone };
}

/* Logout — revokes just the session in this request's cookie. Real
   revocation (a DB flag), not just clearing client state, so a copied-out
   cookie value stops working immediately rather than staying valid until
   its natural expiry. */
export async function revokeDealerSession(req: NextRequest): Promise<void> {
  const sessionId = req.cookies.get(DEALER_SESSION_COOKIE)?.value;
  if (!sessionId) return;
  await serviceDb().from("dealer_sessions").update({ revoked: true }).eq("id", sessionId);
}

/* Lost phone / admin-assisted incident response — revokes every session
   for one dealer without touching any other dealer's sessions. Not wired
   to a self-service UI yet (deferred per the launch triage), but the
   capability exists from day one so it's a cheap admin action later, not
   a redesign. */
export async function revokeAllDealerSessions(dealerId: number): Promise<void> {
  await serviceDb().from("dealer_sessions").update({ revoked: true }).eq("dealer_id", dealerId);
}
