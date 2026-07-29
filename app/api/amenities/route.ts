import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public, read-only. Powers the Sale wizard's dynamic amenity chips (Step 2)
// — the amenities system is global/reusable (see docs/sale-architecture.md
// §8), not Sale-specific, so this route takes no purpose/module param, only
// the property type to filter by.
export async function GET(req: NextRequest) {
  const ptype = req.nextUrl.searchParams.get("ptype");
  if (!ptype) return NextResponse.json({ error: "Missing ptype" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json([]);

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from("amenities")
    .select("id, key, label, icon, category")
    .eq("is_active", true)
    .contains("applicable_property_types", [ptype])
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
