-- =====================================================================
-- Dealer authentication hardening (2026-07): server-side sessions, OTP
-- purpose scoping, and a login-permission flag separate from public
-- visibility. Run in the Supabase SQL editor. Safe to re-run.
--
-- Replaces the previous model: a stateless HMAC token stored in the
-- browser's localStorage, signed with one global DEALER_SESSION_SECRET.
-- That token was XSS-readable and could only be revoked platform-wide
-- (rotate the secret -> every dealer logged out at once). These changes
-- move the session server-side so it can be revoked per-dealer (logout,
-- lost phone) and lives only in an httpOnly cookie.
-- =====================================================================

-- ---------------------------------------------------------------
-- dealer_sessions: one row per logged-in device. The id is a 256-bit
-- random opaque token carried in an httpOnly cookie (p100_ds) — nothing
-- dealer-readable, never in localStorage. Sliding expiry: expires_at is
-- pushed forward on each authenticated request, so a daily-active dealer
-- never re-logs-in while a truly abandoned/lost session self-expires.
-- This IS the "trusted device" mechanism in the frozen auth design —
-- the sliding session cookie is the trusted device, no second token.
-- ---------------------------------------------------------------
create table if not exists dealer_sessions (
  id           text primary key,                 -- random, opaque (base64url of 32 bytes)
  dealer_id    bigint not null references dealers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked      boolean not null default false,
  user_agent   text
);
create index if not exists idx_dealer_sessions_dealer on dealer_sessions(dealer_id);
create index if not exists idx_dealer_sessions_live on dealer_sessions(dealer_id) where revoked = false;

-- RLS on, no policies: service-role only (same pattern as otp_verifications /
-- wallet_transactions). Sessions are only ever read/written by server routes.
alter table dealer_sessions enable row level security;

-- ---------------------------------------------------------------
-- otp_verifications.purpose: the OTP table is shared by customer lead
-- verification and (now) dealer login + owner-post. Without a purpose
-- column, both flows look up "the latest unverified row for this phone"
-- and can consume each other's codes — causing flaky "OTP expired/not
-- found" errors when a phone runs two flows close together. Default
-- 'lead' keeps every existing customer row valid with no backfill.
--   Values: 'lead' (customer contact reveal), 'dealer_login', 'owner_post'
-- ---------------------------------------------------------------
alter table otp_verifications
  add column if not exists purpose text not null default 'lead';

-- ---------------------------------------------------------------
-- dealers.can_login: login permission, kept SEPARATE from is_active.
--   is_active  = shown in the public "partners" list (visibility)
--   can_login  = allowed to authenticate (permission)
-- These were silently conflated: self-listed owners are is_active=false
-- (hidden from the partner list) yet must still be able to log in and
-- manage their listing. Splitting them means suspending a dealer's login
-- never unpublishes their listings, and hiding a dealer from the public
-- list never locks them out.
-- ---------------------------------------------------------------
alter table dealers
  add column if not exists can_login boolean not null default true;
