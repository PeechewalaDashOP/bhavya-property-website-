/* Central lead creation — the ONE code path for every lead, used by
   /api/otp/verify (OTP flow), /api/leads/verified (verified-device flow) and
   /api/leads (general enquiries). Owns: server-side dealer resolution, dedup,
   billing, and WhatsApp notifications. Keeping these in one place is what
   guarantees an owner can never be double-charged and a customer can never
   see a number the wallet didn't pay for. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWhatsAppTemplate } from "./msg91";
import { BILLING_ENABLED, LEAD_PRICE_PAISE } from "./billing";

export type CreateLeadInput = {
  name: string;
  phone: string; // already validated 10-digit
  propId: number | null;
  dealerId: number | null;
  unitId?: number | null;
  unitLabel?: string | null;
  moveInDate?: string | null;
  occupants?: number | null;
  intent?: string | null;
  msg?: string | null;
  sourceUrl: string | null;
  consentedToCommission?: boolean | null; // sale listings only — buyer commission disclosure
};

export type CreateLeadResult = {
  ref: string;
  dealerPhone: string | null; // null when billing outcome is "pending"
  dedup: boolean;             // true = existing lead returned, nothing inserted
  billing: "revealed" | "pending";
  consentRequired?: boolean;  // true when "pending" is specifically for missing sale consent
};

const DEDUP_DAYS = 30;
const GENERAL_DEDUP_HOURS = 24;
const PENDING_EXPIRY_DAYS = 7;

function makeRef(): string {
  return "P100-" + Math.floor(1000 + Math.random() * 9000);
}

function maskPhone(phone: string): string {
  return phone.slice(0, 4) + "XXXXXX";
}

type DealerContact = { phone: string | null; whatsapp: string | null; name: string | null };

async function getDealerContact(db: SupabaseClient, dealerId: number): Promise<DealerContact> {
  const { data } = await db
    .from("dealers")
    .select("phone, whatsapp_number, name")
    .eq("id", dealerId)
    .maybeSingle();
  return {
    phone: data?.phone ?? null,
    whatsapp: data?.whatsapp_number ?? data?.phone ?? null,
    name: data?.name ?? null,
  };
}

/* Dealer new-lead WhatsApp alert. Fail-silent by design: the lead is already
   saved; a notify failure must never break the customer flow. Template
   (MSG91_WHATSAPP_TEMPLATE_ID, Utility): 6 body vars + 2 magic-link URL
   buttons. */
async function sendDealerLeadAlert(opts: {
  dealerWhatsapp: string;
  propLabel: string;
  customerName: string;
  customerPhone: string;
  moveInDate: string | null;
  occupants: number | null;
  ref: string;
  magicToken: string | null;
}) {
  const template = process.env.MSG91_WHATSAPP_TEMPLATE_ID;
  if (!template || !opts.magicToken) return;
  const clean = opts.dealerWhatsapp.replace(/\D/g, "").slice(-10);
  if (clean.length !== 10) return;
  const res = await sendWhatsAppTemplate({
    to: "91" + clean,
    templateName: template,
    components: {
      body_1: { type: "text", value: opts.propLabel },
      body_2: { type: "text", value: opts.customerName },
      body_3: { type: "text", value: maskPhone(opts.customerPhone) },
      body_4: { type: "text", value: opts.moveInDate || "Not specified" },
      body_5: { type: "text", value: String(opts.occupants ?? 1) },
      body_6: { type: "text", value: opts.ref },
      button_1: { subtype: "url", type: "text", value: `${opts.magicToken}/contacted` },
      button_2: { subtype: "url", type: "text", value: `${opts.magicToken}/closed` },
    },
  });
  if (!res.ok) console.error(`[leadService] dealer alert failed: ${res.detail}`);
}

/* Owner low-balance alert (billing on, wallet empty). Customer phone is
   MASKED — the owner must top up to get it; sending it here would let them
   bypass the charge entirely. Template (MSG91_LOW_BALANCE_TEMPLATE_ID,
   Utility): name, pending count, URL button to the wallet page. */
async function sendLowBalanceAlert(opts: {
  dealerWhatsapp: string;
  dealerName: string;
  pendingCount: number;
}) {
  const template = process.env.MSG91_LOW_BALANCE_TEMPLATE_ID;
  if (!template) return;
  const clean = opts.dealerWhatsapp.replace(/\D/g, "").slice(-10);
  if (clean.length !== 10) return;
  const res = await sendWhatsAppTemplate({
    to: "91" + clean,
    templateName: template,
    components: {
      body_1: { type: "text", value: opts.dealerName },
      body_2: { type: "text", value: String(opts.pendingCount) },
      button_1: { subtype: "url", type: "text", value: "dealer/wallet" },
    },
  });
  if (!res.ok) console.error(`[leadService] low-balance alert failed: ${res.detail}`);
}

/* Customer contact-delivery message — sent when a pending lead is released
   after the owner tops up. Template (MSG91_CONTACT_DELIVERY_TEMPLATE_ID,
   Utility): ref, property, owner name, owner phone. */
async function sendCustomerContactDelivery(opts: {
  customerPhone: string;
  ref: string;
  propLabel: string;
  ownerName: string;
  ownerPhone: string;
}) {
  const template = process.env.MSG91_CONTACT_DELIVERY_TEMPLATE_ID;
  if (!template) return;
  const res = await sendWhatsAppTemplate({
    to: "91" + opts.customerPhone,
    templateName: template,
    components: {
      body_1: { type: "text", value: opts.ref },
      body_2: { type: "text", value: opts.propLabel },
      body_3: { type: "text", value: opts.ownerName },
      body_4: { type: "text", value: opts.ownerPhone },
    },
  });
  if (!res.ok) console.error(`[leadService] contact delivery failed: ${res.detail}`);
}

async function getPropLabel(db: SupabaseClient, propId: number | null): Promise<string> {
  if (!propId) return "General enquiry";
  const { data } = await db
    .from("properties")
    .select("title, price")
    .eq("id", propId)
    .maybeSingle();
  if (!data?.title) return "General enquiry";
  return data.price ? `${data.title} ₹${Number(data.price).toLocaleString("en-IN")}` : data.title;
}

export async function createLead(
  db: SupabaseClient,
  input: CreateLeadInput
): Promise<CreateLeadResult> {
  // 1. Resolve dealer server-side. Never trust a client-supplied dealerId when
  //    a property is involved — the client's copy can be stale or forged.
  //    Also resolve the property's type here — it's what decides whether the
  //    buyer-commission consent gate applies at all (sale-only).
  let dealerId = input.dealerId;
  let propType: "sale" | "rent" | null = null;
  if (input.propId) {
    const { data: propRow } = await db
      .from("properties")
      .select("dealer_id, type")
      .eq("id", input.propId)
      .maybeSingle();
    dealerId = propRow?.dealer_id ?? null;
    propType = propRow?.type ?? null;
  }

  // 2. Dedup — the double-charge / refresh shield.
  //    Same phone + same property (30d), or same phone + same dealer for
  //    dealer-enquiries (30d), or same phone alone for general enquiries (24h).
  const dedupCutoff = new Date(
    Date.now() - (input.propId || dealerId ? DEDUP_DAYS * 24 : GENERAL_DEDUP_HOURS) * 3600 * 1000
  ).toISOString();
  let dedupQuery = db
    .from("leads")
    .select("reference_code, dealer_id, billing_status, commission_consent")
    .eq("customer_phone", input.phone)
    .gt("created_at", dedupCutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (input.propId) {
    dedupQuery = dedupQuery.eq("property_id", input.propId);
  } else if (dealerId) {
    dedupQuery = dedupQuery.eq("dealer_id", dealerId).is("property_id", null);
  } else {
    dedupQuery = dedupQuery.is("property_id", null).is("dealer_id", null);
  }
  const { data: existing, error: dedupError } = await dedupQuery.maybeSingle();
  // Fail OPEN, never silent: dedup must never block a lead (e.g. during the
  // pre-migration deploy window before billing_status exists), but a failure
  // here needs to be visible — a silently-broken dedup means every refresh
  // becomes a fresh lead and, once billing is on, a fresh charge.
  if (dedupError) {
    console.error(`[leadService] dedup query failed, proceeding as new lead: ${dedupError.message}`);
  }

  if (existing) {
    const walletPending = existing.billing_status === "pending_balance";
    const consentGivenNow = propType === "sale" && input.consentedToCommission === true;
    const consentPending = propType === "sale" && !existing.commission_consent && !consentGivenNow;
    const pending = walletPending || consentPending;

    // Consent given on a repeat visit (withheld the first time) — record it
    // now so a third visit doesn't ask again.
    if (consentGivenNow && !existing.commission_consent) {
      try {
        await db
          .from("leads")
          .update({ commission_consent: true, commission_consent_at: new Date().toISOString() })
          .eq("reference_code", existing.reference_code);
      } catch {
        /* pre-migration deploy window — ignore */
      }
    }

    let dealerPhone: string | null = null;
    if (!pending && existing.dealer_id) {
      dealerPhone = (await getDealerContact(db, existing.dealer_id)).phone;
    }
    return {
      ref: existing.reference_code,
      dealerPhone,
      dedup: true,
      billing: pending ? "pending" : "revealed",
      consentRequired: consentPending || undefined,
    };
  }

  // 3. Insert. Core columns only — billing columns are settled right after
  //    (keeps the insert working even if migration_wallet.sql lags a deploy).
  let ref = makeRef();
  const { data: clash } = await db
    .from("leads")
    .select("reference_code")
    .eq("reference_code", ref)
    .maybeSingle();
  if (clash) ref = makeRef();

  const { data: inserted, error: insertError } = await db
    .from("leads")
    .insert({
      reference_code: ref,
      customer_name: input.name,
      customer_phone: input.phone,
      property_id: input.propId,
      dealer_id: dealerId,
      unit_id: input.unitId ?? null,
      unit_label: input.unitLabel ?? null,
      intent: input.intent ?? null,
      msg: input.msg ?? null,
      move_in_date: input.moveInDate ?? null,
      occupants: input.occupants ?? null,
      source_url: input.sourceUrl,
      status: "new",
    })
    .select("id, magic_token")
    .single();

  if (insertError || !inserted) {
    throw new Error("Failed to save lead");
  }

  // 3b. Sale-only side effects — commission consent + the sale_deals row.
  //     Both best-effort/fail-open (like the charge_paise write below): a
  //     lagging migration must never break lead creation.
  if (propType === "sale") {
    try {
      await db
        .from("leads")
        .update({
          commission_consent: input.consentedToCommission === true,
          commission_consent_at: input.consentedToCommission === true ? new Date().toISOString() : null,
        })
        .eq("id", inserted.id);
    } catch {
      /* pre-migration deploy window — ignore */
    }
    if (dealerId) {
      try {
        await db.from("sale_deals").insert({
          lead_id: inserted.id,
          property_id: input.propId,
          dealer_id: dealerId,
          buyer_name: input.name,
          buyer_phone: input.phone,
          status: "interested",
        });
      } catch {
        /* pre-migration deploy window — ignore */
      }
    }
  }

  // 4. Billing.
  //    Sale/buy leads never touch the rental wallet — they carry their own
  //    closing-time commission (lib/commission.ts) computed later by admin
  //    from the sale_deals row. Here we only soft-block reveal when consent
  //    hasn't been given yet — never trust the client checkbox alone.
  let billing: "revealed" | "pending" = "revealed";
  if (propType === "sale") {
    if (input.consentedToCommission !== true) billing = "pending";
  } else if (dealerId && BILLING_ENABLED) {
    const { data: outcome, error: rpcError } = await db.rpc("charge_lead", {
      p_dealer_id: dealerId,
      p_lead_id: inserted.id,
      p_amount_paise: LEAD_PRICE_PAISE,
    });
    if (rpcError) {
      // Fail OPEN: never block a customer on a billing bug. Admin reconciles
      // from the ledger; the lead stays 'waived'.
      console.error(`[leadService] charge_lead RPC failed for lead ${inserted.id}: ${rpcError.message}`);
    } else if (outcome === "insufficient") {
      billing = "pending";
    }
  } else {
    // Free phase (or no dealer): record shadow value. Best-effort — if the
    // wallet migration hasn't run yet this update fails harmlessly.
    try {
      await db
        .from("leads")
        .update({ charge_paise: LEAD_PRICE_PAISE })
        .eq("id", inserted.id);
    } catch {
      /* pre-migration deploy window — ignore */
    }
  }

  // 5. Notify + reveal.
  let dealerPhone: string | null = null;
  if (dealerId) {
    const contact = await getDealerContact(db, dealerId);
    if (billing === "revealed") {
      dealerPhone = contact.phone;
      if (contact.whatsapp) {
        await sendDealerLeadAlert({
          dealerWhatsapp: contact.whatsapp,
          propLabel: await getPropLabel(db, input.propId),
          customerName: input.name,
          customerPhone: input.phone,
          moveInDate: input.moveInDate ?? null,
          occupants: input.occupants ?? null,
          ref,
          magicToken: inserted.magic_token ?? null,
        });
      }
    } else if (propType !== "sale" && contact.whatsapp) {
      // Wallet-insufficient-balance nudge — rent leads only. A sale lead
      // pending on missing consent doesn't need a top-up message; admin
      // follows up manually via /admin/sale-deals instead.
      const { count } = await db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("dealer_id", dealerId)
        .eq("billing_status", "pending_balance");
      await sendLowBalanceAlert({
        dealerWhatsapp: contact.whatsapp,
        dealerName: contact.name ?? "Partner",
        pendingCount: count ?? 1,
      });
    }
  }

  return {
    ref,
    dealerPhone,
    dedup: false,
    billing,
    consentRequired: propType === "sale" && billing === "pending" ? true : undefined,
  };
}

/* Release pending leads after a wallet credit — FIFO, oldest first. Leads
   older than PENDING_EXPIRY_DAYS are waived, never billed: the customer has
   gone cold and charging an owner for a stale lead is how trust dies.
   Runs synchronously inside the admin credit handler (fine at this volume);
   a future Razorpay webhook calls this same function. */
export async function releasePendingLeads(
  db: SupabaseClient,
  dealerId: number
): Promise<{ released: number; expired: number }> {
  const { data: pendingLeads } = await db
    .from("leads")
    .select("id, reference_code, created_at, customer_name, customer_phone, property_id, magic_token, move_in_date, occupants")
    .eq("dealer_id", dealerId)
    .eq("billing_status", "pending_balance")
    .order("created_at", { ascending: true });

  if (!pendingLeads || pendingLeads.length === 0) return { released: 0, expired: 0 };

  const contact = await getDealerContact(db, dealerId);
  const expiryCutoff = Date.now() - PENDING_EXPIRY_DAYS * 24 * 3600 * 1000;
  let released = 0;
  let expired = 0;

  for (const lead of pendingLeads) {
    if (new Date(lead.created_at).getTime() < expiryCutoff) {
      // charged_at doubles as the settled-latch so this can never be billed later
      await db
        .from("leads")
        .update({ billing_status: "waived", charged_at: new Date().toISOString() })
        .eq("id", lead.id);
      expired++;
      continue;
    }

    const { data: outcome, error: rpcError } = await db.rpc("charge_lead", {
      p_dealer_id: dealerId,
      p_lead_id: lead.id,
      p_amount_paise: LEAD_PRICE_PAISE,
    });
    if (rpcError) {
      console.error(`[leadService] release charge failed for lead ${lead.id}: ${rpcError.message}`);
      continue;
    }
    if (outcome === "insufficient") break; // money ran out — stop, stay pending
    if (outcome !== "charged" && outcome !== "free") continue; // already_settled etc.

    released++;
    const propLabel = await getPropLabel(db, lead.property_id);

    // Owner finally gets the full lead (they only saw the masked teaser)…
    if (contact.whatsapp) {
      await sendDealerLeadAlert({
        dealerWhatsapp: contact.whatsapp,
        propLabel,
        customerName: lead.customer_name,
        customerPhone: lead.customer_phone,
        moveInDate: lead.move_in_date,
        occupants: lead.occupants,
        ref: lead.reference_code,
        magicToken: lead.magic_token ?? null,
      });
    }
    // …and the customer finally gets the owner's number.
    if (contact.phone) {
      await sendCustomerContactDelivery({
        customerPhone: lead.customer_phone,
        ref: lead.reference_code,
        propLabel,
        ownerName: contact.name ?? "Owner",
        ownerPhone: contact.phone,
      });
    }
  }

  return { released, expired };
}
