-- =====================================================================
-- KotaProperty — Supabase schema
-- Run this in the Supabase SQL editor.
-- =====================================================================

create table if not exists dealers (
  id          bigint primary key,
  name        text not null,
  role        text,
  phone       text,
  years       int default 0,
  rating      numeric default 4.5
);

create table if not exists areas (
  name        text primary key,
  coaching    text,
  img         text
);

create table if not exists properties (
  id            bigserial primary key,
  type          text not null check (type in ('sale','rent')),
  ptype         text not null,
  loc           text not null references areas(name),
  coaching      text,
  bhk           int default 0,
  baths         int default 0,
  title         text not null,
  price         bigint not null,
  sqft          int,
  furnish       text,
  img           text,
  gallery       text[] default '{}',
  features      text[] default '{}',
  dealer_id     bigint references dealers(id),
  verified      boolean default false,
  photos        int default 6,
  posted_days   int default 0,
  description   text,
  created_at    timestamptz default now()
);
create index if not exists idx_props_type on properties(type);
create index if not exists idx_props_loc on properties(loc);
create index if not exists idx_props_ptype on properties(ptype);
create index if not exists idx_props_price on properties(price);

create table if not exists leads (
  id          bigserial primary key,
  ref         text unique not null,
  name        text not null,
  phone       text not null,
  intent      text,
  prop        text,
  dealer      text,
  price       bigint default 0,
  msg         text,
  status      text default 'New',
  created_at  timestamptz default now()
);

-- =====================================================================
-- Row Level Security
--   * public can READ dealers / areas / properties
--   * public (anon) can INSERT a lead, but cannot read others' leads
--   * managing leads (read/update) should use the service role / dashboard
-- =====================================================================
alter table dealers     enable row level security;
alter table areas       enable row level security;
alter table properties  enable row level security;
alter table leads       enable row level security;

create policy "public read dealers"    on dealers    for select using (true);
create policy "public read areas"      on areas      for select using (true);
create policy "public read properties" on properties for select using (true);
create policy "public insert leads"    on leads      for insert with check (true);
