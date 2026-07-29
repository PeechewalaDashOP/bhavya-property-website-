-- Sale module — property-type-specific fields for "For Sale" listings.
-- One row per sale property, 1:1 with `properties` (property_id is both PK
-- and FK). Every column is nullable except the two with defaults; only the
-- columns relevant to the listing's ptype get populated — everything else
-- stays NULL. See docs/sale-architecture.md §2.2 for the full design
-- rationale (why one shared typed table instead of JSONB or 8 per-type
-- tables).
create table if not exists sale_property_details (
  property_id          bigint primary key references properties(id) on delete cascade,

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
  possession_date      date,    -- only meaningful when availability_status = under_construction

  -- Pricing / area specifics
  price_negotiable     boolean not null default false,
  area_value           numeric,
  area_unit            text,    -- sqft | sqyard | sqm | acre | bigha

  -- Floor extras
  floor_special        text,    -- ground | basement | top | null

  -- Orientation & legal
  facing               text,    -- N | S | E | W | NE | NW | SE | SW
  ownership_type       text,    -- freehold | leasehold | co_operative | power_of_attorney (the PROPERTY's legal status)

  -- Parking
  parking_type         text,    -- none | bike | car | both

  -- Who is posting (Step 4) — distinct from ownership_type above, which
  -- describes the property's legal title, not who's listing it.
  poster_role          text,    -- owner | builder | broker

  -- Optional document uploads (Step 4) — upload only, not verified at this
  -- stage. JSONB here is fine per the "no JSONB for searchable business
  -- fields" rule: these are attachment metadata, never filtered/queried on,
  -- not the kind of field the rule is protecting. Shape: [{doc_type, url}].
  -- Superseded later by a dedicated property_documents table once a real
  -- verification workflow exists (see docs/future-features.md).
  documents            jsonb not null default '[]'::jsonb,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table sale_property_details enable row level security;
drop policy if exists "public read sale_property_details" on sale_property_details;
create policy "public read sale_property_details" on sale_property_details
  for select using (
    exists (
      select 1 from properties
      where properties.id = sale_property_details.property_id
        and properties.is_approved = true
    )
  );

-- No insert/update/delete policy — all writes go through
-- POST /api/dealer/property (session-gated, service-role client).
