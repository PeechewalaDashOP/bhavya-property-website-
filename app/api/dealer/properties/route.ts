import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyDealerToken } from "@/lib/dealerSession";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const payload = token ? verifyDealerToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceDb();
  const { data, error } = await db
    .from("properties")
    .select(
      `id, title, ptype, loc, slug, is_approved, listing_status, type, img, price, rent_per_month, deposit_amount, created_at,
      property_units(id, label, capacity, price_per_month, total_count, available_count, attributes, last_confirmed_at, sort_order)`
    )
    .eq("dealer_id", payload.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sorted = (data ?? []).map((p) => ({
    ...p,
    property_units: Array.isArray(p.property_units)
      ? [...p.property_units].sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        )
      : [],
  }));

  return NextResponse.json(sorted);
}
