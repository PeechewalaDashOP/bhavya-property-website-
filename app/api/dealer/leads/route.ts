import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDealerSession } from "@/lib/dealerSession";

const VALID_STATUSES = ["new", "contacted", "closed", "dead"] as const;

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const session = await getDealerSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceDb();

  const [{ data: leads }, { data: dealer }] = await Promise.all([
    db
      .from("leads")
      .select(`
        id, reference_code, customer_name, customer_phone,
        status, move_in_date, occupants, msg,
        created_at, contacted_at,
        properties(title, loc, price)
      `)
      .eq("dealer_id", session.id)
      .order("created_at", { ascending: false }),
    db
      .from("dealers")
      .select("name")
      .eq("id", session.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    leads: leads ?? [],
    dealerName: (dealer as { name: string } | null)?.name ?? session.name,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getDealerSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = Number(body.id);
  const status = String(body.status ?? "");
  if (!id || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json({ error: "Invalid id or status" }, { status: 400 });
  }

  const db = serviceDb();

  // Confirm the lead belongs to this dealer before updating
  const { data: lead } = await db
    .from("leads")
    .select("id, dealer_id")
    .eq("id", id)
    .maybeSingle();

  if (!lead || lead.dealer_id !== session.id) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status };
  if (status === "contacted") update.contacted_at = now;
  if (status === "closed") { update.contacted_at = now; update.closed_at = now; }

  const { error } = await db.from("leads").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
