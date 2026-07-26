import { NextRequest, NextResponse } from "next/server";
import { assertAdminFromRequest } from "@/lib/assertAdmin";
import { createClient } from "@supabase/supabase-js";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function makeSlug(ptype: string, bhk: number, loc: string): string {
  const bhkPart = bhk > 0 ? `${bhk}bhk-` : "";
  const base = slugify(`${bhkPart}${ptype}-${loc}-kota`).slice(0, 55);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

// Admin cold-call upload: an owner has been called, has verbally agreed to be
// listed, and handed over details + photos/videos over WhatsApp. There is no
// dealer session here — an admin is entering the data on the owner's behalf,
// so this always requires an `owner` contact (unlike the dealer route, where
// it's optional and falls back to the logged-in dealer). Same find-or-create-
// by-phone dealer pattern as /api/dealer/property and /api/public/post-property
// — can_login is left at its schema default (true), so the owner can register
// via OTP with this same number later and it transparently becomes their
// account with this listing already attached. No separate "claim" step needed.
export async function POST(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    type, ptype, loc, bhk, baths, price,
    rent_per_month, deposit_amount, sqft,
    furnishing_status, meals_included, gender_preference,
    available_from, min_stay_months, floor_number, total_floors,
    attached_bathroom, parking_available, wifi_included,
    nearest_coaching_hub, features, description,
    photoPaths, videoPaths, units, hostel_meta,
    lat, lng, owner, tenant_preference, is_verified,
  } = body as Record<string, unknown>;

  if (!type || !ptype || !loc) {
    return NextResponse.json({ error: "type, ptype, loc are required" }, { status: 400 });
  }
  if (!Number(price) && Number(price) !== 0) {
    return NextResponse.json({ error: "price is required" }, { status: 400 });
  }

  const ownerObj = owner && typeof owner === "object" ? (owner as Record<string, unknown>) : null;
  if (!ownerObj) {
    return NextResponse.json({ error: "Owner contact is required for admin-uploaded listings" }, { status: 400 });
  }
  const ownerPhone = String(ownerObj.phone ?? "").replace(/\D/g, "");
  const ownerName = String(ownerObj.name ?? "").trim();
  const ownerWhatsapp = Boolean(ownerObj.whatsapp);
  if (ownerPhone.length !== 10) {
    return NextResponse.json({ error: "Owner phone must be 10 digits" }, { status: 400 });
  }
  if (ownerName.length < 2) {
    return NextResponse.json({ error: "Owner name is required" }, { status: 400 });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const { data: existingDealer } = await db
    .from("dealers")
    .select("id")
    .or(`phone.eq.${ownerPhone},phone.eq.91${ownerPhone}`)
    .maybeSingle();

  let listingDealerId: number;
  if (existingDealer) {
    listingDealerId = existingDealer.id;
  } else {
    // Timestamp + random suffix for a unique bigint id (same scheme as the
    // public post-property and dealer routes). is_active=false keeps the
    // owner out of public dealer listings until they're a real partner.
    const newId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const { error: dealerErr } = await db.from("dealers").insert({
      id: newId,
      name: ownerName,
      role: "owner",
      phone: ownerPhone,
      whatsapp_number: ownerWhatsapp ? ownerPhone : null,
      areas_covered: [],
      years: 0,
      rating: 0,
      is_active: false,
    });
    if (dealerErr) {
      return NextResponse.json({ error: dealerErr.message }, { status: 500 });
    }
    listingDealerId = newId;
  }

  const bhkNum = Number(bhk) || 0;
  const hostelMetaObj = hostel_meta && typeof hostel_meta === "object"
    ? (hostel_meta as Record<string, unknown>)
    : null;
  const pgName = hostelMetaObj?.pg_name ? String(hostelMetaObj.pg_name).trim() : "";
  const baseTitle = `${bhkNum > 0 ? bhkNum + " BHK " : ""}${ptype} in ${loc}`;
  const title = pgName ? `${pgName} | ${baseTitle}` : baseTitle;
  const slug = makeSlug(String(ptype), bhkNum, String(loc));

  const photoArr = Array.isArray(photoPaths) ? (photoPaths as string[]) : [];
  const videoArr = Array.isArray(videoPaths) ? (videoPaths as string[]) : [];

  const VALID_FURNISHING = ["furnished", "semi-furnished", "unfurnished"];
  const VALID_GENDER = ["boys", "girls", "any"];
  const VALID_HUB = ["Allen", "Resonance", "FIITJEE", "Vibrant", "Motion", "Other"];

  const furnishVal = VALID_FURNISHING.includes(String(furnishing_status))
    ? String(furnishing_status)
    : null;
  const genderVal = VALID_GENDER.includes(String(gender_preference))
    ? String(gender_preference)
    : null;
  const hubVal = VALID_HUB.includes(String(nearest_coaching_hub))
    ? String(nearest_coaching_hub)
    : null;

  const insertRow: Record<string, unknown> = {
    type: String(type),
    ptype: String(ptype),
    loc: String(loc),
    bhk: bhkNum,
    baths: Number(baths) || 0,
    title,
    slug,
    price: Number(price) || 0,
    rent_per_month: rent_per_month ? Number(rent_per_month) : null,
    deposit_amount: deposit_amount ? Number(deposit_amount) : null,
    sqft: sqft ? Number(sqft) : null,
    furnish: furnishVal,
    furnishing_status: furnishVal,
    meals_included: Boolean(meals_included),
    gender_preference: genderVal,
    available_from: available_from ? String(available_from) : null,
    min_stay_months: min_stay_months ? Number(min_stay_months) : null,
    floor_number: floor_number ? Number(floor_number) : null,
    total_floors: total_floors ? Number(total_floors) : null,
    attached_bathroom: Boolean(attached_bathroom),
    parking_available: Boolean(parking_available),
    wifi_included: Boolean(wifi_included),
    nearest_coaching_hub: hubVal,
    features: Array.isArray(features) ? features : [],
    tenant_preference: Array.isArray(tenant_preference) ? tenant_preference : [],
    description: description ? String(description) : "",
    img: photoArr[0] ?? videoArr[0] ?? null,
    gallery: photoArr,
    videos: videoArr,
    dealer_id: listingDealerId,
    // Admin has already vetted this owner on the call — publish immediately,
    // unlike the dealer/public routes which default to pending review.
    is_approved: true,
    listing_status: "live",
    is_featured: false,
    is_verified: Boolean(is_verified),
    verified: Boolean(is_verified),
    photos: photoArr.length,
    posted_days: 0,
    property_status: "available",
  };

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum) &&
      Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180 &&
      (latNum !== 0 || lngNum !== 0)) {
    insertRow.lat = latNum;
    insertRow.lng = lngNum;
  }

  if (hostel_meta && typeof hostel_meta === "object") {
    insertRow.hostel_meta = hostel_meta;
  }

  const { data, error } = await db
    .from("properties")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unitRows = Array.isArray(units) ? units : [];
  if (unitRows.length > 0) {
    type UnitInput = {
      label?: unknown; capacity?: unknown; price_per_month?: unknown;
      deposit_amount?: unknown; total_count?: unknown; available_count?: unknown;
      has_ac?: unknown; has_cooler?: unknown; attached_bath?: unknown;
      meals_included?: unknown; description?: unknown; sort_order?: unknown;
      attributes?: unknown;
    };
    const toInsert = (unitRows as UnitInput[])
      .filter((u) => u.label && Number(u.price_per_month) > 0)
      .map((u, i) => ({
        property_id: data.id,
        label: String(u.label),
        capacity: Number(u.capacity) || 1,
        price_per_month: Number(u.price_per_month),
        deposit_amount: u.deposit_amount ? Number(u.deposit_amount) : null,
        total_count: Number(u.total_count) || 1,
        available_count: Math.min(Number(u.available_count) || 1, Number(u.total_count) || 1),
        has_ac: Boolean(u.has_ac),
        has_cooler: Boolean(u.has_cooler),
        attached_bath: Boolean(u.attached_bath),
        meals_included: Boolean(u.meals_included),
        description: u.description ? String(u.description) : null,
        sort_order: Number(u.sort_order ?? i),
        attributes: u.attributes && typeof u.attributes === "object" ? u.attributes : null,
      }));
    if (toInsert.length > 0) {
      await db.from("property_units").insert(toInsert);
    }
  }

  return NextResponse.json({ id: data.id, slug });
}
