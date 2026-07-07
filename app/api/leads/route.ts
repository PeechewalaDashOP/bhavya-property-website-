import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeRef(): string {
  return "P100-" + Math.floor(1000 + Math.random() * 9000);
}

type DealerRow = { phone: string };

// Direct lead save — OTP temporarily disabled until WhatsApp Business API is approved.
// To re-enable OTP: revert SiteClient.tsx + PropertyDetail.tsx to call /api/otp/send → /api/otp/verify.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name       = String(body.name ?? "").trim();
  const phone      = String(body.phone ?? "").replace(/\D/g, "");
  const propId     = body.propId    ? Number(body.propId)             : null;
  const dealerId   = body.dealerId  ? Number(body.dealerId)           : null;
  const unitId     = body.unitId    ? Number(body.unitId)             : null;
  const unitLabel  = body.unitLabel ? String(body.unitLabel).trim()   : null;
  const moveInDate = body.moveInDate ? String(body.moveInDate)        : null;
  const occupants  = body.occupants ? Number(body.occupants)          : null;
  const intent     = body.intent    ? String(body.intent).trim()      : null;
  const msg        = body.msg       ? String(body.msg).trim()         : null;

  if (name.length < 2)   return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (phone.length < 10) return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });

  const url         = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return NextResponse.json({ ref: makeRef(), dealerPhone: null, demo: true });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  let ref = makeRef();
  const { data: clash } = await db
    .from("leads").select("reference_code").eq("reference_code", ref).maybeSingle();
  if (clash) ref = makeRef();

  const { error: insertError } = await db.from("leads").insert({
    reference_code: ref,
    customer_name:  name,
    customer_phone: phone,
    property_id:    propId,
    dealer_id:      dealerId,
    unit_id:        unitId,
    unit_label:     unitLabel,
    move_in_date:   moveInDate,
    occupants,
    intent,
    msg,
    source_url: req.headers.get("referer") ?? null,
    status: "new",
  });

  if (insertError) {
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }

  // Fetch dealer phone to reveal to customer
  let dealerPhone: string | null = null;
  if (dealerId) {
    const { data } = await db
      .from("dealers").select("phone").eq("id", dealerId).maybeSingle() as { data: DealerRow | null };
    dealerPhone = data?.phone ?? null;
  }

  return NextResponse.json({ ref, dealerPhone });
}
