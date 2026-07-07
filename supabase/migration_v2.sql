-- =====================================================================
-- KotaProperty — Migration v1 → v2
-- Run in Supabase SQL editor if you already ran schema.sql v1.
-- All statements use IF NOT EXISTS / DROP IF EXISTS — safe to re-run.
-- =====================================================================

-- properties: new columns
alter table properties
  add column if not exists slug                 text unique,
  add column if not exists is_approved          boolean not null default false,
  add column if not exists is_featured          boolean not null default false,
  add column if not exists is_verified          boolean not null default false,
  add column if not exists property_status      text not null default 'available'
                             check (property_status in ('available','sold','rented')),
  add column if not exists rent_per_month       bigint,
  add column if not exists deposit_amount       bigint,
  add column if not exists furnishing_status    text
                             check (furnishing_status in ('furnished','semi-furnished','unfurnished')),
  add column if not exists meals_included       boolean not null default false,
  add column if not exists gender_preference    text
                             check (gender_preference in ('boys','girls','any')),
  add column if not exists available_from       date,
  add column if not exists min_stay_months      int,
  add column if not exists floor_number         int,
  add column if not exists total_floors         int,
  add column if not exists attached_bathroom    boolean not null default false,
  add column if not exists parking_available    boolean not null default false,
  add column if not exists wifi_included        boolean not null default false,
  add column if not exists nearest_coaching_hub text
                             check (nearest_coaching_hub in ('Allen','Resonance','FIITJEE','Vibrant','Motion','Other')),
  add column if not exists videos               text[] default '{}';

-- dealers: new columns
alter table dealers
  add column if not exists whatsapp_number  text,
  add column if not exists areas_covered    text[] default '{}',
  add column if not exists is_active        boolean not null default true;

-- new indexes
create index if not exists idx_props_approved  on properties(is_approved);
create index if not exists idx_props_status    on properties(property_status);
create index if not exists idx_props_coaching  on properties(nearest_coaching_hub);

-- RLS: public reads only approved properties
drop policy if exists "public read properties" on properties;
create policy "public read properties"
  on properties for select using (is_approved = true);

-- RLS: public reads only active dealers
drop policy if exists "public read dealers" on dealers;
create policy "public read dealers"
  on dealers for select using (is_active = true);

-- Approve all existing seed data so it stays visible
update properties set is_approved = true where is_approved = false;
