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

export async function GET(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? "pending";
  const db = serviceDb();

  let query = db
    .from("properties")
    .select(
      "id,title,type,ptype,loc,price,rent_per_month,deposit_amount," +
      "is_approved,is_featured,slug,img,videos,gallery,features," +
      "description,created_at,dealer_id,dealers(name,phone,is_active,role)"
    )
    .order("created_at", { ascending: false });

  if (filter === "pending") query = query.eq("is_approved", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id: number; action: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = serviceDb();

  if (action === "approve") {
    const { error } = await db
      .from("properties")
      .update({ is_approved: true })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // reject = hard delete (property was not approved, safe to remove)
  const { error } = await db.from("properties").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
