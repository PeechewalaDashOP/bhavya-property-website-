import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_COMMENT_LEN = 1000;

// Anyone can review — no OTP/login gate (explicit product decision, unlike
// every other write path in this app). Goes live immediately; admin can
// delete via DELETE /api/admin/reviews. All writes still go through this
// server route rather than direct client inserts (CLAUDE.md: never write to
// the DB directly from client components), same as every other table here.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const propertyId = Number(body.property_id);
  const reviewerName = String(body.reviewer_name ?? "").trim();
  const rating = Number(body.rating);
  const comment = body.comment ? String(body.comment).trim().slice(0, MAX_COMMENT_LEN) : null;

  if (!propertyId) return NextResponse.json({ error: "Missing property" }, { status: 400 });
  if (reviewerName.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1 to 5" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    // Sample-data/demo mode — keep the form functional without a real DB.
    return NextResponse.json({ ok: true, demo: true });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data: prop } = await db.from("properties").select("dealer_id").eq("id", propertyId).maybeSingle();
  if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { data, error } = await db
    .from("reviews")
    .insert({
      property_id: propertyId,
      dealer_id: prop.dealer_id ?? null,
      reviewer_name: reviewerName.slice(0, 80),
      rating,
      comment,
    })
    .select("id,reviewer_name,rating,comment,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, review: data });
}

export async function GET(req: NextRequest) {
  const propertyId = Number(req.nextUrl.searchParams.get("property_id"));
  if (!propertyId) return NextResponse.json({ error: "Missing property_id" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return NextResponse.json({ reviews: [], average: 0, count: 0 });

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data, error } = await db
    .from("reviews")
    .select("id,reviewer_name,rating,comment,created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const reviews = data ?? [];
  const average = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  return NextResponse.json({ reviews, average, count: reviews.length });
}
