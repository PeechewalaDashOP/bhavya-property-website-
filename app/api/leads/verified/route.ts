/* Verified-device lead path — the frictionless flow for customers who have
   already OTP-verified on this browser (30-day p100_pv cookie).

   GET  → { verified, phone?, name? }  — prefill check, HMAC-verify only.
   POST → same body/response contract as /api/otp/verify minus the token.
          401 { error: "OTP_REQUIRED" } tells the client to fall back to the
          normal OTP flow. */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createLead } from "@/lib/leadService";
import { verifyPhoneToken, PHONE_VERIFY_COOKIE } from "@/lib/phoneVerifySession";

// Bounds the blast radius of a stolen cookie: at most this many leads per
// verified phone per 24h before we demand a fresh OTP. Generous for a real
// student comparing hostels; hostile for a scraper (each lead can cost an
// owner money once billing is on).
const MAX_LEADS_PER_PHONE_PER_DAY = 10;

export async function GET(req: NextRequest) {
  const token = req.cookies.get(PHONE_VERIFY_COOKIE)?.value;
  const payload = token ? verifyPhoneToken(token) : null;
  if (!payload) return NextResponse.json({ verified: false });
  // Returning the phone to the cookie holder is returning their own data,
  // over HTTPS, gated by the signed httpOnly cookie. Nothing persists
  // client-side.
  return NextResponse.json({ verified: true, phone: payload.ph, name: payload.name });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const name = String(body.name ?? "").trim();
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const token = req.cookies.get(PHONE_VERIFY_COOKIE)?.value;
  const payload = token ? verifyPhoneToken(token) : null;
  // No cookie, expired cookie, or a different phone typed than the one this
  // device verified → OTP required (verifying the new phone replaces the
  // cookie).
  if (!payload || payload.ph !== phone) {
    return NextResponse.json({ error: "OTP_REQUIRED" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }
  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { count } = await db
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone", phone)
    .gt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
  if ((count ?? 0) >= MAX_LEADS_PER_PHONE_PER_DAY) {
    return NextResponse.json({ error: "OTP_REQUIRED" }, { status: 401 });
  }

  try {
    const result = await createLead(db, {
      name,
      phone,
      propId: body.propId ? Number(body.propId) : null,
      dealerId: body.dealerId ? Number(body.dealerId) : null,
      unitId: body.unitId ? Number(body.unitId) : null,
      unitLabel: body.unitLabel ? String(body.unitLabel).trim() : null,
      moveInDate: body.moveInDate ? String(body.moveInDate) : null,
      occupants: body.occupants ? Number(body.occupants) : null,
      intent: String(body.intent ?? "").trim() || null,
      msg: String(body.msg ?? "").trim() || null,
      sourceUrl: req.headers.get("referer") ?? null,
    });
    return NextResponse.json({
      ref: result.ref,
      dealerPhone: result.dealerPhone,
      billing: result.billing,
    });
  } catch {
    return NextResponse.json({ error: "Failed to save. Please try again." }, { status: 500 });
  }
}
