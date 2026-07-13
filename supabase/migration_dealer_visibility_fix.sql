-- =====================================================================
-- Fix: self-listed owners (dealers.is_active = false) were completely
-- invisible to public reads, even on their OWN approved property. That
-- caused two real bugs:
--   1. Homepage cards fell back to a hardcoded sample dealer's name/phone
--      (whatever the app's fallback used) instead of the real owner.
--   2. The property detail page's dealer lookup came back empty, so leads
--      were saved with dealer_id = null — the real owner never saw them
--      in their dashboard.
-- is_active still correctly hides self-listed owners from the generic
-- "Verified Partners" showcase (that query filters is_active = true
-- explicitly in app code) — this only fixes visibility for a dealer's
-- OWN approved listing.
-- Run in Supabase SQL editor. Safe to re-run.
-- =====================================================================

drop policy if exists "public read dealers" on dealers;

create policy "public read dealers"
  on dealers for select using (
    is_active = true
    or exists (
      select 1 from properties
      where properties.dealer_id = dealers.id
        and properties.is_approved = true
    )
  );
