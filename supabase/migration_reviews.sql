-- ============================================================
-- Migration: reviews
-- Owner/property reviews — anyone can submit (no OTP/login gate),
-- goes live immediately. Admin can delete any review from the
-- admin panel. Matches the leads table's write pattern: all
-- inserts/deletes go through server-side API routes using the
-- service-role key — no direct client writes, no RLS insert/delete
-- policy needed.
--
-- Safe to re-run (IF NOT EXISTS).
-- ============================================================

create table if not exists reviews (
  id             bigserial primary key,
  property_id    bigint not null references properties(id) on delete cascade,
  dealer_id      bigint references dealers(id) on delete set null, -- denormalised, same pattern as leads.dealer_id
  reviewer_name  text not null,
  rating         smallint not null check (rating between 1 and 5),
  comment        text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_reviews_property on reviews(property_id);

alter table reviews enable row level security;

drop policy if exists "public read reviews" on reviews;

-- Same visibility rule as property_units: only readable while the
-- underlying listing itself is public.
create policy "public read reviews"
  on reviews for select using (
    exists (
      select 1 from properties
      where properties.id = reviews.property_id
        and properties.is_approved = true
    )
  );

-- No insert/update/delete policies — submission goes through
-- POST /api/reviews and deletion through DELETE /api/admin/reviews,
-- both using the service-role key server-side.
