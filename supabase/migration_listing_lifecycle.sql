-- =====================================================================
-- Listing lifecycle: pending / live / paused_owner / paused_admin / rejected
-- + in-progress "post a property" drafts (resume-later support).
--
-- is_approved stays the single source of truth for PUBLIC VISIBILITY
-- (existing RLS policy + all existing queries already gate on it — this
-- migration does not touch that behavior). listing_status is layered on
-- top purely to tell the difference between "never approved yet", "was
-- live but the owner paused it", "was live but admin paused it", and
-- "rejected" — application code keeps is_approved in sync with it:
--   pending / paused_owner / paused_admin / rejected  -> is_approved = false
--   live                                              -> is_approved = true
-- Run in Supabase SQL editor. Safe to re-run.
-- =====================================================================

alter table properties
  add column if not exists listing_status text not null default 'pending'
    check (listing_status in ('pending','live','paused_owner','paused_admin','rejected'));

-- Backfill existing rows: anything already approved is live; the rest is pending.
update properties set listing_status = 'live' where is_approved = true;

create index if not exists idx_props_listing_status on properties(listing_status);

-- In-progress wizard state, so an owner who leaves mid-form can resume later.
-- One active draft per dealer (upsert on dealer_id) — a new purpose overwrites it.
create table if not exists property_drafts (
  id          bigint generated always as identity primary key,
  dealer_id   bigint not null references dealers(id) on delete cascade,
  purpose     text not null check (purpose in ('rent','sale','pg')),
  form_data   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (dealer_id)
);

create index if not exists idx_property_drafts_dealer on property_drafts(dealer_id);

-- Service-role only (bearer-token authenticated API routes) — no anon/public
-- access, same pattern as otp_verifications.
alter table property_drafts enable row level security;
