/* Customer "verified device" token — same HMAC scheme as lib/dealerSession.ts.
   Issued as an httpOnly cookie (p100_pv) after a successful OTP verify, so a
   customer verifies once per device (~30 days) instead of once per property.
   Nothing is ever stored client-readable — the phone lives only inside this
   server-verified token (CLAUDE.md: never put phone numbers in localStorage).
   Rotating PHONE_VERIFY_SECRET invalidates every cookie at once (incident
   response lever). */

import crypto from "crypto";

export type PhoneVerifyPayload = { ph: string; name: string; exp: number };

export const PHONE_VERIFY_COOKIE = "p100_pv";
export const PHONE_VERIFY_MAX_AGE_S = 30 * 24 * 3600; // 30 days

function secret(): string | null {
  return process.env.PHONE_VERIFY_SECRET || null;
}

export function signPhoneToken(phone: string, name: string): string {
  const s = secret();
  if (!s) throw new Error("PHONE_VERIFY_SECRET is not configured");
  const data: PhoneVerifyPayload = {
    ph: phone,
    name,
    exp: Date.now() + PHONE_VERIFY_MAX_AGE_S * 1000,
  };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPhoneToken(token: string): PhoneVerifyPayload | null {
  const s = secret();
  if (!s) return null;
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = crypto.createHmac("sha256", s).update(payload).digest("base64url");
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as PhoneVerifyPayload;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (typeof data.ph !== "string" || data.ph.length !== 10) return null;
    return data;
  } catch {
    return null;
  }
}
