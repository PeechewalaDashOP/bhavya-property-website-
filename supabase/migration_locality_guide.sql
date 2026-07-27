-- Adds "locality guide" columns to the existing `localities` table (a table
-- already live in production, created out-of-band from repo SQL — see
-- docs/audit/MIGRATION.md). Many hostels in the same area (e.g. all of
-- Rajeev Gandhi Nagar) share one locality record, so this guide content lives
-- here instead of duplicated per-property in hostel_meta.
alter table localities
  add column if not exists average_rent text,
  add column if not exists popular_coachings text[],
  add column if not exists best_cafes text[],
  add column if not exists transport text,
  add column if not exists safety_note text;
