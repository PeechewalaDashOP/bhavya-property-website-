-- =====================================================================
-- KotaProperty / Prop100 — Migration v2 → v3
-- Run in Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- property_units: multi-portion / room-type listings
create table if not exists property_units (
  id               bigserial primary key,
  property_id      bigint not null references properties(id) on delete cascade,
  label            text not null,           -- "Single AC", "2BHK Portion", "Double Cooler"
  capacity         int not null default 1,  -- persons per room/unit
  price_per_month  bigint not null,
  deposit_amount   bigint,
  total_count      int not null default 1,  -- total rooms of this type in the property
  available_count  int not null default 1,  -- currently vacant
  has_ac           boolean not null default false,
  has_cooler       boolean not null default false,
  attached_bath    boolean not null default false,
  meals_included   boolean not null default false,
  description      text,
  sort_order       int not null default 0,
  created_at       timestamptz default now()
);
create index if not exists idx_punits_property on property_units(property_id);

-- properties: add lat/lng for map-based nearby search
alter table properties
  add column if not exists lat numeric,
  add column if not exists lng numeric;

-- leads: track which specific unit/room type the customer enquired about
alter table leads
  add column if not exists unit_id bigint references property_units(id) on delete set null,
  add column if not exists unit_label text;   -- denormalised for quick display even if unit deleted

-- RLS: property_units visible only when parent property is approved
alter table property_units enable row level security;
drop policy if exists "public read property_units" on property_units;
create policy "public read property_units"
  on property_units for select using (
    exists (
      select 1 from properties
      where properties.id = property_units.property_id
        and properties.is_approved = true
    )
  );
