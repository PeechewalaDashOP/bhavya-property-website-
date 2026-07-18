-- =====================================================================
-- Wallet + pay-per-lead billing (Phase 0: schema lands now, billing
-- stays OFF via BILLING_ENABLED env until the month-2 flip).
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------------------------------------------------------------
-- dealers: wallet fields
-- free_leads_remaining default 5 = the evergreen "pehle 5 leads free"
-- onboarding offer (also applies to future signups automatically).
-- ---------------------------------------------------------------
alter table dealers
  add column if not exists wallet_balance_paise bigint not null default 0,
  add column if not exists free_leads_remaining int    not null default 5;

-- ---------------------------------------------------------------
-- wallet_transactions: append-only money ledger. balance_after_paise
-- makes every dispute answerable ("18 July, lead P100-4521, -₹25,
-- baaki ₹75"). Never UPDATE or DELETE rows here.
-- ---------------------------------------------------------------
create table if not exists wallet_transactions (
  id                  bigserial primary key,
  dealer_id           bigint not null references dealers(id),
  amount_paise        bigint not null,          -- signed: + credit, - debit
  type                text   not null check (type in ('topup','lead_charge','refund','bonus','admin_adjust')),
  lead_id             bigint references leads(id) on delete set null,
  note                text,
  balance_after_paise bigint not null,
  created_at          timestamptz default now()
);
create index if not exists idx_wtx_dealer on wallet_transactions(dealer_id, created_at desc);

-- RLS on, no policies: service-role only (same pattern as otp_verifications)
alter table wallet_transactions enable row level security;

-- ---------------------------------------------------------------
-- leads: billing fields
--   'waived'          = free phase / no-dealer leads; charge_paise holds the
--                       SHADOW value (what it would have cost) for the
--                       month-2 "value delivered" pitch
--   'free'            = consumed one of the dealer's free leads
--   'charged'         = wallet debited
--   'pending_balance' = owner had insufficient balance; contact withheld
--                       from customer until top-up releases it
-- ---------------------------------------------------------------
alter table leads
  add column if not exists billing_status text not null default 'waived'
    check (billing_status in ('free','charged','pending_balance','waived')),
  add column if not exists charge_paise bigint,
  add column if not exists charged_at  timestamptz;

-- dedup lookup (same phone + property within 30d) and pending-release scan
create index if not exists idx_leads_phone_prop on leads(customer_phone, property_id, created_at desc);
create index if not exists idx_leads_pending    on leads(dealer_id, created_at) where billing_status = 'pending_balance';

-- ---------------------------------------------------------------
-- charge_lead: the ONLY way a lead may be billed. Atomic:
--   * FOR UPDATE on the dealer row serializes concurrent charges —
--     two simultaneous leads can never double-spend one balance.
--   * charged_at acts as the idempotency latch — a lead that has ever
--     been settled (free or charged) can never be billed again, so
--     retries and the release loop are safe.
-- Returns: 'free' | 'charged' | 'insufficient' | 'already_settled'
--          | 'no_dealer' | 'no_lead'
-- ---------------------------------------------------------------
create or replace function charge_lead(p_dealer_id bigint, p_lead_id bigint, p_amount_paise bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  l record;
begin
  if p_amount_paise < 0 then
    raise exception 'amount must be non-negative';
  end if;

  select wallet_balance_paise, free_leads_remaining into d
    from dealers where id = p_dealer_id for update;
  if not found then return 'no_dealer'; end if;

  select billing_status, charged_at into l
    from leads where id = p_lead_id for update;
  if not found then return 'no_lead'; end if;
  if l.charged_at is not null then return 'already_settled'; end if;

  if d.free_leads_remaining > 0 then
    update dealers set free_leads_remaining = free_leads_remaining - 1
      where id = p_dealer_id;
    update leads set billing_status = 'free', charge_paise = 0, charged_at = now()
      where id = p_lead_id;
    return 'free';
  elsif d.wallet_balance_paise >= p_amount_paise then
    update dealers set wallet_balance_paise = wallet_balance_paise - p_amount_paise
      where id = p_dealer_id;
    insert into wallet_transactions (dealer_id, amount_paise, type, lead_id, balance_after_paise)
      values (p_dealer_id, -p_amount_paise, 'lead_charge', p_lead_id,
              d.wallet_balance_paise - p_amount_paise);
    update leads set billing_status = 'charged', charge_paise = p_amount_paise, charged_at = now()
      where id = p_lead_id;
    return 'charged';
  else
    update leads set billing_status = 'pending_balance', charge_paise = p_amount_paise
      where id = p_lead_id;
    return 'insufficient';
  end if;
end
$$;

-- ---------------------------------------------------------------
-- credit_wallet: the ONLY way balance goes up (manual UPI top-up via
-- admin panel today; a Razorpay webhook would call the same function
-- later). Returns the new balance in paise.
-- ---------------------------------------------------------------
create or replace function credit_wallet(p_dealer_id bigint, p_amount_paise bigint, p_type text, p_note text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  bal bigint;
begin
  if p_amount_paise <= 0 then
    raise exception 'credit amount must be positive';
  end if;
  if p_type not in ('topup','refund','bonus','admin_adjust') then
    raise exception 'invalid credit type %', p_type;
  end if;

  select wallet_balance_paise into bal
    from dealers where id = p_dealer_id for update;
  if not found then
    raise exception 'dealer % not found', p_dealer_id;
  end if;

  bal := bal + p_amount_paise;
  update dealers set wallet_balance_paise = bal where id = p_dealer_id;
  insert into wallet_transactions (dealer_id, amount_paise, type, note, balance_after_paise)
    values (p_dealer_id, p_amount_paise, p_type, p_note, bal);
  return bal;
end
$$;

-- ---------------------------------------------------------------
-- CRITICAL: PostgREST exposes functions to anon by default, and these
-- are SECURITY DEFINER. Lock them to service-role only.
-- ---------------------------------------------------------------
revoke execute on function charge_lead(bigint, bigint, bigint) from public, anon, authenticated;
revoke execute on function credit_wallet(bigint, bigint, text, text) from public, anon, authenticated;
