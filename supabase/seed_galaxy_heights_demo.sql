-- One-off DEMO data seed — not a schema migration. Populates the
-- "GALAXY HEIGHTS girls hostel" test listing (properties.id = 96, slug
-- hostel-rajeev-gandhi-nagar-kota-q0ueo) so the Location & Nearby / FAQ /
-- Locality Guide sections can be visually reviewed on the property detail
-- page before the admin UI for managing this content is built. Safe to
-- edit/replace directly in Supabase at any time.
--
-- Run this AFTER migration_locality_guide.sql and migration_faq_defaults.sql.
--
-- Uses $$...$$ dollar-quoting for every text value instead of '...' so
-- apostrophes never need escaping and can't get mangled by a SQL editor's
-- smart-quote autocorrect (this is what broke migration_faq_defaults.sql's
-- first run — "Sudama's" and "it's"-style contractions).

-- TODO: this backfills locality_id for property 96 ONLY. Every other existing
-- listing stays without a linked locality (so its Locality Guide section
-- stays hidden) until either the future localities-manager admin UI lets
-- listings be linked by hand, or a one-time backfill script matches
-- properties.loc to localities.name for the rest of the catalog.
update properties
set locality_id = '812d8856-a637-4f87-9ef9-ecf954a3e987' -- "Rajeev Gandhi Nagar"
where id = 96;

update localities set
  average_rent = $$₹5,500 – ₹9,000 / month$$,
  popular_coachings = array[$$Allen$$, $$Motion$$, $$Physics Wallah$$, $$Resonance$$],
  best_cafes = array[$$Chaayos$$, $$Cafe Iyaar$$, $$Sudama Sweets$$],
  transport = $$City bus routes 3, 7 and 12 pass through. Auto stand 2 min walk.$$,
  safety_note = $$Well-lit main road, police patrol at night$$
where id = '812d8856-a637-4f87-9ef9-ecf954a3e987';

-- Per-property nearby places (genuinely specific to this building) + two FAQ
-- entries: the first overrides a default question's answer with a
-- property-specific one, the second is a net-new addition not in the
-- shared defaults — demonstrates both merge paths at once.
update properties
set hostel_meta = hostel_meta || jsonb_build_object(
  'nearby_places', jsonb_build_array(
    jsonb_build_object('name', $$Allen Sankalp$$, 'distance', $$350m$$),
    jsonb_build_object('name', $$Motion Education$$, 'distance', $$600m$$),
    jsonb_build_object('name', $$Public Library$$, 'distance', $$150m$$),
    jsonb_build_object('name', $$Tiffin / Mess$$, 'distance', $$80m$$),
    jsonb_build_object('name', $$Medical Store$$, 'distance', $$100m$$),
    jsonb_build_object('name', $$Bus Stop$$, 'distance', $$2 min walk$$)
  ),
  'faqs', jsonb_build_array(
    jsonb_build_object(
      'question', $$Is there a curfew / gate closing time?$$,
      'answer', $$Gate closes at 9:00 PM here specifically. Late entry needs prior notice to the warden.$$
    ),
    jsonb_build_object(
      'question', $$Is this hostel only for girls?$$,
      'answer', $$Yes, Galaxy Heights is a girls-only hostel.$$
    )
  )
)
where id = 96;
