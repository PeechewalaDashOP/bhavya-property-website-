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
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const session = verifyDealerToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceDb();

  const [{ data: dealer, error: dealerErr }, { data: txns }, { count: pendingCount }] =
    await Promise.all([
      db
        .from("dealers")
        .select("wallet_balance_paise, free_leads_remaining")
        .eq("id", session.id)
        .maybeSingle(),
      db
        .from("wallet_transactions")
        .select("id, amount_paise, type, note, balance_after_paise, created_at")
        .eq("dealer_id", session.id)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("dealer_id", session.id)
        .eq("billing_status", "pending_balance"),
    ]);

  // Pre-migration deploy window (wallet columns/table not created yet):
  // degrade to an empty wallet instead of erroring — the page stays usable.
  return NextResponse.json({
    balancePaise: !dealerErr && dealer ? dealer.wallet_balance_paise ?? 0 : 0,
    freeLeadsRemaining: !dealerErr && dealer ? dealer.free_leads_remaining ?? 0 : 0,
    pendingCount: pendingCount ?? 0,
    transactions: txns ?? [],
  });
}
