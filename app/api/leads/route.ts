import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function makeRef(): string {
  return "P100-" + Math.floor(1000 + Math.random() * 9000);
}

// Footer general-enquiry lead — no OTP required.
// OTP-verified property/dealer leads go through /api/otp/verify instead.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const intent = String(body.intent ?? "").trim() || null;
  const msg = String(body.msg ?? "").trim() || null;

  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (phone.length < 10) {
    return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return NextResponse.json({ ref: makeRef(), demo: true });
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false },
  });

  let ref = makeRef();
  const { data: clash } = await supabase
    .from("leads")
    .select("reference_code")
    .eq("reference_code", ref)
    .maybeSingle();
  if (clash) ref = makeRef();

  const { error } = await supabase.from("leads").insert({
    reference_code: ref,
    customer_name: name,
    customer_phone: phone,
    intent,
    msg,
    status: "new",
  });

  if (error) {
    return NextResponse.json({ error: "Failed to save enquiry. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ref });
}
