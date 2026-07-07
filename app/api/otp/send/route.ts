import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function hashOtp(otp: string, phone: string): string {
  return crypto.createHash("sha256").update(`${otp}:${phone}`).digest("hex");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const msg91AuthKey = process.env.MSG91_AUTH_KEY;
  const msg91TemplateId = process.env.MSG91_OTP_TEMPLATE_ID;

  if (!url || !serviceRole || !msg91AuthKey || !msg91TemplateId) {
    return NextResponse.json({ error: "OTP service not configured." }, { status: 503 });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  // 1. Clean up expired rows for this phone (keep table tidy)
  await db
    .from("otp_verifications")
    .delete()
    .eq("phone", phone)
    .lt("expires_at", new Date().toISOString());

  // 2. Rate limit: max 1 OTP send per phone per 60 seconds
  const { data: recent } = await db
    .from("otp_verifications")
    .select("created_at")
    .eq("phone", phone)
    .is("verified_at", null)
    .gt("created_at", new Date(Date.now() - 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const waitMs = 60_000 - (Date.now() - new Date(recent.created_at).getTime());
    const waitSec = Math.max(1, Math.ceil(waitMs / 1000));
    return NextResponse.json(
      { error: `OTP already sent. Please wait ${waitSec} second${waitSec === 1 ? "" : "s"} before requesting again.` },
      { status: 429 }
    );
  }

  // 3. Generate cryptographically random 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otp_hash = hashOtp(otp, phone);
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 4. Store hashed OTP in DB before sending (so we can verify it)
  const { error: insertError } = await db.from("otp_verifications").insert({
    phone,
    otp_hash,
    expires_at,
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to create OTP. Please try again." }, { status: 500 });
  }

  // 5. Send via MSG91
  let msg91Failed = false;
  try {
    const msg91Res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        authkey: msg91AuthKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        mobile: "91" + phone,
        template_id: msg91TemplateId,
        otp,
      }),
    });
    const msg91Data = await msg91Res.json().catch(() => null) as Record<string, unknown> | null;
    if (!msg91Res.ok || msg91Data?.type === "error") {
      msg91Failed = true;
    }
  } catch {
    msg91Failed = true;
  }

  if (msg91Failed) {
    // Roll back the DB row so the user can retry immediately
    await db.from("otp_verifications").delete().eq("phone", phone).eq("otp_hash", otp_hash);
    return NextResponse.json(
      { error: "Failed to send OTP. Please check your number and try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
