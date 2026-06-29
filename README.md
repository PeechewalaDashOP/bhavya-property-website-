# KotaProperty — Next.js + TypeScript + Tailwind + Supabase + Vercel

The exact KotaProperty website, rebuilt on a production stack. **The UI is pixel-identical** to the prototype: the original CSS is carried verbatim into `app/globals.css`, and the components reuse the same class names and markup. Tailwind is installed (per the stack) with its CSS reset **disabled** so it can't alter the hand-built design.

```
Next.js (App Router, SSR for SEO)
   └─ TypeScript
       └─ Tailwind CSS (utilities available; preflight off)
           └─ Supabase (PostgreSQL + Auth + Storage)   ← data + leads
               └─ Vercel (hosting)
```

## Run it locally

```bash
npm install
npm run dev
# http://localhost:3000
```

It runs immediately on built-in **sample data** (identical to the prototype) — no Supabase needed to see the site.

## Connect Supabase (real data)

1. Create a project at supabase.com.
2. SQL editor → run `supabase/schema.sql` (tables + RLS).
3. Copy `.env.local.example` → `.env.local` and fill:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Seed the same demo data (optional):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  node scripts/seed.mjs
   ```
   The site now reads `properties`, `dealers`, `areas` from Supabase. Enquiries from the lead gateway, footer form and chatbot are inserted into `leads`.

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo at vercel.com.
3. Add the two `NEXT_PUBLIC_SUPABASE_*` env vars.
4. Deploy. You get a free `*.vercel.app` URL; add a custom domain later.

## Project map

```
app/
  layout.tsx        SEO metadata, fonts, global CSS
  page.tsx          Server Component — fetches data, SSR for SEO
  globals.css       EXACT original styles (verbatim) + Tailwind directives
components/
  SiteClient.tsx    Full interactive UI (search, filters, view-more,
                    lead gateway, deal tracker, AI chatbot)
lib/
  types.ts          Property / Dealer / Area / Lead
  format.ts         price formatter (identical)
  sampleData.ts     seeded sample dataset (identical to prototype)
  supabase.ts       Supabase client
  getData.ts        server fetch (Supabase → sample fallback) + saveLead
supabase/
  schema.sql        tables + RLS policies
scripts/
  seed.mjs          load sample data into Supabase
```

## What carried over 1:1
Header + mobile menu, hero search (Buy/Rent/PG/Plots/Commercial), explore-by-area,
filters (BHK, furnishing, sort, Verified, Near-coaching), **view-more pagination**,
dealers, why-us, process, about, footer enquiry form, property modal with the
**lead-gated contact reveal**, the **deal tracker**, and the **AI chatbot** — all
identical, now data-driven and SEO-rendered.

## Production notes (next steps)
- **Auth/Storage:** add Supabase Auth for a dealer/admin login and Supabase Storage
  (or Cloudinary) for photo uploads on a "Post property" page.
- **Leads:** the deal tracker currently reads from the browser for the demo; point it
  at the `leads` table with an admin-only (service-role) route for real oversight.
- **Images:** swap `<img>` for `next/image` if you want automatic optimization
  (kept as `<img>` here to guarantee identical markup).
