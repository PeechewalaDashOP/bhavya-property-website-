import { NextRequest, NextResponse } from "next/server";
import { getDealerSession } from "@/lib/dealerSession";
import { createClient } from "@supabase/supabase-js";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Fields an owner may edit themselves. Never includes dealer_id, is_approved,
// listing_status, slug, id, type/ptype/loc (identity of the listing) — those
// are either fixed at creation or only change via the pause/resume/admin
// actions below.
const EDITABLE_FIELDS = [
  "price", "rent_per_month", "deposit_amount", "sqft", "furnishing_status",
  "meals_included", "gender_preference", "available_from", "min_stay_months",
  "floor_number", "total_floors", "attached_bathroom", "parking_available",
  "wifi_included", "nearest_coaching_hub", "features", "description",
  "img", "gallery", "videos", "photos", "hostel_meta",
] as const;

// Deliberately smaller than EDITABLE_FIELDS and allowed on a wider set of
// statuses — a live listing shouldn't be reopened for full editing (photos,
// description, amenities) without re-review, but a price correction on an
// already-approved listing is common and low-risk enough to allow directly.
const PRICE_FIELDS = ["price", "rent_per_month", "deposit_amount"] as const;
const PRICE_EDIT_STATUSES = ["pending", "live", "paused_owner"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getDealerSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = serviceDb();
  const { data, error } = await db
    .from("properties")
    .select("*, property_units(*)")
    .eq("id", id)
    .eq("dealer_id", s.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getDealerSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  let body: { action?: unknown; fields?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const db = serviceDb();

  const { data: prop, error: fetchErr } = await db
    .from("properties")
    .select("id,dealer_id,listing_status")
    .eq("id", id)
    .eq("dealer_id", s.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "edit") {
    if (prop.listing_status !== "pending") {
      return NextResponse.json(
        { error: "This listing can only be edited while it's under review." },
        { status: 403 }
      );
    }
    const fields = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (key in fields) update[key] = fields[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const { error } = await db.from("properties").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "edit_price") {
    if (!PRICE_EDIT_STATUSES.includes(prop.listing_status)) {
      return NextResponse.json(
        { error: "Price can't be edited on a rejected or admin-paused listing. Contact Bhavya." },
        { status: 403 }
      );
    }
    const fields = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    for (const key of PRICE_FIELDS) {
      if (key in fields) update[key] = fields[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const { error } = await db.from("properties").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "pause") {
    if (prop.listing_status !== "live") {
      return NextResponse.json({ error: "Only a live listing can be paused" }, { status: 403 });
    }
    const { error } = await db
      .from("properties")
      .update({ is_approved: false, listing_status: "paused_owner" })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "resume") {
    if (prop.listing_status !== "paused_owner") {
      return NextResponse.json(
        { error: "Only a listing you paused yourself can be resumed here. Contact Bhavya if admin paused it." },
        { status: 403 }
      );
    }
    const { error } = await db
      .from("properties")
      .update({ is_approved: true, listing_status: "live" })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getDealerSession(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const db = serviceDb();
  const { data: prop, error: fetchErr } = await db
    .from("properties")
    .select("id,dealer_id,listing_status")
    .eq("id", id)
    .eq("dealer_id", s.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!prop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["pending", "rejected", "paused_owner"].includes(prop.listing_status)) {
    return NextResponse.json(
      { error: "Pause this listing first before removing it, or contact Bhavya if admin paused it." },
      { status: 403 }
    );
  }

  const { error } = await db.from("properties").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
