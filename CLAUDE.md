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
