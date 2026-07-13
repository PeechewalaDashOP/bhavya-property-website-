-- ============================================================
-- Migration: hostel_meta
-- Adds ONE JSONB column to properties to hold all PG/Hostel
-- specific fields captured by the new 4-step onboarding wizard.
--
-- Safe to re-run (IF NOT EXISTS).
-- No RLS changes. No column renames. No data loss.
-- ============================================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS hostel_meta JSONB;

COMMENT ON COLUMN properties.hostel_meta IS
  'PG/Hostel-only fields from the dealer onboarding wizard. Shape:
   {
     pg_name: string,
     user_type: "owner" | "manager" | "agent",
     address: string,
     pincode: string,
     landmark: string,
     operational_since: string,      -- year, e.g. "2019"
     present_on_floor: string,
     room_categories: string[],      -- ["single","double","triple","four","other"]
     target_gender: "male" | "female" | "both",
     tenant_types: string[],         -- ["students","professionals"]
     house_rules: string[],          -- ["veg_only","no_smoking",...]
     notice_period: string,          -- "15" | "30" | "60"
     gate_timing_enabled: boolean,
     gate_closing_time: string,      -- "20:00".."00:00"
     services: string[],             -- ["laundry","cleaning","warden"]
     food_provided: boolean,
     common_amenities: string[],     -- ["kitchen","ro","fridge",...]
     parking_enabled: boolean,
     parking_types: string[],        -- ["two_wheeler","car"]
     usp_category: string,
     usp_text: string,
     photo_tags: Record<string,string>   -- publicUrl -> tag
   }';

-- Optional: index for future admin filtering by PG name.
-- Uncomment only if you start querying inside hostel_meta.
-- CREATE INDEX IF NOT EXISTS idx_properties_hostel_meta ON properties USING GIN (hostel_meta);

-- ============================================================
-- Unrelated but critical fix, found while testing this feature:
-- scripts/seed.mjs inserts properties with EXPLICIT ids (1..80),
-- which never advances the "properties_id_seq" identity sequence.
-- Every dealer submission since (both the old form and this new
-- wizard) has been at risk of "duplicate key value violates
-- unique constraint properties_pkey" the moment nextval() lands
-- on an id the seed script already used.
-- This resyncs the sequence to the current max id. Safe, standard,
-- idempotent — run it once now and again any time you bulk-insert
-- properties with explicit ids in the future.
-- ============================================================
SELECT setval(
  pg_get_serial_sequence('properties', 'id'),
  COALESCE((SELECT MAX(id) FROM properties), 1)
);
