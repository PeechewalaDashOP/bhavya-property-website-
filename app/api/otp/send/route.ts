import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function hashOtp(otp: string, phone: string): string {
  return crypto.createHash("sha256").update(`${otp}:${phone}`).digest("hex");
}

// Best-effort, single-instance in-memory cap — no schema change, no new paid
// service. Resets on cold start and isn't shared across concurrent Vercel
// instances, so it won't stop a distributed attacker, but it raises the bar
// against a single script hammering this endpoint (the per-phone 60s limit
// below doesn't stop someone cycling through many phone numbers). Kota hostel
// and coaching-center WiFi puts many genuine students behind one shared IP
// (NAT), so this is deliberately generous — a blast-radius cap, not a strict
// per-user quota. If real abuse shows up, replace with Upstash Redis or
// similar for a cross-instance limit.
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_SENDS = 15;
const ipHits = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_MAX_SENDS) {
    ipHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
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

  if (!checkIpRateLimit(getClientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests from this network. Please try again in a few minutes." },
      { status: 429 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const msg91AuthKey = process.env.MSG91_AUTH_KEY;
  const msg91WhatsappFrom = process.env.MSG91_WHATSAPP_NUMBER;
  const msg91OtpTemplate = process.env.MSG91_OTP_WHATSAPP_TEMPLATE_ID;
  const msg91Namespace = process.env.MSG91_WHATSAPP_NAMESPACE;

  if (!url || !serviceRole || !msg91AuthKey || !msg91WhatsappFrom || !msg91OtpTemplate || !msg91Namespace) {
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

  // 5. Send via MSG91's WhatsApp Business API (Authentication-category template
  // with a Copy Code button), NOT the SMS OTP widget. Verification stays 100%
  // local (see /api/otp/verify) — MSG91 here is delivery-only.
  //
  // Payload shape: this is MSG91's OWN abstraction over Meta's Cloud API for
  // this endpoint — `to_and_components` with a `components` OBJECT keyed by
  // "body_1"/"button_1" etc, NOT Meta's raw `components` ARRAY (which is what
  // the dealer-alert/nudge sends elsewhere in this codebase use — those were
  // never actually tested against a real template and likely have the same
  // shape bug; fix when that work happens). Confirmed against the literal
  // "Code {JSON}" sample MSG91's dashboard generates for THIS template
  // (WhatsApp → Templates → prop100_otp_verification → <> icon) — don't
  // "correct" this shape from Meta docs again, match MSG91's sample exactly.
  let msg91Failed = false;
  // Diagnostic only — populated on failure, never contains the OTP or the
  // auth key. Logged via console.error() below so it shows up in Vercel's
  // Logs tab; nothing is printed on the success path.
  let msg91FailureDetail = "";
  try {
    const msg91Res = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: {
          authkey: msg91AuthKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          integrated_number: msg91WhatsappFrom,
          content_type: "template",
          payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
              name: msg91OtpTemplate,
              language: { code: "en", policy: "deterministic" },
              namespace: msg91Namespace,
              to_and_components: [
                {
                  to: ["91" + phone],
                  components: {
                    body_1: { type: "text", value: otp },
                    button_1: { subtype: "url", type: "text", value: otp },
                  },
                },
              ],
            },
          },
        }),
      }
    );
    const msg91Data = await msg91Res.json().catch(() => null) as Record<string, unknown> | null;
    // MSG91's real failure shape is {status:"fail", hasError:true, errors:"..."}
    // — NOT {type:"error"} (that check was wrong from the start; HTTP 400 caught
    // the first real failure anyway, but a 200-with-in-body-failure would have
    // slipped through undetected).
    if (!msg91Res.ok || msg91Data?.status === "fail" || msg91Data?.hasError === true) {
      msg91Failed = true;
      msg91FailureDetail = `HTTP ${msg91Res.status} — ${JSON.stringify(msg91Data)}`;
    }
  } catch (err) {
    msg91Failed = true;
    msg91FailureDetail = `fetch threw — ${err instanceof Error ? err.message : String(err)}`;
  }

  if (msg91Failed) {
    console.error(
      `[otp/send] MSG91 WhatsApp send failed for phone ending ${phone.slice(-4)}: ${msg91FailureDetail}`
    );
    // Roll back the DB row so the user can retry immediately
    await db.from("otp_verifications").delete().eq("phone", phone).eq("otp_hash", otp_hash);
    return NextResponse.json(
      { error: "Failed to send OTP. Please check your number and try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
