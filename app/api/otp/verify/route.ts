import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { createLead } from "@/lib/leadService";
import {
  signPhoneToken,
  PHONE_VERIFY_COOKIE,
  PHONE_VERIFY_MAX_AGE_S,
} from "@/lib/phoneVerifySession";

function hashOtp(otp: string, phone: string): string {
  return crypto.createHash("sha256").update(`${otp}:${phone}`).digest("hex");
}

type OtpRow = { id: number; otp_hash: string; attempts: number };

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const token = String(body.token ?? "").replace(/\D/g, "");
  const name = String(body.name ?? "").trim();
  const propId = body.propId ? Number(body.propId) : null;
  const dealerId = body.dealerId ? Number(body.dealerId) : null;
  const unitId = body.unitId ? Number(body.unitId) : null;
  const unitLabel = body.unitLabel ? String(body.unitLabel).trim() : null;
  const moveInDate = body.moveInDate ? String(body.moveInDate) : null;
  const occupants = body.occupants ? Number(body.occupants) : null;
  const intent = String(body.intent ?? "").trim() || null;
  const msg = String(body.msg ?? "").trim() || null;
  const consentedToCommission = body.consentedToCommission === true;

  if (phone.length !== 10) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }
  if (token.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit OTP" }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return NextResponse.json({ error: "OTP service not configured" }, { status: 503 });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  // Look up latest unverified, unexpired OTP row for this phone
  const { data: otpRow } = await db
    .from("otp_verifications")
    .select("id, otp_hash, attempts")
    .eq("phone", phone)
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: OtpRow | null };

  if (!otpRow) {
    return NextResponse.json(
      { error: "OTP expired or not found. Please request a new OTP." },
      { status: 400 }
    );
  }

  if (otpRow.attempts >= 3) {
    return NextResponse.json(
      { error: "Too many incorrect attempts. Please request a new OTP." },
      { status: 429 }
    );
  }

  // Timing-safe hash comparison
  const computedHash = hashOtp(token, phone);
  const storedBuf = Buffer.from(otpRow.otp_hash, "hex");
  const computedBuf = Buffer.from(computedHash, "hex");
  const isMatch =
    storedBuf.length === computedBuf.length &&
    crypto.timingSafeEqual(storedBuf, computedBuf);

  if (!isMatch) {
    const newAttempts = otpRow.attempts + 1;
    await db
      .from("otp_verifications")
      .update({ attempts: newAttempts })
      .eq("id", otpRow.id);
    const remaining = 3 - newAttempts;
    if (remaining <= 0) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new OTP." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` },
      { status: 400 }
    );
  }

  // OTP correct — mark as used (single-use, cannot be replayed)
  await db
    .from("otp_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", otpRow.id);

  // Create the lead through the shared service (dedup + billing + notify all
  // live there — one code path for OTP, verified-device, and general leads).
  let result;
  try {
    result = await createLead(db, {
      name,
      phone,
      propId,
      dealerId,
      unitId,
      unitLabel,
      moveInDate,
      occupants,
      intent,
      msg,
      sourceUrl: req.headers.get("referer") ?? null,
      consentedToCommission,
    });
  } catch {
    return NextResponse.json(
      { error: "Lead verified but failed to save. Please try again." },
      { status: 500 }
    );
  }

  // Set the verified-device cookie: this phone won't need OTP again on this
  // browser for 30 days. httpOnly — nothing readable client-side. A verify
  // with a different phone overwrites it (that IS the rotation mechanism).
  const res = NextResponse.json({
    ref: result.ref,
    dealerPhone: result.dealerPhone,
    billing: result.billing,
    consentRequired: result.consentRequired ?? false,
  });
  try {
    res.cookies.set(PHONE_VERIFY_COOKIE, signPhoneToken(phone, name), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: PHONE_VERIFY_MAX_AGE_S,
    });
  } catch {
    // PHONE_VERIFY_SECRET not configured — flow still works, just no
    // frictionless repeat visits until the env var is set.
  }
  return res;
}
