import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { fmt } from "@/lib/format";

function makeRef(): string {
  return "P100-" + Math.floor(1000 + Math.random() * 9000);
}

function hashOtp(otp: string, phone: string): string {
  return crypto.createHash("sha256").update(`${otp}:${phone}`).digest("hex");
}

type OtpRow = { id: number; otp_hash: string; attempts: number };
type DealerRow = { phone: string; name: string };
type PropRow = { title: string; price: number };
type LeadMeta = { magic_token: string };

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

  // Generate unique reference code and insert lead
  let ref = makeRef();
  const { data: clash } = await db
    .from("leads")
    .select("reference_code")
    .eq("reference_code", ref)
    .maybeSingle();
  if (clash) ref = makeRef();

  const { error: insertError } = await db.from("leads").insert({
    reference_code: ref,
    customer_name: name,
    customer_phone: phone,
    property_id: propId,
    dealer_id: dealerId,
    unit_id: unitId,
    unit_label: unitLabel,
    intent,
    msg,
    move_in_date: moveInDate,
    occupants,
    source_url: req.headers.get("referer") ?? null,
    status: "new",
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Lead verified but failed to save. Please try again." },
      { status: 500 }
    );
  }

  // Fetch magic_token, dealer info, and property info in parallel
  const [{ data: leadMeta }, { data: dealerRow }, { data: propRow }] = await Promise.all([
    db.from("leads").select("magic_token").eq("reference_code", ref).maybeSingle(),
    dealerId
      ? db.from("dealers").select("phone, name").eq("id", dealerId).maybeSingle()
      : Promise.resolve({ data: null }),
    propId
      ? db.from("properties").select("title, price").eq("id", propId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const magicToken = (leadMeta as LeadMeta | null)?.magic_token ?? null;
  const dealerPhone = (dealerRow as DealerRow | null)?.phone ?? null;
  const dealerName = (dealerRow as DealerRow | null)?.name ?? null;
  const propTitle = (propRow as PropRow | null)?.title ?? null;
  const propPrice = (propRow as PropRow | null)?.price ?? null;

  // Send WhatsApp to dealer — non-critical, fail silently
  const msg91AuthKey = process.env.MSG91_AUTH_KEY;
  const msg91WhatsappFrom = process.env.MSG91_WHATSAPP_NUMBER;
  const msg91Template = process.env.MSG91_WHATSAPP_TEMPLATE_ID;

  if (msg91AuthKey && msg91WhatsappFrom && msg91Template && dealerPhone && magicToken) {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`
    ).replace(/\/$/, "");

    const propLabel = propTitle
      ? `${propTitle}${propPrice ? " " + fmt(propPrice) : ""}`
      : "General enquiry";
    const maskedPhone = phone.slice(0, 4) + "XXXXXX";

    try {
      await fetch(
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
              to: "91" + dealerPhone,
              type: "template",
              template: {
                name: msg91Template,
                language: { code: "en" },
                components: [
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: propLabel },
                      { type: "text", text: name },
                      { type: "text", text: maskedPhone },
                      { type: "text", text: moveInDate || "Not specified" },
                      { type: "text", text: String(occupants ?? 1) },
                      { type: "text", text: ref },
                    ],
                  },
                  {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [
                      { type: "text", text: `${magicToken}/contacted` },
                    ],
                  },
                  {
                    type: "button",
                    sub_type: "url",
                    index: "1",
                    parameters: [
                      { type: "text", text: `${magicToken}/closed` },
                    ],
                  },
                ],
              },
            },
          }),
        }
      );
    } catch {
      // WhatsApp delivery failure does not fail the lead — admin sees it in Supabase
    }
  }

  return NextResponse.json({ ref, dealerPhone });
}
