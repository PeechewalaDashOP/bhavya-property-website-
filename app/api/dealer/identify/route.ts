import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signDealerToken } from "@/lib/dealerSession";

// Owner self-post identity capture — name + WhatsApp only, no OTP.
// Temporary, same tradeoff already accepted in /api/dealer/login/direct:
// OTP verification will be added once the WhatsApp Business API is approved.
// Until then, anyone can claim any phone number here — this only grants a
// dealer session (post/edit their own listings), not access to anyone
// else's leads or existing data.

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; whatsapp?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.whatsapp ?? "").replace(/\D/g, "").slice(-10);

  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit WhatsApp number" }, { status: 400 });
  }

  const db = serviceDb();

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
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let token: string;
  try {
    token = signDealerToken(dealerId, phone, dealerName);
  } catch {
    return NextResponse.json({ error: "Server session config missing" }, { status: 500 });
  }

  return NextResponse.json({ token, name: dealerName });
}
