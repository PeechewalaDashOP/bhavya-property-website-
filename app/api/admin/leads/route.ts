import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdminFromRequest } from "@/lib/assertAdmin";

const VALID_STATUSES = ["new", "contacted", "closed", "dead"] as const;

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  if (!await assertAdminFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await serviceDb()
    .from("leads")
    .select(`
      id, reference_code, customer_name, customer_phone,
      status, move_in_date, occupants, msg, intent,
      created_at, contacted_at, closed_at,
      properties(title, loc),
      dealers(name)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  if (!await assertAdminFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = Number(body.id);
  const status = String(body.status ?? "");
  if (!id || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status };
  if (status === "contacted") update.contacted_at = now;
  if (status === "closed") { update.contacted_at = now; update.closed_at = now; }

  const { error } = await serviceDb().from("leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
