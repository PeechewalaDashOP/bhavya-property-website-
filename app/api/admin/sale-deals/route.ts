import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdminFromRequest } from "@/lib/assertAdmin";
import { commissionPaise, BUYER_COMMISSION_BPS, SELLER_COMMISSION_BPS } from "@/lib/commission";

const VALID_STATUSES = ["interested", "negotiating", "closed", "invoiced", "collected", "dead"] as const;
type Status = (typeof VALID_STATUSES)[number];

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/* GET → all sale deals, newest first, joined to property/dealer labels. */
export async function GET(req: NextRequest) {
  if (!await assertAdminFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = serviceDb();
  const { data, error } = await db
    .from("sale_deals")
    .select("*, properties(title, loc), dealers(name)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/* POST { dealId, status, agreedPricePaise?, note? } → admin-verified status
   transition. This is the ONLY way a sale deal moves — no dealer magic link,
   unlike rent, given the money/stakes in a real-estate closing.
   On status='closed': agreedPricePaise is required; buyer/seller commission
   is computed here from lib/commission.ts's bps constants and stored. */
export async function POST(req: NextRequest) {
  if (!await assertAdminFromRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const dealId = Number(body.dealId);
  const status = String(body.status ?? "") as Status;
  const note = body.note ? String(body.note).slice(0, 2000) : undefined;

  if (!dealId) return NextResponse.json({ error: "Invalid dealId" }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = serviceDb();
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (note !== undefined) update.admin_notes = note;

  if (status === "closed") {
    const agreedPricePaise = Number(body.agreedPricePaise);
    if (!Number.isInteger(agreedPricePaise) || agreedPricePaise <= 0) {
      return NextResponse.json({ error: "agreedPricePaise is required to close a deal" }, { status: 400 });
    }
    update.agreed_price_paise = agreedPricePaise;
    update.buyer_commission_paise = commissionPaise(agreedPricePaise, BUYER_COMMISSION_BPS);
    update.seller_commission_paise = commissionPaise(agreedPricePaise, SELLER_COMMISSION_BPS);
    update.closed_at = new Date().toISOString();
  } else if (status === "invoiced") {
    update.invoiced_at = new Date().toISOString();
  } else if (status === "collected") {
    update.collected_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from("sale_deals")
    .update(update)
    .eq("id", dealId)
    .select("*, properties(title, loc), dealers(name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
