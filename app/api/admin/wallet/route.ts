import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdminFromRequest } from "@/lib/assertAdmin";
import { releasePendingLeads } from "@/lib/leadService";

const VALID_CREDIT_TYPES = ["topup", "refund", "bonus", "admin_adjust"] as const;

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/* GET             → all dealers with wallet state + pending counts + shadow value
   GET ?dealerId=N → that dealer's last 50 ledger transactions */
export async function GET(req: NextRequest) {
  if (!await assertAdminFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = serviceDb();
  const dealerId = req.nextUrl.searchParams.get("dealerId");

  if (dealerId) {
    const { data, error } = await db
      .from("wallet_transactions")
      .select("id, amount_paise, type, lead_id, note, balance_after_paise, created_at")
      .eq("dealer_id", Number(dealerId))
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const [{ data: dealers, error: dealersErr }, { data: leadAgg }] = await Promise.all([
    db
      .from("dealers")
      .select("id, name, phone, is_active, wallet_balance_paise, free_leads_remaining")
      .order("name"),
    // one query for both pending counts and shadow value, grouped client-side
    db
      .from("leads")
      .select("dealer_id, billing_status, charge_paise")
      .not("dealer_id", "is", null),
  ]);
  if (dealersErr) return NextResponse.json({ error: dealersErr.message }, { status: 500 });

  const pending = new Map<number, number>();
  const shadow = new Map<number, number>();
  for (const l of leadAgg ?? []) {
    if (!l.dealer_id) continue;
    if (l.billing_status === "pending_balance") {
      pending.set(l.dealer_id, (pending.get(l.dealer_id) ?? 0) + 1);
    }
    if (l.billing_status === "waived" && l.charge_paise) {
      shadow.set(l.dealer_id, (shadow.get(l.dealer_id) ?? 0) + Number(l.charge_paise));
    }
  }

  return NextResponse.json(
    (dealers ?? []).map((d) => ({
      ...d,
      pending_count: pending.get(d.id) ?? 0,
      waived_value_paise: shadow.get(d.id) ?? 0,
    }))
  );
}

/* POST { dealerId, amountPaise, type, note } → credit wallet, then release
   pending leads FIFO (this is where a customer who was told "owner will
   contact you soon" finally gets the owner's number over WhatsApp). */
export async function POST(req: NextRequest) {
  if (!await assertAdminFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const dealerId = Number(body.dealerId);
  const amountPaise = Number(body.amountPaise);
  const type = String(body.type ?? "topup");
  const note = body.note ? String(body.note).slice(0, 200) : null;

  if (!dealerId || !Number.isInteger(amountPaise) || amountPaise <= 0) {
    return NextResponse.json({ error: "Invalid dealerId or amount" }, { status: 400 });
  }
  if (!VALID_CREDIT_TYPES.includes(type as typeof VALID_CREDIT_TYPES[number])) {
    return NextResponse.json({ error: "Invalid credit type" }, { status: 400 });
  }

  const db = serviceDb();
  const { data: newBalance, error } = await db.rpc("credit_wallet", {
    p_dealer_id: dealerId,
    p_amount_paise: amountPaise,
    p_type: type,
    p_note: note,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const release = await releasePendingLeads(db, dealerId);

  return NextResponse.json({
    newBalancePaise: Number(newBalance),
    released: release.released,
    expired: release.expired,
  });
}
