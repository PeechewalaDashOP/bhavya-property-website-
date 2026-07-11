-- =====================================================================
-- Backfill variant attributes for existing property_units rows.
-- Run ONCE in Supabase SQL editor after migration M1.
-- Safe to re-run (CASE guards against already-set values).
-- =====================================================================

-- Hostel / PG units: derive occupancy from capacity, cooling from has_ac/has_cooler
update property_units pu
set attributes = jsonb_build_object(
  'occupancy',
  case
    when pu.capacity = 1 then 'single'
    when pu.capacity = 2 then 'double'
    when pu.capacity >= 3 then 'triple'
    else 'single'
  end,
  'cooling',
  case
    when pu.has_ac     then 'ac'
    when pu.has_cooler then 'cooler'
    else 'none'
  end
)
where pu.attributes = '{}'
  and exists (
    select 1 from properties p
    where p.id = pu.property_id
      and p.ptype in ('Hostel', 'PG')
  );

-- Flat / House units: derive bhk from property.bhk if unit has no bhk yet
update property_units pu
set attributes = jsonb_build_object('bhk', p.bhk)
from properties p
where pu.property_id = p.id
  and pu.attributes = '{}'
  and p.ptype in ('Flat', 'House', 'Villa')
  and p.bhk > 0;
