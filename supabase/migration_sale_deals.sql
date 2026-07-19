-- =====================================================================
-- Buy/Sell commission tracking: consent columns on leads + a new
-- sale_deals table. Commission is a SUCCESS FEE (0.25% buyer / 0.5%
-- seller of the agreed price), collected only on deal closure — a
-- different shape from the rental wallet's upfront-per-lead billing.
-- Run in Supabase SQL editor. Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------------------------------------------------------------
-- leads: commission consent (sale listings only). Nullable — never
-- trust the client-submitted checkbox alone; createLead() re-derives
-- the property's type server-side before honoring this.
-- ---------------------------------------------------------------
alter table leads
  add column if not exists commission_consent boolean,
  add column if not exists commission_consent_at timestamptz;

-- ---------------------------------------------------------------
-- sale_deals: one row per sale-property lead that becomes a real
-- prospect. Auto-created by createLead() alongside the leads row
-- whenever the resolved property is type='sale'. Lifecycle is admin-
-- verified only (no dealer magic link, unlike rent) given the money
-- and stakes involved in a real-estate closing.
-- ---------------------------------------------------------------
create table if not exists sale_deals (
  id                                 bigserial primary key,
  lead_id                            bigint references leads(id) on delete set null,
  property_id                        bigint not null references properties(id),
  dealer_id                          bigint not null references dealers(id),
  buyer_name                         text not null,
  buyer_phone                        text not null,
  status                             text not null default 'interested'
                                       check (status in ('interested','negotiating','closed','invoiced','collected','dead')),
  agreed_price_paise                 bigint,              -- set when status -> closed
  buyer_commission_paise             bigint,              -- 0.25% of agreed_price_paise, computed on close
  seller_commission_paise            bigint,              -- 0.50% of agreed_price_paise, computed on close
  buyer_commission_collected_paise   bigint not null default 0,
  seller_commission_collected_paise  bigint not null default 0,
  admin_notes                        text,
  closed_at                          timestamptz,
  invoiced_at                        timestamptz,
  collected_at                       timestamptz,
  created_at                         timestamptz default now(),
  updated_at                         timestamptz default now()
);
create index if not exists idx_sale_deals_dealer   on sale_deals(dealer_id, status);
create index if not exists idx_sale_deals_property on sale_deals(property_id);
create index if not exists idx_sale_deals_lead      on sale_deals(lead_id);

-- RLS on, no policies: service-role only (same pattern as wallet_transactions)
alter table sale_deals enable row level security;
