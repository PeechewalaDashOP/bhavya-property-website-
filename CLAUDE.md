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

## Where we stopped (current status)
DONE: full UI ported 1:1; SSR for SEO; Supabase wiring with sample-data fallback;
schema + seed script; lead gateway (localStorage for demo); deal tracker (localStorage);
rule-based AI chatbot; "view more" pagination.

NOT yet done (pick up here):
1. **Leads to Supabase end-to-end.** `saveLead()` inserts to `leads`, but the deal
   tracker still reads from localStorage. Wire it to read/update the `leads` table
   behind an admin-only (service-role) route or RLS by role.
2. **Dealer/Admin auth.** Add Supabase Auth so dealers log in, accept leads, update
   status; admin oversees. (Port logic from ../kota-simple/system.html.)
3. **Post-a-property page.** Form + photo upload to Supabase Storage (or Cloudinary),
   writes to `properties`, goes live after admin approval.
4. **Real images** — replace Unsplash sample URLs with dealer-uploaded photos.
5. **Optional polish:** light Framer Motion micro-interactions ONLY (no 3D/WebGL).
   Keep it fast — mobile LCP < 2.5s. (Owner decided AGAINST heavy 3D animation.)
6. **SEO depth:** per-locality landing pages (e.g. /kota/talwandi) + sitemap for
   "2 BHK Talwandi Kota" style queries.

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
- customer_phone (verified via OTP)
- property_id (FK to properties)
- dealer_id (FK to dealers) — denormalized for query speed
- status: 'new' | 'contacted' | 'closed' | 'dead'
- source_url — which page the lead came from
- magic_token — uuid, for magic link actions without login
- reference_code — format KP-XXXX, auto generated server side
- move_in_date (date, nullable)
- occupants (integer, nullable)
- contacted_at (timestamp, nullable)
- closed_at (timestamp, nullable)
- created_at (timestamp, auto)

### dealers table
- phone — primary identifier
- whatsapp_number — may differ from phone number
- areas_covered (array of area_ids)
- is_active (boolean, default true)

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
2. ✅ OTP verification flow for lead gateway (MSG91 direct — not Supabase phone auth)
3. ✅ WhatsApp notification to dealer on new lead (MSG91)
4. ✅ Magic link system (/api/deal/[token]/[action])
5. Admin dashboard — leads view + property management
6. Dealer OTP login + single-page dealer dashboard
7. Post-a-property form (dealer submits → Bhavya approves)
8. SEO — sitemap.xml + OG tags per property + locality pages
9. AI chatbot upgrade (Claude API, Hindi + English both)

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
MSG91_OTP_TEMPLATE_ID=                  # DEPRECATED — old SMS/DLT template, unread
MSG91_WHATSAPP_TEMPLATE_ID=             # Dealer new-lead alert template name
MSG91_WHATSAPP_NUMBER=                  # WhatsApp sender number registered in MSG91

# App URL (for magic links in dealer WhatsApp)
NEXT_PUBLIC_APP_URL=                    # e.g. https://kotaproperty.in
```

Rules:
- `NEXT_PUBLIC_*` vars are safe in browser. Everything else is server-only.
- No Twilio vars anywhere in this project — Twilio is not used.
- MSG91 auth key must never appear in any client component or `NEXT_PUBLIC_*` var.

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
