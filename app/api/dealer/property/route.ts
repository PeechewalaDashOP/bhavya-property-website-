import { NextRequest, NextResponse } from "next/server";
import { verifyDealerToken } from "@/lib/dealerSession";
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

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7) ?? "";
  const session = verifyDealerToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    lat, lng, owner,
  } = body as Record<string, unknown>;

  if (!type || !ptype || !loc) {
    return NextResponse.json({ error: "type, ptype, loc are required" }, { status: 400 });
  }
  if (!Number(price) && Number(price) !== 0) {
    return NextResponse.json({ error: "price is required" }, { status: 400 });
  }
  if (!Array.isArray(videoPaths) || (videoPaths as string[]).length === 0) {
    return NextResponse.json({ error: "At least 1 video is required" }, { status: 400 });
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  // Owner routing: when the submitter passes an owner contact (field collection —
  // the logged-in account is the collector, not the owner), attach the listing to
  // a dealer row for that phone so leads reach the owner. Same find-or-create
  // pattern as /api/public/post-property.
  let listingDealerId = session.id;
  const ownerObj = owner && typeof owner === "object" ? (owner as Record<string, unknown>) : null;
  if (ownerObj) {
    const ownerPhone = String(ownerObj.phone ?? "").replace(/\D/g, "");
    const ownerName = String(ownerObj.name ?? "").trim();
    const ownerWhatsapp = Boolean(ownerObj.whatsapp);
    if (ownerPhone.length !== 10) {
      return NextResponse.json({ error: "Owner phone must be 10 digits" }, { status: 400 });
    }
    if (ownerName.length < 2) {
      return NextResponse.json({ error: "Owner name is required" }, { status: 400 });
    }
    const { data: existingDealer } = await db
      .from("dealers")
      .select("id")
      .or(`phone.eq.${ownerPhone},phone.eq.91${ownerPhone}`)
      .maybeSingle();
    if (existingDealer) {
      listingDealerId = existingDealer.id;
    } else {
      // Timestamp + random suffix for a unique bigint id (same scheme as the
      // public post-property route). is_active=false keeps the owner out of
      // public dealer listings while the FK stays valid.
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
  const videoArr = videoPaths as string[];

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
    description: description ? String(description) : "",
    img: photoArr[0] ?? videoArr[0] ?? null,
    gallery: photoArr,
    videos: videoArr,
    dealer_id: listingDealerId,
    is_approved: false,
    is_featured: false,
    is_verified: false,
    verified: false,
    photos: photoArr.length,
    posted_days: 0,
    property_status: "available",
  };
  // listing_status is intentionally omitted — it defaults to 'pending' at the
  // DB level (supabase/migration_listing_lifecycle.sql). Referencing it here
  // unconditionally would break every submission until that migration runs,
  // same reasoning as the hostel_meta column above.

  // GPS coordinates — only set when captured (one-tap in the wizard). Omitting
  // the keys keeps older callers that don't send them working unchanged.
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum) &&
      Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180 &&
      (latNum !== 0 || lngNum !== 0)) {
    insertRow.lat = latNum;
    insertRow.lng = lngNum;
  }

  // Only reference hostel_meta when the caller actually sends it (PG/Hostel flow).
  // Omitting the key entirely — rather than sending null — means standard
  // rent/sale submissions keep working even before the hostel_meta migration
  // (supabase/migration_hostel_meta.sql) has been run on this Supabase project.
  if (hostel_meta && typeof hostel_meta === "object") {
    insertRow.hostel_meta = hostel_meta;
  }

  const { data, error } = await db
    .from("properties")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert property units if provided
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

  // Best-effort: clear the dealer's in-progress draft now that it's submitted.
  // Wrapped so a missing property_drafts table (pre-migration) can't fail
  // an otherwise-successful submission.
  try {
    await db.from("property_drafts").delete().eq("dealer_id", session.id);
  } catch {
    // ignore — draft cleanup is not critical to the submission succeeding
  }

  return NextResponse.json({ id: data.id });
}
