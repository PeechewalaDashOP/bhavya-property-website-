import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { signDealerToken } from "@/lib/dealerSession";

function hashOtp(otp: string, phone: string): string {
  return crypto.createHash("sha256").update(`${otp}:${phone}`).digest("hex");
}

type OtpRow = { id: number; otp_hash: string; attempts: number };
type DealerRow = { id: number; name: string; role: string };

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const otp = String(body.otp ?? "").replace(/\D/g, "");

  if (phone.length !== 10) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }
  if (otp.length !== 6) {
    return NextResponse.json({ error: "Enter the 6-digit OTP" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  // Look up latest unverified, unexpired OTP row
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
      { error: "Too many attempts. Please request a new OTP." },
      { status: 429 }
    );
  }

  const computed = hashOtp(otp, phone);
  const storedBuf = Buffer.from(otpRow.otp_hash, "hex");
  const computedBuf = Buffer.from(computed, "hex");
  const match =
    storedBuf.length === computedBuf.length &&
    crypto.timingSafeEqual(storedBuf, computedBuf);

  if (!match) {
    const newAttempts = otpRow.attempts + 1;
    await db
      .from("otp_verifications")
      .update({ attempts: newAttempts })
      .eq("id", otpRow.id);
    const rem = 3 - newAttempts;
    if (rem <= 0) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new OTP." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: `Incorrect OTP. ${rem} attempt${rem === 1 ? "" : "s"} remaining.` },
      { status: 400 }
    );
  }

  // Mark OTP as used
  await db
    .from("otp_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", otpRow.id);

  // Look up dealer by phone — dealers may store phone with or without country code
  const { data: dealer } = await db
    .from("dealers")
    .select("id, name, role")
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle() as { data: DealerRow | null };

  if (!dealer) {
    return NextResponse.json(
      { error: "This number is not registered as a dealer. Contact admin." },
      { status: 403 }
    );
  }

  const token = signDealerToken(dealer.id, phone, dealer.name);
  return NextResponse.json({ token, dealer: { id: dealer.id, name: dealer.name } });
}
