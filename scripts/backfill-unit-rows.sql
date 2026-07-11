-- =====================================================================
-- Backfill: insert one property_units row for every property that has
-- zero units so PropertyDetail always reads from a single data path.
-- Run ONCE in Supabase SQL editor after migration M1.
-- =====================================================================

insert into property_units (
  property_id,
  label,
  capacity,
  price_per_month,
  deposit_amount,
  total_count,
  available_count,
  has_ac,
  has_cooler,
  attached_bath,
  meals_included,
  attributes,
  last_confirmed_at,
  sort_order
)
select
  p.id,
  -- Label: "2 BHK" for Flat/House, ptype otherwise
  case
    when p.ptype in ('Flat','House','Villa') and p.bhk > 0
      then p.bhk::text || ' BHK'
    else p.ptype
  end,
  -- Capacity defaults to 1 for residential, irrelevant for commercial
  1,
  coalesce(p.rent_per_month, p.price),
  p.deposit_amount,
  1,                                         -- total_count
  1,                                         -- available_count (assume available)
  false,                                     -- has_ac (unknown without unit data)
  false,
  coalesce(p.attached_bathroom, false),
  coalesce(p.meals_included, false),
  -- Seed minimal attributes so variant selector can match
  case
    when p.ptype in ('Flat','House','Villa') and p.bhk > 0
      then jsonb_build_object('bhk', p.bhk)
    else '{}'::jsonb
  end,
  now(),
  0
from properties p
where not exists (
  select 1 from property_units pu where pu.property_id = p.id
);
