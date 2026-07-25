-- ============================================================
-- Migration: tenant_preference
-- Adds ONE column to properties for "who this rental suits"
-- (Family / Bachelors / Working Professional / Student, etc.) —
-- the data backing for the Rent tab's "Available For" filter and
-- the homepage's curated entry points (Family Rentals, and future
-- ones like Working Professionals), per the Family Rentals
-- research report: a filtered view of Rent, never a separate
-- module or table.
--
-- Deliberately a plain text[] with NO CHECK constraint, matching
-- the existing `ptype` and `features` columns on this same table —
-- new audience segments (e.g. "Corporate Lease", "Senior Citizens")
-- can be introduced later just by adding a value to
-- lib/constants.ts::TENANT_PREFERENCES, with zero migration. A
-- listing can carry more than one value (e.g. suits both Family
-- and Working Professional) — array, not a single enum column.
--
-- A NULL or empty array means "not tagged yet" and is treated as
-- visible under every "Available For" filter value (see the list
-- filter in SiteClient.tsx) so existing/untagged listings never
-- silently vanish from a new filter the moment it ships.
--
-- Safe to re-run (IF NOT EXISTS). No RLS changes. No column
-- renames. No data loss.
-- ============================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS tenant_preference text[] DEFAULT '{}';

COMMENT ON COLUMN properties.tenant_preference IS
  'Who this rental is suited for — free-form tags, no CHECK constraint.
   Current values used by the UI (lib/constants.ts::TENANT_PREFERENCES):
   "Family", "Bachelors", "Working Professional", "Students".
   Empty/NULL = not tagged, shown under every filter value.
   Only meaningful for rent-type listings (type=''rent'') — sale
   listings do not use this field.';
