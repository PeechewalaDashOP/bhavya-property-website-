import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdminFromRequest } from "@/lib/assertAdmin";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/* The ops queue list. Phase 1 (AI automation off) means every enquiry
   with an inbound message lands in 'awaiting_human' — this endpoint is
   the primary work surface for the team, not a fallback for AI misses. */
export async function GET(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");

  let query = serviceDb()
    .from("concierge_enquiries")
    .select(
      `id, reference_code, status, intent, category, objective_key, slot_state,
       assigned_to, business_hours, created_at, updated_at, first_ai_at, first_human_at, qualified_at,
       students(id, name, phone),
       properties(id, title, loc, slug)`
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
