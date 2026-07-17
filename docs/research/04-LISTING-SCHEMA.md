# 04 — LISTING SCHEMA (standalone)

Model: **one listing = one building (hostel/PG); prices live in child `room_types` rows** — the
building-level + price-matrix decision confirmed with Bhavya. Card shows "₹{min} se shuru"; budget filter
matches if ANY room type is in band.

Collection-difficulty key (minutes of doorway effort): 🟢 trivial · 🟡 needs asking/counting · 🔴 hard or
owner-sensitive. Anything 🔴 is optional or deferred.

---

## Table: `hostels`

| Column | Type | Req | Diff | Notes |
|---|---|---|---|---|
| id | uuid pk default gen_random_uuid() | ✔ | — | |
| slug | text unique | ✔ | 🟢 | generated: name-area-4char |
| name | text | ✔ | 🟢 | as painted on the board outside |
| type | enum `hostel,pg,room` | ✔ | 🟢 | your judgement, don't ask the owner |
| gender | enum `boys,girls,coed` | ✔ | 🟢 | coed = rare; separate wings still = coed |
| area_slug | text fk→areas | ✔ | 🟢 | rajeev-gandhi-nagar / talwandi |
| address_text | text | ✔ | 🟢 | plot no + street, as spoken |
| landmark_text | text | ○ | 🟢 | "City Mall ke peeche" — display gold |
| lat, lng | numeric(9,6) | ✔ | 🟢 | **one tap GPS on your phone in the doorway** |
| total_rooms | int | ○ | 🟡 | approx ok; card copy "45-room hostel" |
| mess | enum `included,optional,none` | ✔ | 🟢 | |
| mess_type | enum `veg,veg_nonveg` | ○ | 🟢 | ask only if mess ≠ none |
| mess_cost | int ₹/mo | ○ | 🟡 | ask only if mess = optional |
| deposit | int ₹ | ✔ | 🟢 | 0 is a valid, advertisable answer |
| electricity | enum `included,metered,fixed` | ✔ | 🟢 | top-3 parent dispute topic |
| curfew_time | time null | ○ | 🟢 | null = no curfew; NoBroker shows "gate closing time" [OBSERVED] |
| amenities | jsonb | ✔ | 🟢 | fixed 12-key checklist, see below |
| availability_status | enum `available_now,filling_fast,full` | ✔ | 🟢 | seasonality v1 (03 §D9) |
| owner_name | text | ✔ | 🟢 | |
| owner_phone | text | ✔ | 🟢 | E.164; the lead target |
| owner_has_whatsapp | bool | ✔ | 🟢 | decides lead channel |
| lister_type | enum `owner,manager,agent` | ✔ | 🟢 | **immutable after insert** (existing policy) |
| description | text | ○ | 🟡 | 2 lines you write on-site; never owner-dictated marketing |
| notes_internal | text | ○ | 🟢 | never rendered; "gate ka kutta katta hai" |
| status | enum `draft,live,paused,delisted` | ✔ | — | collect as draft, publish after photo QC |
| verified_at | date | ✔ | — | your visit date → "visited by prop100" badge |
| availability_confirmed_at | timestamptz | ✔ | — | updated by 15-day nudge loop; drives ranking freshness |
| created_at / updated_at | timestamptz | ✔ | — | |

**amenities jsonb — fixed checklist, no free keys:**
`wifi, ro_water, power_backup, cctv, warden, laundry, cleaning_daily, attached_bath_any, cooler, fridge_common, parking, study_table` (bool each). Attached-bath ALSO lives per-room-type; this key is the building-level "any".

## Table: `room_types` (the price matrix — the scanned menu)

| Column | Type | Req | Diff | Notes |
|---|---|---|---|---|
| id | uuid pk | ✔ | — | |
| hostel_id | uuid fk cascade | ✔ | — | |
| occupancy | enum `single,double,triple,four_plus` | ✔ | 🟢 | |
| ac | bool | ✔ | 🟢 | |
| attached_bathroom | bool | ✔ | 🟢 | |
| price_monthly | int ₹ | ✔ | 🟡 | the ASKING price; note if nego |
| price_includes_mess | bool | ✔ | 🟢 | Kota quoting is inconsistent — normalise HERE, this column kills the #1 comparison ambiguity |
| available | bool | ✔ | 🟢 | per-type availability, coarse |
| notes | text | ○ | 🟢 | "balcony wala", "ground floor" |

Typical hostel = 2–6 rows. UNIQUE(hostel_id, occupancy, ac, attached_bathroom).

## Table: `campuses` (seed by hand, ~10 rows — list in 03 §D2)
`id, institute, campus_name, display_name, area_text, lat, lng, active`

## Table: `areas` (2 rows at launch)
`slug pk, name, name_hindi, live bool` — nothing "coming soon" ships to UI.

## Table: `leads` (the business — see 03 §D6)
`id, hostel_id fk, room_type_id fk null, seeker_phone, channel enum(whatsapp,call,callback,concierge), created_at`
RLS: insert via server action only; select = you.

## Views
`hostel_card_v`: hostel + min/max price, photo/video counts, nearest-2 campus walk-mins (Haversine at
query time — 200×10 pairs, no cache, no PostGIS).

## Media
Existing Supabase Storage flow stands: **≥8 photos + ≥1 video (existing rule) per listing**, ordered,
lead photo first. Path `hostels/{id}/{seq}.webp`; compress client-side before upload (4G doorway).

## Deferred to v2 (do not collect, do not build columns)
per-bed vacancy counts · floor plans · min-stay/notice · owner bank/KYC · reviews · occupancy history ·
electricity per-unit rate · food menu · nearby-mess mapping · multi-video

## Brownfield migration note
Extend the existing `properties` table if enum surgery is cheap; else create `hostels` fresh and leave
`properties` for the buy/plot legacy — **decide by reading the current schema, not by preference; 30-min
spike, then commit.** Do not attempt a grand unified property model; hostels pay the bills first.
