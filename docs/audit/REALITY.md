# REALITY — what exists today vs 04-LISTING-SCHEMA

Tags: [OBSERVED] = read in this repo's code/SQL. [INFERRED] = deduced, not directly read.
Caveat: this audit reads the repo, not the live Supabase instance. Repo SQL and prod DB are
known to drift (variant-feature scripts written but not yet run [INFERRED from project notes]).

## The five direct answers

**1. Does a `/collect` route exist?**
No — there is no `app/collect/` [OBSERVED]. But its functional equivalent exists:
`/dealer/post/hostel`, a 4-step mobile wizard (Core Details → Rooms & Rules → Amenities →
Media & Review) [OBSERVED app/dealer/post/hostel/]. It is auth-gated by a dealer bearer token
(`prop100_dealer_token` in localStorage), issued by `/api/dealer/login/direct` — currently
**phone-number-only login, no OTP** ("Temporary direct login — OTP disabled until WhatsApp
Business API is approved" [OBSERVED route comment]). Gaps vs the 05-FIELD-CAPTURE spec:
no GPS capture, no owner-phone field, no per-room mess flag, no electricity field
(see BLOCKERS.md).

**2. Do `hostels` and `room_types` tables exist, or only `properties`?**
Neither `hostels` nor `room_types` exists [OBSERVED — all SQL in supabase/]. What exists:
- `properties` — one row per building, with hostel fields bolted on: `gender_preference`,
  `meals_included`, `deposit_amount`, `rent_per_month`, `lat`, `lng`, `videos`,
  `nearest_coaching_hub`, plus a `hostel_meta` JSONB column (curfew/gate time, landmark,
  owner/manager/agent, services, house rules, USP, photo tags) [OBSERVED schema.sql +
  migration_hostel_meta.sql].
- `property_units` — one row per room type under a property: `label`, `capacity`,
  `price_per_month`, `deposit_amount`, `has_ac`, `attached_bath`, `meals_included`,
  `available_count`, and (M1 migration) `attributes` JSONB (occupancy/cooling),
  `unit_photos`, `last_confirmed_at` [OBSERVED schema.sql:101-117, 203-209].
So the spec's two-table model **already exists in substance** under different names.
See MIGRATION.md for the extend-vs-fresh verdict.

**3. Is the budget filter monthly rent or lakh-based sale price?**
Both, switched by tab — and the homepage **defaults to the sale tab** (`useState<Tab>("sale")`
[OBSERVED SiteClient.tsx:71]). Rent tab: monthly ceilings "Under ₹8k / ₹12k / ₹18k / ₹25k /
₹40k"; sale tab: "Under ₹20 L … ₹1 Cr" [OBSERVED SiteClient.tsx:170-173]. So a hostel-seeker
who lands on the homepage sees lakh-based buy filters first. The rent values are also
ceiling-style dropdowns, not the spec's ≤6k / 6–9k / 9–12k / 12k+ chip bands, and they filter
on the building's headline `price` (cheapest room), not "ANY room type in band" (03 §D1/D3).

**4. Is there a gender filter (boys/girls/coed)?**
No filter anywhere in the public UI [OBSERVED — SiteClient's filter pipeline is tab, locality,
ptype, budget, BHK, furnishing, verified, coaching: lines 176-195; no gender]. The **data**
exists: `properties.gender_preference` (`boys|girls|any`) [OBSERVED schema.sql:70], captured
by both post flows, and displayed as a "Boys Only / Girls Only" badge on the detail page
[OBSERVED PropertyDetail.tsx:702-705, 1013-1017]. Spec wants a first-class Boys|Girls toggle
(03 §D3) — pure frontend work, data is ready. (Spec says `coed`; DB says `any` — same
semantics, keep `any`.)

**5. Is `price_includes_mess` stored and shown anywhere?**
Column-wise: yes in substance — `property_units.meals_included` is exactly per-room-type
mess-in-price [OBSERVED schema.sql:113]. But it is **never captured per room**: the hostel
wizard copies one building-level `foodProvided` flag into every unit
[OBSERVED HostelFlow.tsx:190]. Display: only the building-level badge "🍽️ Meals Included"
on the detail page [OBSERVED PropertyDetail.tsx:708, 1050]; the per-unit value is not
rendered next to the per-unit price. So the #1 comparison ambiguity the spec targets is
currently NOT resolved — the field exists, the semantics don't.

## Gap table — 04-LISTING-SCHEMA vs today

| Spec (04) | Exists today? | Where / gap |
|---|---|---|
| `hostels` table | ≈ | `properties` + `hostel_meta` JSONB [OBSERVED] |
| `room_types` table | ≈ | `property_units` (+ M1 `attributes`) [OBSERVED] |
| slug (name-area-4char) | Partial | `slug` unique on properties [OBSERVED]; format is ptype-bhk-loc, not name-based [OBSERVED post-property route makeSlug] |
| type hostel/pg/room | ✅ | `ptype` text: Hostel / PG / … [OBSERVED] |
| gender boys/girls/coed | ✅ data, ❌ filter | `gender_preference` boys/girls/any [OBSERVED] |
| area_slug fk → areas | ≈ | `loc` fk → `areas(name)` + `locality_id` → `localities` (table absent from repo SQL — verify in prod) [OBSERVED code / INFERRED db] |
| address, landmark | ✅ | `hostel_meta.address`, `.landmark` [OBSERVED] |
| lat/lng one-tap GPS | ❌ capture | columns exist [OBSERVED schema.sql:83-85]; wizard never sets them — **BLOCKER 2** |
| total_rooms | ≈ | per-unit `total_count`; building total derivable [OBSERVED] |
| mess included/optional/none | Partial | boolean `meals_included` + `hostel_meta.food_provided`; no "optional + ₹cost" state [OBSERVED] |
| mess_type veg/nonveg | Partial | `house_rules: veg_only` [OBSERVED types.ts:97] |
| deposit (0 valid) | ✅ | per-unit + building [OBSERVED] |
| electricity incl/metered/fixed | ❌ | zero hits in codebase — **BLOCKER 5** |
| curfew_time | ✅ | `hostel_meta.gate_timing_enabled/gate_closing_time` [OBSERVED] |
| amenities 12-key jsonb | ≈ | `hostel_meta.common_amenities[]` + `services[]` (string arrays, different key set) [OBSERVED]. `PropertyFull.amenities` typed in types.ts:155 but no DB migration in repo [OBSERVED absence] |
| availability_status enum | ❌ | `property_status` (available/sold/rented) + per-unit `available_count`; no filling_fast/full-next-batch [OBSERVED] |
| owner_name / owner_phone / whatsapp | Partial | modeled as a `dealers` row (public post flow auto-creates owner-dealers [OBSERVED post-property route:55-84]); hostel wizard doesn't capture it — **BLOCKER 4** |
| lister_type immutable | ✅ capture | `hostel_meta.user_type` owner/manager/agent [OBSERVED]; immutability not enforced [INFERRED] |
| description (your words) | ✅ | `description` + auto-generated suggestion in Step3 [OBSERVED] |
| notes_internal | ❌ | nothing never-rendered exists |
| status draft→live | ✅ | `listing_status` pending/live/paused_owner/paused_admin/rejected + `is_approved` gate + `property_drafts` resume [OBSERVED migration_listing_lifecycle.sql] |
| verified_at date | Partial | `is_verified` boolean only [OBSERVED] |
| availability_confirmed_at + 15-day nudge | ✅ mostly | `property_units.last_confirmed_at` + `/api/cron/nudge` (15-day stale query, WhatsApp via MSG91) [OBSERVED] — needs `MSG91_NUDGE_TEMPLATE_ID` + `CRON_SECRET` env (pending) [INFERRED from project notes] |
| `campuses` table (~10 pins) | ❌ | only `COACHING_HUBS` label list [OBSERVED lib/constants.ts:10]; `/near/[hub]` pages filter by label, not distance [OBSERVED near/[hub]/page.tsx:42] |
| `areas` 2-row live-only | ❌ | `areas` + `localities` incl. `coming_soon` status still shown ("Coming Soon" in dropdown [OBSERVED SiteClient.tsx:489]) — spec deletes this |
| `leads` table | ✅ | richer than spec: ref codes, magic tokens, unit_id, statuses [OBSERVED] |
| `hostel_card_v` view (min price, walk-mins) | ❌ | Haversine exists client-side twice (PropertyDetail.tsx:17, NearbyClient.tsx:34) [OBSERVED]; no view, no walk-minutes anywhere |
| Media ≥8 photos + ≥1 video | Partial | ≥1 video enforced [OBSERVED HostelFlow.tsx:111]; no ≥8 photo minimum [OBSERVED validate.ts] |

## Also live today, not in the spec's mental model

- Full admin dashboard (leads, properties approval, requests) [OBSERVED app/admin/]
- Dealer dashboard + availability confirm page (`/dealer/availability`) [OBSERVED]
- Magic-link dealer actions `/api/deal/[token]/[action]` [OBSERVED]
- OTP infra built but bypassed in lead gateway (SiteClient.tsx:224 comment) and dealer
  login — both marked "until WhatsApp Business API approved" [OBSERVED]
- Room-variant chip selector on detail page (attributes-driven) [OBSERVED PropertyDetail.tsx:446-531]
- SEO pages: `/kota/[slug]`, `/kota/[slug]/[subtype]`, `/near/[hub]`, `/near/[hub]/[type]`,
  `/nearby` (GPS), `/map` [OBSERVED app/]
- Gemini chatbot (`/api/chat`) — blocked on billing [OBSERVED route / INFERRED status]
