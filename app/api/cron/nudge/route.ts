import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type StaleRow = {
  dealer_id: number;
  dealer_phone: string;
  dealer_name: string;
  stale_count: number;
};

async function sendNudgeWhatsApp(
  dealerPhone: string,
  dealerName: string,
  staleCount: number,
  appUrl: string
): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const from = process.env.MSG91_WHATSAPP_NUMBER;
  const template = process.env.MSG91_NUDGE_TEMPLATE_ID;
  if (!authKey || !from || !template) return false;

  const availUrl = `${appUrl}/dealer/availability`;

  try {
    const res = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          integrated_number: from,
          content_type: "template",
          payload: {
            to: "91" + dealerPhone,
            type: "template",
            template: {
              name: template,
              language: { code: "en" },
              components: [
                {
                  type: "body",
                  parameters: [
                    { type: "text", text: dealerName },
                    { type: "text", text: String(staleCount) },
                    { type: "text", text: availUrl },
                  ],
                },
              ],
            },
          },
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = serviceDb();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://prop100.in").replace(/\/$/, "");
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

  // Find dealers who have at least one stale unit (not confirmed in 15+ days)
  const { data: staleUnits, error } = await db
    .from("property_units")
    .select(`
      id,
      properties!inner(
        dealer_id,
        is_approved,
        dealers!dealer_id(id, name, phone, whatsapp_number)
      )
    `)
    .eq("properties.is_approved", true)
    .or(`last_confirmed_at.is.null,last_confirmed_at.lt.${cutoff}`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by dealer, count stale units per dealer
  const dealerMap = new Map<number, StaleRow>();
  for (const unit of staleUnits ?? []) {
    const prop = (unit as unknown as { properties: { dealer_id: number; is_approved: boolean; dealers: { id: number; name: string; phone: string; whatsapp_number: string | null } | null } | null }).properties;
    if (!prop?.dealers) continue;
    const { dealer_id, dealers } = prop;
    const phone = dealers.whatsapp_number ?? dealers.phone;
    if (!phone) continue;
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) continue;

    const existing = dealerMap.get(dealer_id);
    if (existing) {
      existing.stale_count += 1;
    } else {
      dealerMap.set(dealer_id, {
        dealer_id,
        dealer_phone: cleanPhone,
        dealer_name: dealers.name ?? "Dealer",
        stale_count: 1,
      });
    }
  }

  // Send one WhatsApp per dealer
  let sent = 0;
  let failed = 0;
  for (const row of dealerMap.values()) {
    const ok = await sendNudgeWhatsApp(row.dealer_phone, row.dealer_name, row.stale_count, appUrl);
    if (ok) sent++; else failed++;
  }

  return NextResponse.json({
    ok: true,
    dealers_nudged: sent,
    failed,
    total_stale_units: staleUnits?.length ?? 0,
  });
}
