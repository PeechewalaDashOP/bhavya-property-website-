# CONTINUATION — where this session left off (2026-07-18)

Read this first in a new session before touching lead/OTP/wallet code. Full architecture
detail lives in `CLAUDE.md` (kept current, auto-loaded every session) — this file is the
narrower "what's done, what's next" handoff.

## What shipped this session (confirmed working on the live site)

1. **Customer OTP moved from SMS to WhatsApp.** `/api/otp/send` was calling MSG91's SMS
   OTP-widget by mistake; now uses MSG91's WhatsApp Business API with the correct
   `to_and_components` payload shape (their own abstraction, not Meta's raw Cloud API —
   confirmed against MSG91's dashboard "Code {JSON}" sample after a live 400 rejection).
2. **Verified-device flow.** One OTP verify sets a 30-day signed httpOnly cookie
   (`lib/phoneVerifySession.ts`); repeat reveals — same property on refresh, or a
   different property entirely — go through `/api/leads/verified` in one round trip, no
   OTP. **Tested live by the user on a real phone: confirmed working.**
3. **Dedup.** `lib/leadService.ts::createLead()` is now the one path every lead-creating
   route goes through. Same phone + same property within 30 days returns the existing
   lead instead of a duplicate. **Tested live (by Claude, with cleanup) and by the user:
   confirmed working** after `migration_wallet.sql` was run.
4. **Security fix:** `/api/leads` used to accept a `propId` and return the dealer's phone
   with zero verification — a curl-able full bypass of the OTP gate. Now general-enquiry
   only, never returns a phone.
5. **Wallet billing infrastructure — built, currently INERT.** Schema + atomic
   `charge_lead`/`credit_wallet` Postgres RPCs, admin wallet page (manual credit +
   ledger), dealer wallet page (UPI QR + "I've paid" WhatsApp button + transaction
   history), balance chip in the dealer dashboard header. Gated entirely behind
   `BILLING_ENABLED` (currently unset → **everything is free for both customer and
   owner, no auto-expiry** — it only turns on when `BILLING_ENABLED=true` is set in
   Vercel and redeployed, whenever Bhavya decides).
6. `lib/msg91.ts` centralizes the WhatsApp send — dealer-alert (in `createLead`) and the
   15-day nudge cron were quietly using the same wrong old Meta-shaped payload as OTP
   originally did; both now route through the corrected shared sender.

## Currently configured (Vercel + Supabase)

- ✅ `supabase/migration_wallet.sql` has been run.
- ✅ `PHONE_VERIFY_SECRET` set in Vercel, redeployed.
- ✅ `MSG91_OTP_WHATSAPP_TEMPLATE_ID`, `MSG91_WHATSAPP_NUMBER`, `MSG91_WHATSAPP_NAMESPACE`
  set (customer OTP send confirmed working).
- ❌ `BILLING_ENABLED` — unset (intentional, free phase).
- ❌ `NEXT_PUBLIC_UPI_VPA`, `NEXT_PUBLIC_CONCIERGE_WHATSAPP` — not set yet; the dealer
  wallet page's top-up buttons won't render fully without these (page itself works,
  just missing the QR/VPA line and WhatsApp button until set — low priority while
  billing is off).
- ❓ `MSG91_WHATSAPP_TEMPLATE_ID` (dealer new-lead alert) — per the user, **no dealer
  template has ever been created in MSG91.** The code path is correct now but has
  nothing to send; dealer WhatsApp alerts are silently no-op-ing (fail-silent by
  design — leads still save, dealer just doesn't get pinged). Not urgent while dealer
  work is deferred, but this is the actual reason dealers aren't getting notified today.
- ❓ `MSG91_NUDGE_TEMPLATE_ID` — likely also not created; same situation as above.

## Explicitly deferred (per Bhavya: "dealer work later")

- Dealer login is still phone-only, no OTP (`/api/dealer/login/direct` bypass). Revert
  documented in memory `project_otp_temp_disabled.md` and `CLAUDE.md`. **Note:**
  `/api/otp/send` is shared — reverting this later will also send WhatsApp OTPs for
  dealer login through the exact same (working) path.
- No MSG91 templates created yet for: dealer new-lead alert, low-balance alert
  (billing), contact-delivery (billing), 15-day nudge. **Submit these early** — Meta
  approval takes days, not hours, and three of the four gate real features.

## Remaining tasks, roughly in priority order

1. **Verify the wallet pages render correctly** — `/admin/wallet` and `/dealer/wallet`
   were type-checked and built but not yet visually confirmed in a browser (should show
   ₹0 balances, 5 free leads, empty transaction lists — that's correct while billing is
   off).
2. **Dealer work** (when ready): create the dealer new-lead alert template in MSG91,
   re-enable dealer OTP login, confirm the alert actually delivers on a real new lead.
3. **Billing flip prep**: submit the low-balance + contact-delivery MSG91 templates,
   set `NEXT_PUBLIC_UPI_VPA` + `NEXT_PUBLIC_CONCIERGE_WHATSAPP`, do a flip rehearsal on
   one test dealer before setting `BILLING_ENABLED=true` for real (see the "Flip
   rehearsal" checklist in the original plan — 5 free leads decrement → charge →
   insufficient → pending screen → admin credit → auto-release).
4. **Broader product roadmap** (pre-dates this session, still open) — see
   `docs/audit/PLAN.md` for the ranked hostel-collection build order (hostel card
   component, area hub pages with real filters, hostel-first homepage rework) and
   `docs/audit/BLOCKERS.md`/`REALITY.md`/`MIGRATION.md` for the original schema audit.
   A `design-system/` folder (MASTER.md + page overrides) exists from an earlier
   session for this UI work — read it before building any of PLAN.md's Tier 1 items.
5. One old, low-priority loose end from earlier auditing: `DEALER_SESSION_SECRET` in
   the user's local `.env.local` had an obviously-placeholder value
   (`dev-only-local-secret-change-in-production-...`). Worth a 30-second check that
   Vercel's production value isn't the same literal placeholder — dealer login tokens
   are signed with it.

## Key files (this session's work)

`lib/leadService.ts` (createLead, dedup, billing hook, releasePendingLeads) ·
`lib/phoneVerifySession.ts` (verified-device cookie) · `lib/msg91.ts` (shared WhatsApp
sender) · `lib/billing.ts` (flags) · `app/api/leads/verified/` (new) ·
`app/api/otp/verify/route.ts`, `app/api/leads/route.ts`, `app/api/cron/nudge/route.ts`
(refactored) · `supabase/migration_wallet.sql` · `app/admin/wallet/`, `app/dealer/wallet/`
(new pages) · `components/SiteClient.tsx`, `app/property/[slug]/PropertyDetail.tsx`
(verified-path wiring).

---

## Prompt to open the next session with

```
Read docs/audit/CONTINUATION.md first — that's where the last session left off
(customer OTP over WhatsApp + verified-device flow + dedup are live and tested;
wallet billing is built but inert behind BILLING_ENABLED). I want to work on:
[dealer work / billing flip prep / the PLAN.md hostel-collection roadmap / something else]
```
