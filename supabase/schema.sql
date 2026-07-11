-- =====================================================================
-- Prop100 — Supabase schema v3 (includes property_units, lat/lng, unit_id on leads)
-- Run this in the Supabase SQL editor (safe to re-run — uses IF NOT EXISTS).
-- =====================================================================

-- -------------------------------------------------------------------
-- DEALERS
-- -------------------------------------------------------------------
create table if not exists dealers (
  id               bigint primary key,
  name             text not null,
  role             text,
  phone            text,
  whatsapp_number  text,              -- may differ from phone number
  areas_covered    text[] default '{}',
  years            int default 0,
  rating           numeric default 4.5,
  is_active        boolean not null default true
  -- is_active=false + role='owner': auto-created for public /post-property submissions
  -- (hidden from public dealer listings; property still has a valid dealer_id FK)
);

-- -------------------------------------------------------------------
-- AREAS
-- -------------------------------------------------------------------
create table if not exists areas (
  name      text primary key,
  coaching  text,
  img       text
);

-- -------------------------------------------------------------------
-- PROPERTIES
-- -------------------------------------------------------------------
create table if not exists properties (
  id                   bigserial primary key,

  -- core listing fields (kept from v1 — existing code references these)
  type                 text not null check (type in ('sale','rent')),
  ptype                text not null,                 -- Flat / House / Hostel / PG / Shop / Plot
  loc                  text not null references areas(name),
  coaching             text,                          -- nearest coaching area label
  bhk                  int default 0,
  baths                int default 0,
  title                text not null,
  price                bigint not null,               -- sale price OR monthly rent
  sqft                 int,
  furnish              text,                          -- legacy label, kept for public display
  img                  text,                          -- primary hero image
  gallery              text[] default '{}',
  videos               text[] default '{}',           -- min 1 required on submission
  features             text[] default '{}',
  dealer_id            bigint references dealers(id),
  verified             boolean default false,         -- maps to is_verified
  photos               int default 6,
  posted_days          int default 0,
  description          text,

  -- moderation / monetisation
  is_approved          boolean not null default false,  -- Bhavya must approve before live
  is_featured          boolean not null default false,  -- paid feature slot
  is_verified          boolean not null default false,  -- admin-verified badge
  slug                 text unique,                     -- permanent, never rename

  -- rental-specific fields
  rent_per_month       bigint,                          -- primary price for rental listings
  deposit_amount       bigint,                          -- security deposit (always show)
  furnishing_status    text check (furnishing_status in ('furnished','semi-furnished','unfurnished')),
  meals_included       boolean not null default false,  -- critical for hostels & PGs
  gender_preference    text check (gender_preference in ('boys','girls','any')),
  available_from       date,
  min_stay_months      int,
  floor_number         int,
  total_floors         int,
  attached_bathroom    boolean not null default false,
  parking_available    boolean not null default false,
  wifi_included        boolean not null default false,
  nearest_coaching_hub text check (nearest_coaching_hub in ('Allen','Resonance','FIITJEE','Vibrant','Motion','Other')),
  property_status      text not null default 'available'
                         check (property_status in ('available','sold','rented')),

  -- geographic coordinates (optional — used for distance calculator)
  lat                  numeric,
  lng                  numeric,

  created_at           timestamptz default now()
);

create index if not exists idx_props_type      on properties(type);
create index if not exists idx_props_loc       on properties(loc);
create index if not exists idx_props_ptype     on properties(ptype);
create index if not exists idx_props_price     on properties(price);
create index if not exists idx_props_approved  on properties(is_approved);
create index if not exists idx_props_status    on properties(property_status);
create index if not exists idx_props_coaching  on properties(nearest_coaching_hub);

-- -------------------------------------------------------------------
-- PROPERTY UNITS
-- Multi-room-type listings (hostel single/double AC/cooler, property portions…)
-- -------------------------------------------------------------------
create table if not exists property_units (
  id               bigserial primary key,
  property_id      bigint not null references properties(id) on delete cascade,
  label            text not null,           -- "Single AC", "2BHK Portion", etc.
  capacity         int not null default 1,
  price_per_month  bigint not null,
  deposit_amount   bigint,
  total_count      int not null default 1,
  available_count  int not null default 1,
  has_ac           boolean not null default false,
  has_cooler       boolean not null default false,
  attached_bath    boolean not null default false,
  meals_included   boolean not null default false,
  description      text,
  sort_order       int not null default 0,
  created_at       timestamptz default now()
);
create index if not exists idx_punits_property on property_units(property_id);

-- -------------------------------------------------------------------
-- LEADS
-- -------------------------------------------------------------------
create table if not exists leads (
  id              bigserial primary key,
  reference_code  text unique not null,
  customer_name   text not null,
  customer_phone  text not null,
  property_id     bigint references properties(id) on delete set null,
  dealer_id       bigint references dealers(id) on delete set null,
  unit_id         bigint references property_units(id) on delete set null,
  unit_label      text,    -- denormalised — survives unit deletion
  intent          text,
  source_url      text,
  magic_token     uuid not null default gen_random_uuid(),
  status          text not null default 'new'
                    check (status in ('new','contacted','closed','dead')),
  move_in_date    date,
  occupants       int,
  msg             text,
  contacted_at    timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz default now()
);

-- -------------------------------------------------------------------
-- OTP VERIFICATIONS
-- -------------------------------------------------------------------
create table if not exists otp_verifications (
  id          bigserial primary key,
  phone       text not null,
  otp_hash    text not null,  -- SHA-256 of "otp:phone" — never store plain OTP
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  verified_at timestamptz,
  created_at  timestamptz default now()
);
create index if not exists idx_otp_phone on otp_verifications(phone);

-- =====================================================================
-- Row Level Security
--   * public SELECT: dealers (active only), areas, properties (approved only)
--   * all writes go through server-side API routes (service role)
-- =====================================================================
alter table dealers           enable row level security;
alter table areas             enable row level security;
alter table properties        enable row level security;
alter table property_units    enable row level security;
alter table leads             enable row level security;
alter table otp_verifications enable row level security;

-- Drop old policies before recreating (safe on fresh DB)
drop policy if exists "public read dealers"        on dealers;
drop policy if exists "public read areas"          on areas;
drop policy if exists "public read properties"     on properties;
drop policy if exists "public read property_units" on property_units;

create policy "public read dealers"
  on dealers for select using (is_active = true);

create policy "public read areas"
  on areas for select using (true);

create policy "public read properties"
  on properties for select using (is_approved = true);

create policy "public read property_units"
  on property_units for select using (
    exists (
      select 1 from properties
      where properties.id = property_units.property_id
        and properties.is_approved = true
    )
  );

-- leads / otp_verifications: no public access — service role only

-- =====================================================================
-- MIGRATION M1 — Variant attributes on property_units
-- Safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Run in Supabase SQL editor AFTER the base schema above.
-- =====================================================================

alter table property_units
  add column if not exists attributes       jsonb         not null default '{}',
  add column if not exists unit_photos      text[]        not null default '{}',
  add column if not exists last_confirmed_at timestamptz  not null default now();

create index if not exists idx_punits_attributes
  on property_units using gin (attributes);

-- Backfill attributes for Hostel / PG units (derive from boolean columns)
-- Run scripts/backfill-attributes.sql separately after applying this migration.
