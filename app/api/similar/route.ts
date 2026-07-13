import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SimilarProperty = {
  id: number;
  slug: string;
  title: string;
  ptype: string;
  loc: string;
  img: string | null;
  rent_per_month: number | null;
  price: number;
  type: string;
  available_from: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const ptype = searchParams.get("ptype") ?? "";
  const loc = searchParams.get("loc") ?? "";
  const exclude = searchParams.get("exclude") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 12);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json([]);

  const db = createClient(url, key, { auth: { persistSession: false } });

  // First try same ptype + same loc
  const { data: narrow } = await db
    .from("properties")
    .select("id, slug, title, ptype, loc, img, rent_per_month, price, type, available_from")
    .eq("is_approved", true)
    .eq("ptype", ptype)
    .eq("loc", loc)
    .neq("slug", exclude)
    .limit(limit);

  let results: SimilarProperty[] = narrow ?? [];

  // If fewer than 3 results from same area, broaden to same ptype regardless of area
  if (results.length < 3) {
    const { data: broader } = await db
      .from("properties")
      .select("id, slug, title, ptype, loc, img, rent_per_month, price, type, available_from")
      .eq("is_approved", true)
      .eq("ptype", ptype)
      .neq("slug", exclude)
      .limit(limit);
    results = broader ?? [];
  }

  return NextResponse.json(results);
}
