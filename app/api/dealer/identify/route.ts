import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { createDealerSession, setDealerSessionCookie } from "@/lib/dealerSession";

// First-time owner self-post identity — OTP-verified (purpose='owner_post'),
// then finds-or-creates the dealer row and starts a real session, same as
// the regular login path. Previously this granted a session for just
// name+phone with zero proof of ownership; anyone could claim any phone
// number here.

function hashOtp(otp: string, phone: string): string {
  return crypto.createHash("sha256").update(`${otp}:${phone}`).digest("hex");
}

type OtpRow = { id: number; otp_hash: string; attempts: number };

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; whatsapp?: unknown; otp?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.whatsapp ?? "").replace(/\D/g, "").slice(-10);
  const otp = String(body.otp ?? "").replace(/\D/g, "");

  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit WhatsApp number" }, { status: 400 });
  }
  if (otp.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit OTP" }, { status: 400 });
  }

  const db = serviceDb();

  const { data: otpRow } = await db
    .from("otp_verifications")
    .select("id, otp_hash, attempts")
    .eq("phone", phone)
    .eq("purpose", "owner_post")
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
    return NextResponse.json({ error: "Too many attempts. Please request a new OTP." }, { status: 429 });
  }

  const computed = hashOtp(otp, phone);
  const storedBuf = Buffer.from(otpRow.otp_hash, "hex");
  const computedBuf = Buffer.from(computed, "hex");
  const match =
    storedBuf.length === computedBuf.length &&
    crypto.timingSafeEqual(storedBuf, computedBuf);

  if (!match) {
    const newAttempts = otpRow.attempts + 1;
    await db.from("otp_verifications").update({ attempts: newAttempts }).eq("id", otpRow.id);
    const rem = 3 - newAttempts;
    if (rem <= 0) {
      return NextResponse.json({ error: "Too many attempts. Please request a new OTP." }, { status: 429 });
    }
    return NextResponse.json(
      { error: `Incorrect OTP. ${rem} attempt${rem === 1 ? "" : "s"} remaining.` },
      { status: 400 }
    );
  }

  await db
    .from("otp_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", otpRow.id);

  const { data: existing } = await db
    .from("dealers")
    .select("id,name")
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle();

  let dealerId: number;
  let dealerName: string;

  if (existing) {
    dealerId = existing.id;
    dealerName = existing.name; // existing record is the source of truth, never overwritten here
  } else {
    dealerId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    dealerName = name;
    const { error } = await db.from("dealers").insert({
      id: dealerId,
      name,
      role: "owner",
      phone,
      whatsapp_number: phone,
      areas_covered: [],
      years: 0,
      rating: 0,
      is_active: false, // self-listed owner — hidden from the public "partners" list
      can_login: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sessionId = await createDealerSession(dealerId, req.headers.get("user-agent"));
  const res = NextResponse.json({ name: dealerName });
  setDealerSessionCookie(res, sessionId);
  return res;
}
