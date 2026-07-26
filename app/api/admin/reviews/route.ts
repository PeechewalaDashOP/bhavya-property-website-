import { NextRequest, NextResponse } from "next/server";
import { assertAdminFromRequest } from "@/lib/assertAdmin";
import { createClient } from "@supabase/supabase-js";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Reviews have no moderation queue (they go live the instant they're
// submitted — explicit product decision) but admin can delete any of them
// after the fact. This route backs that "delete" power from the properties
// admin panel's expanded detail view.
export async function GET(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const propertyId = Number(req.nextUrl.searchParams.get("property_id"));
  if (!propertyId) return NextResponse.json({ error: "Missing property_id" }, { status: 400 });

  const db = serviceDb();
  const { data, error } = await db
    .from("reviews")
    .select("id,reviewer_name,rating,comment,created_at")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await serviceDb().from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
