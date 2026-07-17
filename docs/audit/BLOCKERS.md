# BLOCKERS — must exist BEFORE door-to-door collection starts

> **STATUS 2026-07-17:** Items 2–5 are implemented in code (GPS capture, owner contact →
> lead routing, per-room mess toggle, electricity field). Deploy, then items 1 (run SQL)
> and 6 (phone dry run) remain — both are yours, ~90 min total.

Test: "If I collect 10 hostels tomorrow without this, do I have to physically go back?"
Everything that fails that test is here. Everything else is in PLAN.md.

Good news [OBSERVED]: you are **much** closer than the research docs assume. A 4-step
mobile hostel intake wizard already exists at `/dealer/post/hostel` (Step1Core → Step2Rooms →
Step3Amenities → Step4Media) with per-room-type pricing, deposit, curfew (gate timing),
amenity checklists, owner/manager/agent selector, photo tagging + cover selection, signed-URL
photo/video upload with progress bar, ≥1 video enforced, and draft autosave. You do NOT need
to build `/collect` from scratch — you need to patch this wizard.

---

## 1. Run the pending SQL on prod Supabase — or every submission 500s ⏱ ~30 min

The wizard's submit payload writes `attributes` on every unit (`HostelFlow.tsx:192`) and the
insert route writes it too (`app/api/dealer/property/route.ts`). Those columns
(`attributes`, `unit_photos`, `last_confirmed_at` on `property_units`) come from the
"MIGRATION M1" block at the bottom of `supabase/schema.sql` — and per project status,
**the SQL scripts for the variant feature have not been run on prod yet** [INFERRED from
project notes; verify in Supabase dashboard]. If the column is missing, every field
submission fails at the final step, after you've stood in a doorway for 10 minutes.

Do: run M1 block of `supabase/schema.sql`, then `scripts/backfill-attributes.sql` and
`scripts/backfill-unit-rows.sql`. Also verify the `localities` table exists — the wizard's
area dropdown reads it (`lib/queries/localities.ts`) but **no migration for it exists in the
repo** [OBSERVED absence — it was likely created directly in the SQL editor; confirm].

## 2. GPS capture in the wizard ⏱ ~1–2 h

`properties.lat/lng` columns exist [OBSERVED schema.sql:83-85], and 04-LISTING-SCHEMA calls
GPS "the hardest schema field, one tap in the doorway" — but the hostel wizard never captures
or submits lat/lng [OBSERVED: no geolocation code in `app/dealer/post/`, no lat/lng in the
`HostelFlow.tsx` submit payload]. Without it, every walk-minutes feature (the core
differentiator, 03 §D2) requires a revisit to every hostel.

Do: add a "📍 Capture location" button to Step1Core; the exact `navigator.geolocation`
pattern already exists in `app/nearby/NearbyClient.tsx:106-120` — copy it. Pass lat/lng
through the submit payload and the insert route (route already inserts into `properties`,
just add the two fields).

## 3. Per-room "price includes mess?" toggle ⏱ ~1–2 h

04-LISTING-SCHEMA: `price_includes_mess` "kills the #1 comparison ambiguity" — it must be
asked per price, at the doorway. Today the wizard asks one building-level "food provided?"
(`form.foodProvided`) and copies it into `meals_included` on **every** unit
[OBSERVED HostelFlow.tsx:190]. The per-unit DB column already exists
[OBSERVED schema.sql:113] — only the UI is missing. If you collect without this, you'd have
to phone every owner back to disambiguate every price.

Do: add a "Mess included in this rent? Y/N" toggle per room row in `Step2Rooms.tsx`, wire it
to each unit's `meals_included` instead of `form.foodProvided`.

## 4. Owner phone → lead routing ⏱ ~2–3 h

The wizard attaches the listing to the **logged-in dealer** — if you collect under your own
dealer login, every lead from every hostel routes to *your* phone forever, and the owner's
number is never stored anywhere [OBSERVED: `HostelFlow.tsx` payload has no owner phone;
`hostel_meta` has `user_type` but no phone]. Owner phone is the lead target (04: `owner_phone`
required; 03 §D6). Recoverable only by re-contacting every owner.

Do (cheapest path): add "Owner name + phone + WhatsApp? Y/N" fields to Step1 and, on submit,
find-or-create a dealer row for that phone — this exact find-or-create logic already exists
in `app/api/public/post-property/route.ts:55-84`; copy it into the dealer property route
(or gate it to your admin phone). Note: dealer login is currently phone-only, no OTP
(`/api/dealer/login/direct` [OBSERVED]) — insert your own row in `dealers` and you're in.

## 5. Electricity field ⏱ ~30 min

`electricity: included / metered / fixed` — required in 04 ("top-3 parent dispute topic"),
captured **nowhere** in schema or wizard [OBSERVED: zero grep hits for "electricity" in the
codebase]. One more question you'd otherwise have to re-ask 100 times.

Do: add a 3-option toggle in Step2/Step3 and store it as a `hostel_meta.electricity` key —
no schema change needed (`hostel_meta` is JSONB).

## 6. Test the whole flow on your phone, on 4G, once ⏱ ~1 h

Submit one real dummy hostel from your phone on mobile data: login → wizard → GPS → 8 photos
+ 1 video upload → submit → appears in admin pending list → approve → renders on prop100.in.
This is 03's "Days 1–2" gate. Delete the dummy after.

---

## Explicitly NOT blockers (collect first, build after — data is already in the DB)

- Gender/budget/AC/mess **filters on the public site** — display-side, PLAN.md
- Hostel-first homepage, chips hero, walk-minutes display, ranking, SEO hubs — PLAN.md
- `campuses` table + seed — needed before *display* of walk-mins, not before collection
  (GPS capture is the blocker; campus pins can be seeded any evening)
- OTP re-enable — blocked externally on WhatsApp Business API approval anyway
- Mess type (veg/nonveg) & mess cost — nice; add to Step3 if time permits tomorrow morning,
  but `hostel_meta.house_rules` already captures veg_only [OBSERVED types.ts:97]

**Total: roughly one focused day.** Items 1 and 6 are non-negotiable; 2–4 are the one-way
doors; 5 is 30 minutes.
