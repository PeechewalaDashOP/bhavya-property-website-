# Sale Module Architecture

Single source of truth for the "Post Property — For Sale" wizard and its data
model. Written before implementation began (per Bhavya's explicit request) so
the design is reviewable and stable before code exists. Update this file
whenever the Sale module's schema, API contracts, or flow structure change —
it should never drift from what's actually built.

Status as of this writing: **implemented, `tsc`/`next build` clean, verified
on the local dev server. Not yet live** — the 2 new SQL migration files
(`supabase/migration_sale_property_details.sql`,
`supabase/migration_amenities.sql`) still need to be run in the Supabase SQL
editor before real submissions/amenity fetches will work end-to-end (the
routes degrade gracefully — no crash — while the tables don't exist yet;
`/api/amenities` returns a clear error, the wizard shows "No amenities
configured for this property type yet."). See the checklist at the bottom.

---

## 1. Overview

The Sale module is a standalone 4-step property-posting wizard for
`purpose === "sale"` listings, living alongside (not replacing) the existing
Rent (`StandardFlow.tsx`) and PG/Hostel (`HostelFlow.tsx`) flows under
`app/dealer/post/`. It shares the same outer shell (`PostPropertyClient.tsx`
— identity/OTP gate, draft-resume banner, purpose selector) but is entirely
its own component tree, its own form-state type, and — the key departure
from every other part of this codebase — its own **normalized relational
schema** instead of the JSONB-blob pattern used everywhere else
(`hostel_meta`, flat `amenities` map).

Why normalized here specifically: Bhavya explicitly requested it, reasoning
that Sale/commercial listings need real typed, indexable, filterable fields
(plot type, facing, ownership, covered area, etc.) in a way the rest of the
app's JSONB approach doesn't give — and that the amenities system in
particular should be built as a **global, reusable module** from day one so
Hostel/Rent/PG can migrate onto it later without a redesign, even though they
keep using their existing JSONB approach for now.

---

## 2. Database Schema

### 2.1 `properties` (existing table — unchanged)

Sale listings use the same `properties` table as every other listing type.
Fields it already provides that Sale reuses as-is (no duplication in the new
tables): `id`, `dealer_id`, `type` (`'sale'`), `ptype`, `loc`, `locality_id`,
`title`, `price`, `sqft`, `description`, `img`, `gallery[]`, `videos[]`,
`bhk`, `baths`, `floor_number`, `total_floors`, `lat`, `lng`, `slug`,
`is_approved`, `is_featured`, `is_verified`, `listing_status`, `created_at`.

`sqft` is still populated (converted to sqft-equivalent) for search/filter
compatibility with the rest of the site, even though the wizard captures the
original value+unit in `sale_property_details.area_value`/`area_unit` for
accurate display.

### 2.2 `sale_property_details` (new — 1:1 with `properties`)

One row per sale listing. `property_id` is both the primary key and the
foreign key — this is a strict 1:1 extension table, not a 1:N one. Every
column is nullable except the two with explicit defaults; only the columns
relevant to the listing's `ptype` get populated, everything else stays
`NULL`. This is the intentional trade-off that keeps 8 very different
property types in one table without 8 separate join targets: cheap to
query/join, easy to add a column to later, no per-type table proliferation.

```sql
create table sale_property_details (
  property_id         bigint primary key references properties(id) on delete cascade,

  -- Location extras (beyond properties.loc / lat / lng)
  landmark             text,
  society_name         text,
  street_address       text,

  -- Flat / House / Builder Floor configuration
  balconies            int,
  house_floors         int,     -- "Floors" field, House type only

  -- Plot
  plot_type            text,    -- residential | commercial | agricultural | industrial

  -- Office
  cabins               int,
  meeting_rooms        int,
  office_washrooms     int,

  -- Shop
  shop_washroom        boolean,

  -- Warehouse / Godown
  covered_area         numeric,
  open_area            numeric,
  truck_access         boolean,
  loading_dock         boolean,

  -- Common additional attributes
  property_age         text,    -- new | 0-1 | 1-5 | 5-10 | 10+
  availability_status  text,    -- ready_to_move | under_construction
  possession_date       date,    -- only meaningful when availability_status = under_construction

  -- Pricing / area specifics
  price_negotiable      boolean not null default false,
  area_value             numeric,
  area_unit              text,   -- sqft | sqyard | sqm | acre | bigha

  -- Floor extras
  floor_special          text,   -- ground | basement | top | null

  -- Orientation & legal
  facing                 text,   -- N | S | E | W | NE | NW | SE | SW
  ownership_type          text,  -- freehold | leasehold | co_operative | power_of_attorney

  -- Parking
  parking_type             text, -- none | bike | car | both

  -- Who is posting (Step 4) — distinct from ownership_type above, which
  -- describes the property's legal title, not who's listing it.
  poster_role              text, -- owner | builder | broker

  -- Optional document uploads (Step 4, upload-only, not verified). JSONB is
  -- fine here — attachment metadata, never filtered/queried on, not what
  -- the "no JSONB for searchable business fields" rule protects against.
  documents                jsonb not null default '[]'::jsonb, -- [{doc_type, url}]

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table sale_property_details enable row level security;
create policy "public read sale_property_details" on sale_property_details
  for select using (
    exists (
      select 1 from properties
      where properties.id = sale_property_details.property_id
        and properties.is_approved = true
    )
  );
```

No insert/update/delete policy — all writes go through
`POST /api/dealer/property` (session-gated, service-role client), matching
every other write path in this app.

### 2.3 `amenities` (new — global, not Sale-specific)

The master list of every amenity the platform knows about, across every
property type. Deliberately generic so it isn't tied to Sale conceptually,
even though Sale is the first (and for now, only) consumer.

```sql
create table amenities (
  id                          bigserial primary key,
  key                         text not null unique,        -- stable machine key, e.g. "swimming_pool"
  label                       text not null,                -- display label, e.g. "Swimming Pool"
  icon                        text,                          -- icon identifier (see Icon component pattern in PropertyDetail.tsx)
  category                    text not null,                 -- residential | plot | commercial | universal
  applicable_property_types   text[] not null default '{}',  -- e.g. {Flat,House,"Builder Floor"}
  is_active                   boolean not null default true,
  sort_order                  int not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table amenities enable row level security;
create policy "public read amenities" on amenities for select using (true);
```

`category` is a coarse display/grouping label (for a future admin UI).
`applicable_property_types` is the **operative filter** the wizard actually
uses to decide which amenities to show for a selected `ptype` — a `text[]`
containment check (`applicable_property_types @> array[ptype]`), not a
separate mapping table, to keep this simple while still being genuinely
data-driven (new amenities can be added or reassigned to types via a plain
`UPDATE`, no code deploy).

### 2.4 `property_amenities` (new — junction table)

```sql
create table property_amenities (
  property_id   bigint not null references properties(id) on delete cascade,
  amenity_id    bigint not null references amenities(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (property_id, amenity_id)
);

alter table property_amenities enable row level security;
create policy "public read property_amenities" on property_amenities
  for select using (
    exists (
      select 1 from properties
      where properties.id = property_amenities.property_id
        and properties.is_approved = true
    )
  );
```

Plain many-to-many. A property has zero or more amenities; an amenity can
belong to many properties. No `sort_order`/metadata on the join row itself —
display order comes from the `amenities.sort_order` of the joined rows.

### 2.5 Seed data (`amenities` rows)

Seeded once, in the same migration, guarded by `where not exists (select 1
from amenities)` so the file is safe to re-run. Full seed list:

**Residential** (`applicable_property_types: {Flat,House,"Builder Floor"}`) —
Lift, Power Backup, 24x7 Water, CCTV, Security, Gas Pipeline, Garden,
Children Park, Gym, Club House, Swimming Pool, Visitor Parking, Rain Water
Harvesting, Temple Nearby, School Nearby, Hospital Nearby, Market Nearby,
Public Transport Nearby.

**Plot** (`{Plot}`) — Boundary Wall, Corner Plot, Park Facing, Gated Colony,
Electricity Available, Water Connection, Sewer Line, Road Access.

**Shop** (`{Shop}`) — Main Road Facing, Corner Shop, Washroom, Storage Area,
Parking, Lift, High Footfall.

**Office** (`{Office,Showroom}`) — Reception, Conference Room, Pantry,
Cabins, Workstations, Server Room, Visitor Parking, Power Backup, Lift.

**Warehouse** (`{"Warehouse-Godown"}`) — Loading Dock, Truck Entry, High
Ceiling, Open Yard, Fire Safety, Power Connection, Office Cabin, Security.

Every literal uses `$$...$$` dollar-quoting (see §12 — this was a real
incident this week with a different migration file: regular `'...'` string
literals with apostrophes got mangled by the Supabase SQL editor's
smart-quote autocorrect and broke the whole INSERT).

---

## 3. Entity Relationships

```
properties (1) ──────── (0..1) sale_property_details
    │                              (property_id is both PK and FK)
    │
    │ (1)
    │
    └──── (0..N) property_amenities (N) ──── (1) amenities
              (junction table, composite PK)
```

- A sale listing = exactly one `properties` row + exactly one
  `sale_property_details` row (created together, in the same request).
- Amenities are independent of Sale — the same `amenities`/
  `property_amenities` pair could later back Hostel/Rent/PG amenity
  selection too, without any schema change (see §11).
- Deleting a `properties` row cascades to both its `sale_property_details`
  row and all its `property_amenities` rows. Deleting an `amenities` row
  cascades to any `property_amenities` rows referencing it (removing that
  amenity from every property that had it selected) — this only matters if
  an amenity is ever hard-deleted; the `is_active` flag exists specifically
  so an amenity can be retired from new listings without deleting historical
  selections.

---

## 4. API Contracts

### 4.1 `GET /api/amenities?ptype=<PropertyType>`

Public (anon key), read-only. Returns every active amenity applicable to the
given `ptype`, ordered by `sort_order`:

```json
[
  { "id": 12, "key": "lift", "label": "Lift", "icon": "lift", "category": "residential" },
  { "id": 15, "key": "power_backup", "label": "Power Backup", "icon": "plug", "category": "residential" }
]
```

Query: `select id, key, label, icon, category from amenities where is_active
= true and applicable_property_types @> array[$ptype] order by sort_order`.
Powers Step 2's dynamic amenity-chip grid — the wizard never hardcodes an
amenity list in the frontend.

### 4.2 `POST /api/dealer/property` (existing route, extended)

Session-gated (`getDealerSession`), unchanged request/response shape for
Rent/PG. For `purpose === "sale"`, the request body additionally carries:

```ts
{
  // ...existing common fields (title, price, sqft, loc, description, photoPaths, videoPaths, etc.)
  saleDetails: {
    landmark?: string; societyName?: string; streetAddress?: string;
    balconies?: number; houseFloors?: number; plotType?: string;
    cabins?: number; meetingRooms?: number; officeWashrooms?: number;
    shopWashroom?: boolean; coveredArea?: number; openArea?: number;
    truckAccess?: boolean; loadingDock?: boolean; propertyAge?: string;
    availabilityStatus?: string; possessionDate?: string;
    priceNegotiable: boolean; areaValue?: number; areaUnit?: string;
    floorSpecial?: string; facing?: string; ownershipType?: string;
    parkingType?: string;
  };
  amenityKeys: string[]; // e.g. ["lift", "power_backup", "cctv"]
}
```

Server behavior, in order, inside one logical transaction (best-effort —
Supabase's JS client doesn't give cross-table transactions for free, so this
is sequential inserts with cleanup-on-failure, matching this route's existing
error-handling style rather than introducing a new pattern):

1. Insert into `properties` (as today) → get `property_id`.
2. Insert one row into `sale_property_details` with `property_id` +
   `saleDetails`.
3. Resolve `amenityKeys` → `amenity_id`s via `amenities` lookup, bulk-insert
   into `property_amenities`.
4. Best-effort delete the dealer's `property_drafts` row (as today).

If step 2 or 3 fails after step 1 succeeded, the route logs the error and
returns a clear failure to the client rather than silently leaving an
orphaned bare `properties` row — the wizard's submit handler should surface
this as "couldn't save your listing, please try again" rather than treating
it as success.

### 4.3 Reused, unmodified routes

- `POST /api/otp/send`, `POST /api/dealer/identify` — identity/OTP gate
  (§9).
- `GET/PUT/DELETE /api/dealer/draft` — autosave (§9).
- `POST /api/dealer/property/prepare-upload` — signed upload URLs (§10).

---

## 5. Validation Rules

| Field | Rule | Enforced |
|---|---|---|
| Property type | required, one of the 8 | client (step gate) + server |
| Area/locality | required | client + server |
| Price | required, positive number | client + server |
| Area value | required, positive number | client + server |
| Photos | minimum 1 (5 recommended), maximum 50 | client (step gate) + server (reject submit with 0) |
| Video | minimum 1, maximum 3 | client (step gate) + server |
| Phone | must be OTP-verified before wizard starts | already enforced by the identity gate (§9), not re-validated per-listing |
| Declaration checkbox | required, must be checked | client (step gate) |
| Type-specific required fields | vary — e.g. Plot requires `plot_type`, Warehouse requires `covered_area` | client (`validateSaleStepN` per §7) |

Server-side validation in `POST /api/dealer/property` re-checks price > 0,
area_value > 0, photo/video counts, and required-per-type fields — never
trusts the client alone, consistent with every other write path in this app.

---

## 6. Dynamic Field Visibility Rules

Driven entirely by the selected `ptype`, via small pure helper functions in
`app/dealer/post/sale/types.ts` (same pattern as the existing `needsBhk()`/
`needsFloor()` helpers in the shared `app/dealer/post/types.ts`):

| Field group | Flat | House | Builder Floor | Plot | Shop | Office/Showroom | Warehouse |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| BHK / Bathrooms / Balconies | ✅ | ✅ (as Bedrooms) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Floor Number / Total Floors | ✅ | ✅ (Floors) | ✅ | ❌ | ✅ | ✅ | ❌ |
| Plot Type | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Washroom / Parking (Y/N) | — | — | — | — | ✅ | — | — |
| Cabins / Meeting Rooms / Washrooms | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Covered/Open Area, Truck Access, Loading Dock | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Furnishing | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Facing / Ownership Type | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Amenities set shown | Residential | Residential | Residential | Plot | Shop | Office | Warehouse |

Never a flat one-size-fits-all form — every step's JSX conditionally renders
sections based on these helpers, and fields hidden for a type are never sent
in that submission's `saleDetails` payload (left `undefined` → stored `NULL`,
not defaulted to a fake value).

---

## 7. Media Flow

Reuses the exact upload mechanism already built for Rent/Hostel, unchanged:

1. Client picks files → `lib/imageCompress.ts::compressImages()` resizes any
   photo over 300KB to a 1600px-max-dimension JPEG at 0.72 quality (skips
   already-small files; falls back to the original on decode failure, e.g.
   HEIC). Video is size-validated only, never re-encoded (no ffmpeg.wasm —
   "no heavy libraries" rule).
2. `POST /api/dealer/property/prepare-upload` with
   `{ files: [{ name, type, category: "photo"|"video" }] }` → returns one
   signed upload URL + final public URL per file.
3. `lib/upload.ts::uploadFileWithRetry()` PUTs each file directly to Supabase
   Storage with progress callbacks; on failure it re-requests a fresh signed
   URL for just that file and retries once.
4. On successful submit, the resulting `publicUrl`s become `photoPaths`/
   `videoPaths` in the `POST /api/dealer/property` body — the **cover photo
   is spliced to the front of the array** before sending (same convention as
   `HostelFlow`'s `Step4Media.tsx`).

**Reordering:** simple ↑/↓ move buttons on each thumbnail (same pattern as
the admin panel's existing photo editor in `app/admin/properties/page.tsx`)
— not true drag-and-drop. This is a deliberate substitution for the
originally-specified "drag & drop," made to respect CLAUDE.md's "no heavy
libraries" mobile-first rule (a real DnD implementation needs either a
library or nontrivial native pointer-event code that isn't proven anywhere
in this codebase yet).

**Documents** (Step 4, optional — sale deed, registry, patta, RERA,
mutation, other): same `prepare-upload` mechanism with
`category: "document"`, uploaded but explicitly **not verified** at this
stage (per spec — verification workflow is a future feature, §12/
`future-features.md`).

---

## 8. Amenities Architecture

The amenities system is designed as a platform-wide primitive from day one,
not a Sale-specific feature that happens to exist:

- **Data-driven, not hardcoded.** The wizard fetches the applicable list
  from `GET /api/amenities?ptype=X` at Step 2 render time. Adding a new
  amenity, or reassigning which property types it applies to, is a plain SQL
  `INSERT`/`UPDATE` against the `amenities` table — no frontend or backend
  code change, no deploy.
- **Selection state** in the wizard is just `amenityKeys: string[]` on
  `SaleForm` (the human-readable `key`s, e.g. `"swimming_pool"`) — resolved
  to `amenity_id`s server-side at submit time, so the client never needs to
  know database IDs.
- **Not wired into Hostel/Rent/PG yet.** Those flows keep using their
  existing `hostel_meta.common_amenities: string[]` / flat `amenities:
  Record<string, boolean>` JSONB approach for now — this plan does not touch
  them. But because the new tables are generic (no `sale_`-prefixed
  column/table names, no Sale-specific constraint), migrating Hostel/Rent/PG
  onto `amenities`/`property_amenities` later is additive: seed any
  hostel-specific amenity keys not already present, backfill
  `property_amenities` from each property's existing JSONB data, then switch
  the read/write path — no schema redesign required at that point. This is
  the concrete meaning of "reusable" here, not just an aspiration.

---

## 9. Draft (Autosave) Flow

Reused entirely unmodified from the existing Rent/PG mechanism — **zero
backend changes**:

- Table: `property_drafts`, one row per `dealer_id` (upsert on conflict —
  a dealer has at most one in-progress draft at a time, across all
  purposes, exactly as today).
- `SaleForm` must be a plain JSON-serializable object (no `File` objects —
  photos/videos are dropped on save and must be re-added if a draft is
  resumed, same limitation as Rent/Hostel today).
- Autosave trigger: debounced 1200ms after any `SaleForm` state change,
  via `PUT /api/dealer/draft` with `{ purpose: "sale", form_data: form }`.
- Resume: `app/dealer/post/page.tsx` resolves the dealer's session + latest
  draft server-side before first paint (this is what fixed a ~0.3 CLS issue
  earlier this project) and passes it into `PostPropertyClient`, which shows
  a "Continue your unfinished Sale listing?" banner; `resumeDraft()` merges
  `draft.form_data` over `emptySaleForm()` and jumps straight to Step 1 of
  `SaleFlow` (no per-step resume position is stored — same as Rent/Hostel).
- On successful submit, the draft row is best-effort deleted (wrapped in
  try/catch so a missing/broken drafts table can never fail the actual
  listing submission).

---

## 10. Identity / OTP Flow (Owner Verification)

**Not new — Sale reuses the existing upfront gate exactly as it works for
Rent and PG today.** This was an explicit decision (not the spec's original
"OTP inside Step 4") made after reviewing what already exists:

1. `PostPropertyClient.tsx`'s purpose selector shows a "Your details" card
   (name + WhatsApp) if there's no existing dealer session.
2. `POST /api/otp/send` with `purpose: "owner_post"` sends the WhatsApp OTP.
3. `POST /api/dealer/identify` verifies it, find-or-creates a `dealers` row
   (`role: "owner"`), and calls `createDealerSession()` — the same session
   mechanism as dealer login (`lib/dealerSession.ts`, httpOnly `p100_ds`
   cookie, 45-day sliding expiry).
4. Only then does the purpose (`sale`/`rent`/`pg`) actually render its
   wizard.

**In `SaleFlow`'s Step 4:** the verified phone is shown **read-only**, with
a "Verified ✓" badge — never a second OTP input. A "Change number" link
hands control back to `PostPropertyClient` (via a callback prop) to re-run
step 1-3 above; the in-progress `SaleForm` state is untouched (it lives in
the parent component and the identity screen is just a different render
branch of the same component tree, not a navigation/page reload).

**Auth-provider agnosticism:** `SaleFlow` and its step components receive
`sellerName`/`sellerPhone` as plain props and an `onChangeNumber` callback —
they never import or call anything OTP-specific themselves. This means a
future alternative identity provider (Google/Apple/Email sign-in) would only
require changing what `PostPropertyClient` does to produce those same two
props + callback — the wizard itself doesn't need to change. This constraint
is satisfied by following the convention `StandardFlow`/`HostelFlow` already
use, not by building new abstraction layers.

---

## 11. Component Hierarchy

```
app/dealer/post/
├── PostPropertyClient.tsx        (existing — identity gate, draft banner,
│                                  purpose dispatch; +sale branch, +props)
├── page.tsx                      (existing — server-side session/draft resolve)
├── types.ts                      (existing — shared Purpose type, Rent's
│                                  StandardForm/SALE_PTYPES; UNCHANGED)
├── styles.module.css             (existing — shared by PostPropertyClient
│                                  + StandardFlow + HostelFlow; UNCHANGED)
├── standard/
│   └── StandardFlow.tsx          (existing — Rent only, going forward;
│                                  UNCHANGED)
├── hostel/
│   └── ...                       (existing — UNCHANGED)
└── sale/                         (NEW — everything below is new)
    ├── types.ts                  (SALE_PROPERTY_TYPES, PLOT_TYPES,
    │                              FACING_OPTIONS, OWNERSHIP_TYPES,
    │                              PARKING_TYPES, PROPERTY_AGE_OPTIONS,
    │                              AVAILABILITY_OPTIONS, AREA_UNITS,
    │                              SaleForm, emptySaleForm(),
    │                              needsBhk/needsFloor/needsPlotType/... )
    ├── validate.ts                (validateSaleStep1/2/3/4)
    ├── SaleFlow.tsx               (orchestrator — step state, progress bar,
    │                              upload calls, submit)
    ├── Step1Basics.tsx            (property type cards + location +
    │                              dynamic config + age/availability)
    ├── Step2Specifications.tsx    (price/area/furnishing/floor/facing/
    │                              ownership/parking + dynamic amenities +
    │                              description)
    ├── Step3Media.tsx             (photos + video, reusing upload trio)
    ├── Step4Publish.tsx           (owner details, verified-phone display,
    │                              documents, declaration, review, publish)
    └── styles.module.css          (NEW — premium visual language, same
                                    CSS custom properties as globals.css)
```

`SaleForm` (the lifted, autosaved form-state object) lives at the top of
`PostPropertyClient.tsx` next to `hostelForm`/`standardForm`, exactly
parallel to the existing pattern.

---

## 12. Future Extension Points

- **New property type:** add to `SALE_PROPERTY_TYPES` in
  `app/dealer/post/sale/types.ts`, add its field-visibility helper(s), add
  any new columns it needs to `sale_property_details` (additive `ALTER
  TABLE ADD COLUMN IF NOT EXISTS`, never breaking existing rows), seed its
  amenity set into `amenities` with the right `applicable_property_types`.
  No changes to `SaleFlow.tsx`'s orchestration logic needed.
- **New amenity:** a plain `INSERT INTO amenities (...)` — visible in the
  wizard on the next page load, no deploy.
- **Migrating Hostel/Rent/PG onto relational amenities:** see §8 — additive,
  not a redesign.
- **Admin edit-panel parity** for `sale_property_details`/amenities
  (`app/admin/properties/page.tsx`): read the same tables, follow the exact
  allowlist-PATCH pattern already used for `hostel_meta` fields there.
- **Public `/property/[slug]` display** of sale-specific fields/amenities:
  join `sale_property_details` and `property_amenities`→`amenities` into
  `PropertyFull` in `app/property/[slug]/page.tsx`'s `fetchProperty()`,
  exactly the same shape as the `locality:localities!locality_id(*)` join
  added for the Locality Guide feature this same week — a proven, low-risk
  pattern.
- **Document verification workflow, AI description generation, price
  estimation, etc.:** see `docs/future-features.md` — each entry there notes
  which table/column it would hook into given this schema.
- **`$$...$$` dollar-quoting convention:** any future SQL file with free-text
  content containing apostrophes should default to this, per the
  `migration_faq_defaults.sql` incident referenced in §2.5.

---

## Implementation status

- [x] `supabase/migration_sale_property_details.sql`
- [x] `supabase/migration_amenities.sql`
- [x] `lib/types.ts` additions
- [x] `app/dealer/post/sale/types.ts`
- [x] `app/dealer/post/sale/validate.ts`
- [x] `app/dealer/post/sale/SaleFlow.tsx`
- [x] `app/dealer/post/sale/Step1Basics.tsx`
- [x] `app/dealer/post/sale/Step2Specifications.tsx`
- [x] `app/dealer/post/sale/Step3Media.tsx`
- [x] `app/dealer/post/sale/Step4Publish.tsx`
- [x] `app/dealer/post/sale/styles.module.css`
- [x] `app/api/amenities/route.ts`
- [x] `app/api/dealer/property/route.ts` (extended)
- [x] `app/dealer/post/PostPropertyClient.tsx` (extended — sale branch,
      `sellerName`/`sellerPhone` state resolved server-side via
      `app/dealer/post/page.tsx`, `reverifying` flow for Step 4's "Change
      number")
- [x] **Bhavya ran** `migration_sale_property_details.sql` then
      `migration_amenities.sql` in the Supabase SQL editor (confirmed
      2026-07-29) — `GET /api/amenities?ptype=Flat`/`Warehouse-Godown`
      verified live against the seeded data
- [x] End-to-end insert smoke test against the live DB (disposable test
      property, id 99, created → `sale_property_details` insert →
      `property_amenities` junction resolve/insert → joined read-back →
      cleaned up) — confirms the schema and the `POST /api/dealer/property`
      insert code match exactly
- [ ] Live click-through test on a real device/browser through the actual
      wizard UI (not yet done — the Chrome browser tool wasn't connected
      this session; the smoke test above exercised the DB layer directly,
      not the actual form → upload → submit path)
- [ ] Admin edit-panel parity, public `/property/[slug]` display of sale
      fields — deliberately out of scope for this pass (§ above)

This file should always reflect reality — update the checklist as the
remaining items land.
