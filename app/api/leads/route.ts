import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createLead } from "@/lib/leadService";

function makeRef(): string {
  return "P100-" + Math.floor(1000 + Math.random() * 9000);
}

/* General enquiries ONLY (footer form, callback requests). This route never
   accepts a property/dealer target and never returns a dealer phone —
   contact reveals happen exclusively through /api/otp/verify and
   /api/leads/verified. (Previously this route accepted propId and returned
   dealerPhone with no verification at all — a full OTP-gateway bypass for
   anyone with curl.) */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const intent = body.intent ? String(body.intent).trim() : null;
  const msg = body.msg ? String(body.msg).trim() : null;
  const moveInDate = body.moveInDate ? String(body.moveInDate) : null;
  const occupants = body.occupants ? Number(body.occupants) : null;

  if (name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (phone.length < 10) return NextResponse.json({ error: "Valid phone number is required" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    // Sample-data/demo mode — keep the footer form functional
    return NextResponse.json({ ref: makeRef(), demo: true });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  try {
    const result = await createLead(db, {
      name,
      phone: phone.slice(-10),
      propId: null,   // deliberately ignored even if sent
      dealerId: null, // deliberately ignored even if sent
      moveInDate,
      occupants,
      intent,
      msg,
      sourceUrl: req.headers.get("referer") ?? null,
    });
    return NextResponse.json({ ref: result.ref });
  } catch {
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }
}
