# KotaProperty — project context for Claude Code

This file orients Claude Code. Read it first, then continue from "Where we stopped".

## What this is
A property listing website for **Kota, Rajasthan** — buy / rent / sell, listings
direct from ~5–6 local dealers. Audience is ~99% mobile, tier-2, families + coaching
students. Owner: Bhavya. Goal: simple, fast, trustworthy, solution-oriented.

## Stack (this folder = the real product)
Next.js (App Router, SSR for SEO) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth + Storage) · deploy on Vercel. Free tiers.

## Run
```bash
npm install
npm run dev            # http://localhost:3000  (works on sample data, no Supabase needed)
```
Connect Supabase: run `supabase/schema.sql`, set `.env.local` from `.env.local.example`,
optionally `node scripts/seed.mjs`. See README.md.

## NON-NEGOTIABLE design rule
The UI must stay **pixel-identical** to the original prototype.
- The original CSS lives verbatim in `app/globals.css`.
- Components reuse the **same class names + markup** (see `components/SiteClient.tsx`).
- Tailwind preflight is **disabled** (`tailwind.config.ts`) so it never alters the design.
- Keep `<img>` (not next/image) where markup must match exactly.
Do not "redesign" — only extend. If adding pages, match this visual language.

## File map
```
app/layout.tsx       SEO metadata + Inter font + globals.css
app/page.tsx         Server Component: getData() -> <SiteClient/> (SSR'd for SEO)
app/globals.css      EXACT original styles (verbatim)
components/SiteClient.tsx   all interactive UI (search, filters, view-more,
                            lead gateway, deal tracker, AI chatbot)
lib/types.ts         Property / Dealer / Area / Lead
lib/format.ts        price formatter (₹ Lakh/Cr)
lib/sampleData.ts    seeded sample data (identical to prototype)
lib/supabase.ts      supabase client (null if env missing)
lib/getData.ts       server fetch (Supabase -> sample fallback) + saveLead()
supabase/schema.sql  tables (properties, dealers, areas, leads) + RLS
scripts/seed.mjs     load sample data into Supabase
```

## Business model (why the app works the way it does)
We are a **lead gateway + local broker-aggregator**, not a per-deal commission service.
Research (MagicBricks ₹332Cr, 99acres, NoBroker) showed the big players earn **upfront**
(featured listings, dealer subscriptions, pay-per-lead, buyer-side unlock for rentals),
NOT a success fee — which is why dealer/customer collusion can't hurt them. So:
- **Contact is gated:** visitor submits name+phone first, THEN dealer phone/WhatsApp
  unlocks (with a reference code). Implemented in `SiteClient.tsx` (the "lock"/"reveal").
- **Deal tracker** ("Track deals (Admin)" in footer) logs leads + status.
- An **accountability system** exists as a separate prototype (see ../kota-simple/system.html)
  with two-sided confirmation, but it is NOT yet wired into this Next.js app.
Revenue plan detail: ../Business-Model-and-Workflow-Plan.md

## Where we stopped (current status — updated 2026-07-18)

**Read `docs/audit/CONTINUATION.md` for the full handoff** — this section is the short
version. DONE (all live, tested on real devices): full UI, SSR/SEO, Supabase wiring,
admin dashboard, dealer dashboard + post-a-property (two flows: standard + hostel
wizard), customer OTP over WhatsApp (MSG91), verified-device flow (30-day cookie, no
repeat OTP), lead dedup, magic-link dealer actions, 15-day availability nudge cron.

NOT yet done (pick up here):
1. **Wallet billing flip.** Infrastructure is built (`lib/leadService.ts`,
   `supabase/migration_wallet.sql`, `/admin/wallet`, `/dealer/wallet`) but inert —
   `BILLING_ENABLED` is unset, so every lead is currently free for both customer and
   owner. Flip = set the env var + redeploy, once the low-balance and contact-delivery
   MSG91 templates are approved. See CONTINUATION.md.
2. **Dealer OTP login** — currently phone-only (`/api/dealer/login/direct`), deferred
   on purpose. No dealer new-lead-alert template exists in MSG91 yet either, so dealer
   WhatsApp notifications are silently no-op-ing (fail-silent by design).
3. **Hostel-collection product roadmap** (pre-dates the billing work) — see
   `docs/audit/PLAN.md`, `BLOCKERS.md`, `REALITY.md`, `MIGRATION.md`, and the
   `design-system/` folder for the hostel-first UI rework that hasn't started yet.
4. **SEO depth** — per-locality/campus pages exist (`/kota/[slug]`, `/near/[hub]`) but
   the broader hostel-first SEO structure from `docs/research/03-SEARCH-SPEC.md` §D7
   hasn't been built.

## Constraints / gotchas
- Mobile-first, fast. Most users on mid-range Android + patchy 4G.
- Plain, simple English in all copy (audience includes non-technical users).
- Free tier only for now; Supabase free pauses after ~1 week idle (add an uptime ping).
- Never expose the Supabase **service role** key client-side (seed script only).

## Sibling folders (in the parent directory — earlier explorations, reference only)
../kota-simple   = the source single-file prototype this app was ported from (+ system.html)
../kota-portal, ../kota-luxe, ../kota-premium, ../kota-homes, ../kota-concepts
                 = earlier UI direction prototypes (not the chosen product)
../Business-Model-and-Workflow-Plan.md, ../BUILD-PROMPT-Kota-Maison.md = strategy docs
The CHOSEN product to build going forward is THIS folder (kota-next).

---

## ABSOLUTE RULES (Never Break These)

### UI is FROZEN
- Do NOT redesign anything
- Do NOT change class names
- Do NOT replace <img> with next/image unless explicitly told
- Do NOT add animations, gradients, or "improvements"
- Match existing visual language exactly when adding new pages
- app/globals.css is sacred — do not touch it
- Tailwind preflight is disabled by design — do not re-enable it

### Mobile First, Always
- Every new component must work on 375px screen first
- Mental model = mid-range Android on Jio 4G
- No heavy libraries. No 3D. No WebGL. No Framer Motion
- LCP must stay under 2.5s
- Test on real phone before marking anything done

### Never Expose Service Role Key Client-Side
- SUPABASE_SERVICE_ROLE_KEY = server only (API routes, seed scripts)
- NEXT_PUBLIC_* = anon/public only
- If you need service role client-side → create an API route instead
- Never ever put service role key in any component or client file

### No localStorage for Business Data
- Leads → Supabase only
- Deal status → Supabase only
- localStorage allowed ONLY for: recently viewed, UI preferences
- Never store phone numbers, names, or lead data in localStorage
- Migrating away from localStorage is an active priority

### Schema is Locked — Never Alter Without Asking
- Do not add columns without explicit instruction
- Do not rename existing columns
- Do not change RLS policies without explicit instruction
- If you think a schema change is needed — stop and tell Bhavya,
  don't just do it

---

## Architecture Decisions (Already Made — Do Not Revisit)

### Auth Model
- Admin: email + password, app_metadata.role = 'admin'
- Dealers: phone OTP login via MSG91 — no passwords, ever
  (same MSG91 direct flow as customer OTP — Supabase phone auth is NOT configured)
- No roles table — role lives in app_metadata
- Three-layer admin protection: middleware → layout → assertAdmin()

### Data Flow Rules
- Public reads: Server Component → createClient() → RLS-gated select
- Public writes (leads): Client → POST /api/leads → service role insert
- Admin writes: Client → POST /api/admin/* → assertAdmin() → service role
- Never write to DB directly from client components — always go through
  API routes

### Notification System
- New lead → WhatsApp message to dealer via MSG91
- New lead → immediately visible in admin dashboard
- Magic links for dealer status update (dealer does NOT need to log in)
- Magic link format: /api/deal/[token]/[action]
- Valid actions: contacted | closed | dead
- **MSG91 is the single provider for ALL SMS/WhatsApp communication:**
  - OTP delivery to customers (phone verification before lead is saved)
  - WhatsApp notifications to dealers (new lead alerts with magic links)
  - Consolidates billing and reduces complexity vs using Twilio for OTP
    and MSG91 for WhatsApp separately

### Dealer Philosophy (Critical — Read This)
- Dealers are non-technical. Age range 25–60. All types.
- Primary interaction = WhatsApp notification + magic link tap
- Dashboard is secondary — one page, big buttons, Hindi-friendly labels
- OTP login only — no passwords, no email, no complex flows
- Rule: if a 55-year-old non-tech person can't figure it out in 10
  seconds, simplify it
- Do NOT build a SaaS-style dealer portal — that will kill adoption

---

## Required Fields (Must Exist — Do Not Remove)

### properties table
- dealer_id (FK to dealers) — always required, never nullable
- is_approved (boolean, default false) — admin must approve before live
- is_featured (boolean, default false) — for future monetization
- is_verified (boolean, default false) — admin verified badge
- status: 'available' | 'sold' | 'rented'
- listing_type: 'rent' | 'sale' (default 'rent')
- slug — permanent after creation, never rename (breaks SEO + bookmarks)
- area_id (FK to areas table) — never free text string for area
- rent_per_month (primary price field for rentals)
- deposit_amount (security deposit)
- furnishing_status: 'furnished' | 'semi-furnished' | 'unfurnished'
- meals_included (boolean — critical for hostels and PGs)
- gender_preference: 'boys' | 'girls' | 'any'
- available_from (date)
- min_stay_months (minimum rental duration)
- floor_number
- total_floors
- attached_bathroom (boolean)
- parking_available (boolean)
- wifi_included (boolean)
- nearest_coaching_hub: 'Allen' | 'Resonance' | 'FIITJEE' |
  'Vibrant' | 'Motion' | 'Other'

### leads table
- customer_name
- customer_phone (verified via OTP, or via the verified-device cookie — see
  "Verified-Device Flow" below)
- property_id (FK to properties)
- dealer_id (FK to dealers) — denormalized for query speed
- status: 'new' | 'contacted' | 'closed' | 'dead'
- source_url — which page the lead came from
- magic_token — uuid, for magic link actions without login
- reference_code — format P100-XXXX, auto generated server side
- move_in_date (date, nullable)
- occupants (integer, nullable)
- contacted_at (timestamp, nullable)
- closed_at (timestamp, nullable)
- created_at (timestamp, auto)
- billing_status: 'free' | 'charged' | 'pending_balance' | 'waived' (added by
  supabase/migration_wallet.sql — see "Wallet / Pay-Per-Lead Billing" below)
- charge_paise (bigint, nullable) — what this lead cost, or would have cost
  (shadow value while BILLING_ENABLED=false)
- charged_at (timestamp, nullable) — also doubles as the billing idempotency
  latch; never bill a lead where this is already set

### dealers table
- phone — primary identifier
- whatsapp_number — may differ from phone number
- areas_covered (array of area_ids)
- is_active (boolean, default true)
- wallet_balance_paise (bigint, default 0) — prepaid balance in paise
- free_leads_remaining (int, default 5) — evergreen "first 5 free" offer,
  decrements before any wallet charge

---

## File Structure Rules
- New API routes → app/api/ only
- New admin pages → app/admin/ only
- New public pages → app/(public)/
- Shared components → components/
- DB query logic → lib/getData.ts or lib/queries/*.ts
- All types → lib/types.ts only (never define types inline in components)
- Constants (areas, property types) → lib/constants.ts
- Do NOT create random utility files scattered around the project

---

## Lead Gateway & OTP Flow (Core Business Logic — Never Change Without Asking)

### How The Lead Gateway Works
This is the most important business flow in the entire app.
Do not simplify, skip, or redesign any step without explicit instruction.
Customer clicks "Get Dealer Contact"

↓

Popup opens — asks Name + Phone only

↓

OTP sent to customer's phone via MSG91

↓

Customer enters OTP — verified ✅

↓

ONLY NOW — dealer phone/WhatsApp number is revealed

↓

Reference code shown to customer (e.g. KP-2047)

↓

Lead saved to Supabase leads table

↓

WhatsApp notification sent to dealer via MSG91

↓

Admin dashboard updates in real time

### Why This Order Matters
- Dealer number is NEVER shown before OTP verification
- This is not optional UX — it is the entire business model
- Every lead is verified (real phone number, real person)
- Platform stays in the middle of every transaction always

### What Gets Saved to leads Table on Verification
- customer_name
- customer_phone (verified via OTP)
- property_id
- dealer_id (denormalized for speed)
- source_url (which page they were on)
- magic_token (uuid — for dealer magic links)
- status: 'new' (default)
- reference_code (format: KP-XXXX, auto generated server side)
- move_in_date (when customer needs property)
- occupants (how many people)
- created_at

### What Lead Form Asks Customer
- Name (text)
- Phone (number — OTP sent here)
- When do you need it from? (date picker)
- For how many people? (1 / 2 / 3 / 4+)

### What Dealer Receives on WhatsApp (via MSG91)
🏠 New Rental Lead — KotaProperty

━━━━━━━━━━━━━━━━━━━━━

Property: Boys Hostel, Talwandi ₹8,000/mo

━━━━━━━━━━━━━━━━━━━━━

Student: Rahul Sharma

Phone: 98XX XXXXX

Moving in: 1 July 2025

People: 1

Ref: KP-2047

━━━━━━━━━━━━━━━━━━━━━

[✅ Mark as Contacted]

[🔒 Mark as Closed]
- Links are magic links — dealer taps, status updates, no login needed
- Magic link format: yourdomain.com/api/deal/[magic_token]/[action]
- Valid actions: contacted | closed | dead

### What Customer Sees After OTP Verified
- Dealer name
- Dealer phone number (tappable — opens dialer)
- Dealer WhatsApp button (opens wa.me link)
- Reference code: KP-2047
- Message: "Show this reference code to the dealer"

### Platform Is Always In The Middle
- Customer cannot get dealer number without OTP — enforced server side
- Dealer gets leads only from platform — no direct listing of personal number
- Every interaction is logged — who, when, which property, what status
- Admin (Bhavya) sees full picture at all times

### OTP Implementation
- **Primary provider: MSG91 WhatsApp Business API — NOT SMS, NOT Twilio, NOT Supabase's
  built-in phone auth.** Customer OTP is delivered over WhatsApp using a Meta
  Authentication-category template with a Copy Code button
  (`MSG91_OTP_WHATSAPP_TEMPLATE_ID`), sent via
  `api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/` — the same endpoint
  already used for dealer new-lead alerts and the 15-day nudge, just a different
  template. `control.msg91.com/api/v5/otp` (the SMS/voice OTP widget) is NOT used —
  an earlier version of this route called that endpoint by mistake; it has been
  replaced. `MSG91_OTP_TEMPLATE_ID` (the old DLT SMS template var) is deprecated and
  unread.
- Supabase's `signInWithOtp` / `verifyOtp` are NOT used anywhere. Removed entirely.
- Why not Supabase phone auth: creates ghost auth "users" for customers who are just
  verifying their number, not logging in. Unnecessary and wrong semantic.
- Verification is 100% local regardless of delivery channel — MSG91/Meta is never
  asked to validate the code. `/api/otp/send` generates, hashes, and stores the OTP
  itself; `/api/otp/verify` compares it server-side. This is why the channel (SMS vs
  WhatsApp) was swappable without touching hashing, expiry, attempts, or schema.

**How it works (Option B — fully implemented):**
1. `/api/otp/send`:
   - Deletes expired rows for the phone (cleanup on each send)
   - Rate limit: returns 429 if any unverified row was created for this phone
     in the last 60 seconds
   - Generates 6-digit OTP via `crypto.randomInt(100000, 1000000)` (CSPRNG)
   - Hashes it: `SHA-256("otp:phone")` — phone acts as per-row salt
   - Inserts row into `otp_verifications` (phone, otp_hash, expires_at=+10min)
   - Sends the code via MSG91 WhatsApp (Authentication template, Copy Code button);
     if the send fails, rolls back the DB row
2. `/api/otp/verify`:
   - Looks up latest unverified, unexpired row for this phone
   - Returns 429 if attempts >= 3 (enforced server-side in DB)
   - Computes `SHA-256("token:phone")` and compares with stored hash using
     `crypto.timingSafeEqual` (prevents timing attacks)
   - On mismatch: increments attempts, returns remaining count
   - On match: marks verified_at, inserts lead
   - Fetches magic_token, dealer phone+name, property title+price in parallel
   - Sends WhatsApp to dealer via MSG91 (fail-silent — lead already saved)
   - Returns ONLY `{ ref, dealerPhone }` — no other data

- Never skip OTP step even in testing — use a test phone number instead
- OTP expiry: 10 minutes (enforced server-side via expires_at column)
- Max attempts: 3 then 429 (enforced server-side via attempts column)
- Rate limit: 1 OTP send per phone per 60 seconds (server-side, no Redis needed)

### Reference Code Format
- Format: KP-XXXX where XXXX is a random 4-digit number
- Generated server side at lead creation
- Stored in leads table as reference_code column
- Must be unique — check before inserting
- Shown to both customer and dealer
- Never generate reference code client side

### What Admin Dashboard Shows Per Lead
- reference_code
- customer_name + customer_phone
- property name + area
- dealer name
- status (new / contacted / closed / dead)
- created_at
- contacted_at (when dealer tapped magic link)
- closed_at (when deal marked closed)
- time_to_contact (difference — shows dealer responsiveness)
- move_in_date
- occupants

### Never Do These in This Flow
- Never show dealer number before OTP completes — not even partially
- Never save lead before OTP is verified
- Never send WhatsApp to dealer before lead is saved to DB
- Never generate reference code client side
- Never expose magic_token in any UI — backend only
- Never let a route return `dealerPhone` without going through
  `lib/leadService.ts::createLead()` — that's the ONLY place dedup + billing
  are enforced. (A route that hand-rolls a lead insert is how the pre-fix
  `/api/leads` bug happened — full OTP-gateway bypass via curl.)

---

## Verified-Device Flow (added — kills repeat-OTP friction)

**Problem it solves:** without this, a customer had to OTP-verify on every
page refresh and for every single property — a 5-property comparison meant
5 WhatsApp codes. Conversion killer.

**How it works:** after a successful OTP verify, `/api/otp/verify` sets an
httpOnly, Secure, SameSite=Lax cookie (`p100_pv`, 30 days) signed with the
same HMAC-SHA256 pattern as the dealer session (`lib/phoneVerifySession.ts`,
cloned from `lib/dealerSession.ts`). The phone number is never readable by
client JS and never touches localStorage (CLAUDE.md's own rule) — it only
exists inside the signed cookie, verified server-side.

- `GET /api/leads/verified` — prefill check only (HMAC verify, no DB hit).
  Returns `{ verified, phone?, name? }`.
- `POST /api/leads/verified` — the one-round-trip reveal path. Requires the
  cookie AND the submitted phone to match `cookie.ph` exactly (typing a
  different number always forces OTP — this is also how re-verifying a new
  number rotates the cookie). Capped at 10 leads/phone/24h to bound a stolen
  cookie's blast radius. On success, calls the same `createLead()` used by
  the OTP path.
- Both `components/SiteClient.tsx` and `app/property/[slug]/PropertyDetail.tsx`
  try this path FIRST; a `401` falls back to the existing `/api/otp/send` →
  `/api/otp/verify` flow, unchanged.

**Dedup (also lives in `createLead()`):** same phone + same property within
30 days → the EXISTING lead's ref/dealerPhone is returned, nothing new is
inserted, the dealer is NOT re-notified, and (once billing is on) the owner
is NOT re-charged. This is what makes "refresh the page" safe and what keeps
lead counts honest.

---

## Wallet / Pay-Per-Lead Billing (added — inert until BILLING_ENABLED=true)

**Model:** prepaid wallet per dealer, debited ₹25 (`LEAD_PRICE_PAISE`) per
revealed lead, via `supabase/migration_wallet.sql`'s `charge_lead` RPC
(`SELECT ... FOR UPDATE` — serializes concurrent charges so two leads can
never double-spend one balance; `charged_at` is the idempotency latch).
Every owner gets `FREE_LEADS_PER_DEALER` (5) free leads before the wallet is
touched — evergreen, applies to every signup, not just launch.

**Free phase (now):** `BILLING_ENABLED` is unset. Every lead is revealed
free; `leads.billing_status='waived'` with `charge_paise=LEAD_PRICE_PAISE`
recorded as a SHADOW value (queryable per-dealer for the month-2 pitch:
"aapko ₹X ke leads free diye"). **Flip = one Vercel env var
(`BILLING_ENABLED=true`) + redeploy. No code change.**

**Insufficient balance (billing on):** the lead is NOT revealed — customer
sees "owner will contact you soon" + a concierge WhatsApp fallback to
Bhavya (never a dead end); `billing_status='pending_balance'`; the owner
gets a low-balance WhatsApp with the customer's phone MASKED (never send
the real number before payment — that's the entire point of charging).
Pending leads older than 7 days are waived, never billed — an owner is
never charged for a lead that's gone cold by the time they top up.

**Top-up v1 (manual):** owner pays a UPI QR shown on `/dealer/wallet`, taps
"I've paid" (WhatsApp to Bhavya), Bhavya credits from `/admin/wallet` via
the `credit_wallet` RPC. Crediting automatically calls
`releasePendingLeads()`, which charges any pending leads FIFO and — on
success — sends the dealer the full lead alert (they only ever saw the
masked teaser) and sends the customer the owner's contact over WhatsApp.
Razorpay is a deferred v2; the architecture is a drop-in — a webhook would
call the same `credit_wallet` + `releasePendingLeads()` pair.

**Files:** `lib/billing.ts` (flags), `lib/leadService.ts` (`createLead`,
`releasePendingLeads`), `lib/msg91.ts` (shared WhatsApp sender — see below),
`supabase/migration_wallet.sql` (schema + RPCs — **RPCs are REVOKEd from
anon/authenticated**, service-role only), `app/api/admin/wallet`,
`app/api/dealer/wallet`, `app/admin/wallet`, `app/dealer/wallet`.

---

## MSG91 WhatsApp Sends — one shared helper

All WhatsApp template sends (customer OTP, dealer new-lead alert, 15-day
nudge, low-balance alert, contact-delivery) go through
`lib/msg91.ts::sendWhatsAppTemplate()`. This is MSG91's OWN payload
abstraction (`to_and_components`, with `components` as a named object keyed
`body_1`/`button_1`/etc) — NOT Meta's raw Cloud API `components` array. The
authoritative reference for any template's exact field names is MSG91's
dashboard → WhatsApp → Templates → the `<>` "Code {JSON}" icon on that
template — not generic Meta docs (a prior version of this code guessed from
Meta docs and MSG91 rejected it: `HTTP 400 "to_and_components received is
Invalid"`). Never edit the payload shape without checking that sample first.

---

## Primary Focus — Rental Market (Current Phase)

### What We Are Building For Right Now
- Primary use case is RENTAL properties — not sale, not buy
- Target audience is coaching students, families, working professionals
  in Kota
- Kota has one of the largest student populations in India
  (Allen, Resonance, FIITJEE, Vibrant, Motion — lakhs of students
  every year)
- Every feature decision should prioritize rental use case first

### Property Types in Scope (Right Now)
- Hostel (boys / girls / co-ed — separate filter needed)
- PG (Paying Guest — shared rooms, meals included or not)
- Single room (independent, attached bath or shared)
- Flat / Apartment (1BHK, 2BHK, 3BHK)
- House on rent (full house)
- Shop / Commercial space (low priority, don't ignore)

### Rental-Specific Filters on Public UI
- Budget range (₹ per month) — most important filter
- Property type (hostel / PG / room / flat / house)
- Gender preference (boys / girls / any)
- Area / locality
- Meals included (yes/no)
- Furnishing status
- Available from (date picker)
- Nearest coaching hub (Allen / Resonance / FIITJEE / Vibrant / Motion)

### Coaching Hub Proximity (Kota-Specific — Very Important)
- Students search by distance from their coaching institute
- nearest_coaching_hub field on properties (already in schema above)
- This is a major search filter
- SEO pages must target these exact combinations:
  "hostel near Allen Kota"
  "PG near Resonance Kota"
  "room near FIITJEE Kota"
  "2BHK near Vibrant Academy Kota"

### Student-Specific UX Rules
- Price must show per month clearly — never annual, never total
- Deposit amount must show upfront — hidden deposits kill trust
- "Available from" date always visible on property card
- Distance from coaching shown on property card if available
- Photos of room + bathroom + kitchen more important than exterior
- All UI mobile-only mindset — students are always on phone

### Sale Properties
- Not the focus right now but do not remove sale functionality
- listing_type field handles this — keep it in schema
- Sale listings can exist in DB, just not featured prominently in phase 1

### Never Do These for Rental
- Do not show annual rent anywhere — always monthly
- Do not hide deposit amount — always show next to rent
- Do not skip gender_preference field — legally and socially critical
- Do not mix hostel and flat without clear type label in search results

---

## Immediate Priority Order (Work in This Order Only)
1. ✅ Leads → Supabase end-to-end (kill localStorage for leads completely)
2. ✅ OTP verification flow for lead gateway (WhatsApp via MSG91 — not Supabase phone auth)
3. ✅ Verified-device flow + lead dedup (added 2026-07-18, see CONTINUATION.md)
4. ✅ Magic link system (/api/deal/[token]/[action])
5. ✅ Admin dashboard — leads, properties, area requests, wallets
6. ✅ Post-a-property form (standard + hostel wizard, dealer submits → Bhavya approves)
7. ✅ Wallet billing infrastructure — built, inert behind `BILLING_ENABLED`
8. Dealer OTP login (currently phone-only, deferred on purpose) + dealer new-lead
   WhatsApp alert (code is correct, no MSG91 template created yet)
9. Billing flip (needs 2 more MSG91 templates approved first — see CONTINUATION.md)
10. Hostel-collection SEO/homepage roadmap (docs/audit/PLAN.md) — not started
11. AI chatbot upgrade (Claude API, Hindi + English both)

Do not work on item N+1 until item N is working and tested on mobile.

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # anon/public key — safe in browser
SUPABASE_SERVICE_ROLE_KEY=              # server only — never in client code

# MSG91 — customer OTP + dealer notifications, both over WhatsApp (single provider)
MSG91_AUTH_KEY=                         # server only — never in client code
MSG91_OTP_WHATSAPP_TEMPLATE_ID=         # Meta Authentication template w/ Copy Code button
MSG91_WHATSAPP_NAMESPACE=               # WABA namespace (shared by all templates on the account)
MSG91_OTP_TEMPLATE_ID=                  # DEPRECATED — old SMS/DLT template, unread
MSG91_WHATSAPP_TEMPLATE_ID=             # Dealer new-lead alert template name
MSG91_WHATSAPP_NUMBER=                  # WhatsApp sender number registered in MSG91
MSG91_LOW_BALANCE_TEMPLATE_ID=          # Owner low-balance alert (needed at billing flip)
MSG91_CONTACT_DELIVERY_TEMPLATE_ID=     # Customer contact-delivery on release (billing flip)

# Customer verified-device cookie (separate from DEALER_SESSION_SECRET so
# rotating one never invalidates the other)
PHONE_VERIFY_SECRET=                    # server only — openssl rand -hex 32

# Wallet / pay-per-lead billing — flip is BILLING_ENABLED alone, no code change
BILLING_ENABLED=                        # "true" to charge wallets; unset = free phase
LEAD_PRICE_PAISE=2500                   # ₹25/lead
FREE_LEADS_PER_DEALER=5                 # evergreen free-leads-on-signup offer
NEXT_PUBLIC_UPI_VPA=                    # manual top-up UPI id, e.g. prop100@upi
NEXT_PUBLIC_CONCIERGE_WHATSAPP=         # Bhavya's WhatsApp — "I've paid" + customer fallback

# App URL (for magic links in dealer WhatsApp)
NEXT_PUBLIC_APP_URL=                    # e.g. https://kotaproperty.in
```

Rules:
- `NEXT_PUBLIC_*` vars are safe in browser. Everything else is server-only.
- No Twilio vars anywhere in this project — Twilio is not used.
- MSG91 auth key must never appear in any client component or `NEXT_PUBLIC_*` var.
- `charge_lead` / `credit_wallet` are Postgres RPCs REVOKEd from anon —
  never call them from client code, only from server routes with the
  service-role client.

---

## Supabase Idle Prevention
- Free tier pauses after ~1 week idle
- Add a Vercel cron job that pings Supabase every 5 days
- File: app/api/cron/ping/route.ts
- Add to vercel.json:
  { "crons": [{ "path": "/api/cron/ping", 
  "schedule": "0 0 */5 * *" }] }

---

## Never Do These (Hard Rules)
- Do not use any paid external service without asking Bhavya first
- Do not install packages without checking bundle size impact
- Do not create demo/test/placeholder files and leave them in repo
- Do not hardcode any phone numbers, API keys, or credentials
- Do not change the slug of any existing property ever
- Do not add console.log in any file that goes to production
- Do not assume a feature is obvious — if not in this file or
  explicitly requested, ask first
- Do not work on two things at once — one task, fully done, then next

---

## When Unsure — Always Do This
1. Stop
2. Tell Bhavya exactly what you're unsure about
3. Wait for instruction
4. Never guess on: schema changes, auth logic, RLS policies,
   API route design, or anything touching leads/dealer data/money
