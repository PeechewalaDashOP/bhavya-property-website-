# MIGRATION — extend `properties` or create `hostels` fresh?

**Verdict: EXTEND. Do not create `hostels`/`room_types`.** The 30-min spike 04 asked for is
done; here is the reasoning from the actual schema.

## The decision rule from 04

> "Extend the existing `properties` table if enum surgery is cheap; else create `hostels`
> fresh … decide by reading the current schema, not by preference."

## Fact 1 — there are no enums to surgically alter [OBSERVED]

`properties` uses `text` columns with `CHECK` constraints, not Postgres enums
[OBSERVED schema.sql:39, 68, 70, 78-80]. Check constraints are the cheap case: drop + re-add
is one `ALTER TABLE`, no type migration, no table rewrite. The expensive scenario 04 hedged
against does not exist.

## Fact 2 — the spec's two-table model already exists under other names [OBSERVED]

| 04 spec | Already in prod schema |
|---|---|
| `hostels` (building) | `properties` + `hostel_meta` JSONB |
| `room_types` (price matrix) | `property_units` (label, capacity, price_per_month, has_ac, attached_bath, meals_included, available_count, attributes JSONB, unit_photos, last_confirmed_at) |
| `room_types.price_includes_mess` | `property_units.meals_included` (capture-side fix needed, see BLOCKERS 3) |
| `availability_confirmed_at` + nudge | `property_units.last_confirmed_at` + `/api/cron/nudge` (already per-unit — finer than spec) |
| `leads.room_type_id` | `leads.unit_id` + denormalised `unit_label` |
| owner_name/phone/whatsapp | a `dealers` row per owner (auto-create pattern live in `/api/public/post-property`) |
| `areas` | `areas` + `localities` (slug, hindi-capable name, status, lat/lng) |

## Fact 3 — the entire application stack points at `properties` [OBSERVED]

RLS policies, the lead gateway (`/api/leads`, `/api/otp/verify`), magic links, the admin
dashboard, the dealer dashboard + availability flow, the nudge cron, the variant selector on
the detail page, every SEO page (`/kota/*`, `/near/*`, `/nearby`, `/map`), sitemap helpers,
and the sample-data fallback all query `properties` / `property_units`. A fresh `hostels`
table means forking or rewriting every one of those for a solo dev — weeks of pure migration
work producing zero user-visible improvement, plus a permanent two-schema maintenance tax on
the buy/plot legacy you're explicitly de-emphasising, not deleting (03 §D10). That is the
"grand unified rebuild" 04 tells you not to attempt, just inverted.

## What EXTEND means concretely (one additive migration, ~1–2 h to write)

```sql
-- properties: hostel-launch additions (all additive, all nullable/defaulted — zero breakage)
alter table properties
  add column if not exists verified_at date,                      -- "visited by prop100 {date}" badge (03 §D8)
  add column if not exists availability_status text
    check (availability_status in ('available_now','filling_fast','full')), -- 03 §D9
  add column if not exists notes_internal text;                   -- never rendered (04)

-- campuses: net-new reference table, nothing depends on it yet (03 §D2, seed ~10 rows by hand)
create table if not exists campuses (
  id bigserial primary key,
  institute text not null,
  campus_name text not null,
  display_name text not null,
  area_text text,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  active boolean not null default true
);
```

Everything else the spec wants lands in existing structures, no DDL:
- `electricity`, `mess: included/optional/none`, `mess_cost`, `mess_type` → keys in
  `hostel_meta` JSONB (it's already the designated home for hostel-only fields
  [OBSERVED migration_hostel_meta.sql comment]). Promote to real columns later **only if**
  you need to filter on them in SQL — mess-included filtering can use the existing
  `meals_included` boolean.
- Per-room mess flag → `property_units.meals_included` (capture fix, BLOCKERS 3).
- Owner phone → owner-dealer row (BLOCKERS 4).
- `hostel_card_v` (min price, photo/video counts, nearest-2-campus walk-mins) → create as a
  view over `properties` + `property_units` + `campuses` when you build the card (PLAN 4).
  At ≤200 listings Haversine at query time is fine, exactly as 03 §D2 says.

## Naming dissonance — accept it

`properties` ≠ `hostels`, `property_units` ≠ `room_types`, `dealers` holds owners,
`gender_preference` says `any` instead of `coed`. This costs you a few seconds of mental
translation per coding session. Renaming costs a full-stack refactor plus RLS/policy churn on
a live site. Hostels pay the bills first (04's own closing line) — take the ugly names.

## The one thing NOT to extend

Don't try to make the buy/sale legacy share the new hostel display components. Legacy pages
keep reading the columns they already read; hostel surfaces read `hostel_meta` + units.
The tables are shared; the UI paths stay separate (03 §D10 demotes buy to a footer line).
