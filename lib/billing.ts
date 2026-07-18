/* Billing configuration — all env-driven so the month-2 flip (and any price
   change) is a Vercel env edit + redeploy, never a code change.

   Phase 0 (now): BILLING_ENABLED unset → every lead is revealed free and
   recorded as billing_status='waived' with charge_paise=LEAD_PRICE_PAISE
   (shadow value — powers the "aapko ₹X ke leads free diye" pitch at flip).
   Flip: set BILLING_ENABLED=true in Vercel. */

export const BILLING_ENABLED = process.env.BILLING_ENABLED === "true";

export const LEAD_PRICE_PAISE = Number(process.env.LEAD_PRICE_PAISE ?? 2500); // ₹25

export const FREE_LEADS_PER_DEALER = Number(process.env.FREE_LEADS_PER_DEALER ?? 5);
