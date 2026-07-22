-- =====================================================================
-- WhatsApp-first AI concierge + student accounts (2026-07). Run in the
-- Supabase SQL editor. Safe to re-run (all guarded with IF NOT EXISTS).
--
-- Replaces the old model where a student OTP-verifies once and is handed
-- the owner's phone number directly (see /api/otp/verify, createLead()).
-- From now on, "get contact" enquiries create a concierge_enquiry instead
-- of an immediate reveal; a `leads` row is only created later, through the
-- existing createLead() choke point, when the enquiry is actually
-- connected to an owner. This migration only adds tables — it does not
-- touch `leads`, `dealers`, or `properties`.
-- =====================================================================

-- ---------------------------------------------------------------
-- students: the first persistent, loggable-into identity for the
-- customer side of Prop100. Previously customers were phone-ephemeral —
-- OTP-verified once, materialized only as a `leads` row plus a 30-day
-- signed device cookie (lib/phoneVerifySession.ts), nothing to log into.
-- Identity here is the phone number, same as dealers.
-- ---------------------------------------------------------------
create table if not exists students (
  id             bigserial primary key,
  phone          text not null unique,
  name           text,
  whatsapp_number text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- student_sessions: exact mirror of dealer_sessions (see
-- migration_dealer_auth.sql) — opaque random id in an httpOnly cookie,
-- sliding expiry, per-session revocation. Same proven pattern, new table
-- so student and dealer sessions can never collide or be revoked
-- together by accident.
-- ---------------------------------------------------------------
create table if not exists student_sessions (
  id           text primary key,
  student_id   bigint not null references students(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked      boolean not null default false,
  user_agent   text
);
create index if not exists idx_student_sessions_student on student_sessions(student_id);
create index if not exists idx_student_sessions_live on student_sessions(student_id) where revoked = false;

alter table students enable row level security;
alter table student_sessions enable row level security;
-- RLS on, no policies: service-role only (same pattern as dealer_sessions /
-- otp_verifications). Only ever read/written by server routes.

-- ---------------------------------------------------------------
-- concierge_enquiries: the spine of the WhatsApp concierge. Created the
-- moment a logged-in student taps "Get help from Prop100" on a property
-- (property_id set) or starts a general/discovery chat (property_id
-- null). intent/category/objective_key are derived server-side from the
-- property (see lib/concierge/categories.ts::deriveObjective) so the
-- Conversation Engine knows which ObjectiveDefinition governs this
-- enquiry. slot_state accumulates what the AI/human have collected so
-- far — the engine never re-asks a slot already present here.
-- ---------------------------------------------------------------
create table if not exists concierge_enquiries (
  id                  bigserial primary key,
  reference_code      text not null unique,
  student_id          bigint not null references students(id) on delete cascade,
  property_id         bigint references properties(id) on delete set null,
  intent              text,                 -- 'rent' | 'sale' | ... (mirrors properties.type)
  category            text,                 -- 'Hostel' | 'PG' | 'Flat' | 'Shop' | 'Plot' | ...
  objective_key       text,                 -- ObjectiveDefinition.key this enquiry is running
  slot_state          jsonb not null default '{}'::jsonb,
  status              text not null default 'new'
                        check (status in (
                          'new', 'ai_qualifying', 'awaiting_human',
                          'human_active', 'connected', 'closed', 'dead'
                        )),
  assigned_to         text,                 -- admin/ops identifier who claimed it
  business_hours      boolean,              -- computed at creation time, for analytics
  wa_window_expires_at timestamptz,         -- WhatsApp 24h session-message window
  source_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  first_ai_at         timestamptz,
  first_human_at      timestamptz,
  qualified_at        timestamptz
);
create index if not exists idx_concierge_enquiries_student on concierge_enquiries(student_id);
create index if not exists idx_concierge_enquiries_status on concierge_enquiries(status);
create index if not exists idx_concierge_enquiries_property on concierge_enquiries(property_id);

-- ---------------------------------------------------------------
-- concierge_messages: the WhatsApp transcript per enquiry. This is both
-- the data asset the whole pivot is for (proprietary conversation data)
-- and what lets a human agent inherit full context when they claim an
-- enquiry from the ops queue instead of starting cold.
-- ---------------------------------------------------------------
create table if not exists concierge_messages (
  id           bigserial primary key,
  enquiry_id   bigint not null references concierge_enquiries(id) on delete cascade,
  direction    text not null check (direction in ('inbound', 'outbound')),
  sender       text not null check (sender in ('student', 'ai', 'human')),
  body         text not null,
  slot_updates jsonb,          -- slots extracted/set by this message, if any
  created_at   timestamptz not null default now()
);
create index if not exists idx_concierge_messages_enquiry on concierge_messages(enquiry_id, created_at);

alter table concierge_enquiries enable row level security;
alter table concierge_messages enable row level security;
-- RLS on, no policies: service-role only. Students read their own enquiries
-- through /api/student/enquiries (service-role query scoped server-side by
-- session), never a direct client-side Supabase read.

-- ---------------------------------------------------------------
-- otp_verifications.purpose: no schema change needed — the column is
-- free text with no CHECK constraint (see migration_dealer_auth.sql).
-- 'student_login' is added to the app-level accepted-purpose list in
-- app/api/otp/send/route.ts alongside the existing 'lead' | 'dealer_login'
-- | 'owner_post' values. Noted here for a single source of truth on what
-- purposes exist across the codebase.
-- ---------------------------------------------------------------
