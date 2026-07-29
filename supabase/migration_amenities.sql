-- Global, reusable amenities system — not Sale-specific. Designed so
-- Hostel/Rent/PG can migrate onto this later (see docs/sale-architecture.md
-- §8) without a redesign, even though only the Sale module consumes it for
-- now (those other flows keep their existing JSONB approach untouched).
--
-- Uses $$...$$ dollar-quoting throughout — regular '...' string literals
-- with apostrophes broke a previous migration file (migration_faq_defaults.sql)
-- via the Supabase SQL editor's smart-quote autocorrect. None of these
-- values have apostrophes, but this stays the safe default for any future
-- edits to this file.

create table if not exists amenities (
  id                          bigserial primary key,
  key                         text not null unique,        -- stable machine key, e.g. "swimming_pool"
  label                       text not null,                -- display label, e.g. "Swimming Pool"
  icon                        text,
  category                    text not null,                -- residential | plot | commercial | universal
  applicable_property_types   text[] not null default '{}',
  is_active                   boolean not null default true,
  sort_order                  int not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table amenities enable row level security;
drop policy if exists "public read amenities" on amenities;
create policy "public read amenities" on amenities for select using (true);

create table if not exists property_amenities (
  property_id   bigint not null references properties(id) on delete cascade,
  amenity_id    bigint not null references amenities(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (property_id, amenity_id)
);

alter table property_amenities enable row level security;
drop policy if exists "public read property_amenities" on property_amenities;
create policy "public read property_amenities" on property_amenities
  for select using (
    exists (
      select 1 from properties
      where properties.id = property_amenities.property_id
        and properties.is_approved = true
    )
  );

-- Seed. Guarded so this file is safe to re-run without duplicating rows.
--
-- Dedup note vs. the original spec: a few items the spec listed as amenity
-- checkboxes duplicate a structured column already captured elsewhere in
-- sale_property_details (Shop's "Washroom"/"Parking" -> shop_washroom /
-- parking_type; Office's "Cabins" -> the cabins int field; Warehouse's
-- "Loading Dock"/"Truck Entry" -> loading_dock / truck_access booleans).
-- Those are intentionally NOT re-seeded as amenities here, to avoid two
-- different pieces of UI/data disagreeing about the same fact.
insert into amenities (key, label, icon, category, applicable_property_types, sort_order)
select * from (values
  -- Residential (Flat / House / Builder Floor)
  ($$247_water$$, $$24x7 Water$$, $$water$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 10),
  ($$cctv$$, $$CCTV$$, $$cctv$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 20),
  ($$gas_pipeline$$, $$Gas Pipeline$$, $$gas$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 30),
  ($$garden$$, $$Garden$$, $$garden$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 40),
  ($$children_park$$, $$Children Park$$, $$park$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 50),
  ($$gym$$, $$Gym$$, $$gym$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 60),
  ($$club_house$$, $$Club House$$, $$clubhouse$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 70),
  ($$swimming_pool$$, $$Swimming Pool$$, $$pool$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 80),
  ($$rain_water_harvesting$$, $$Rain Water Harvesting$$, $$rainwater$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 90),
  ($$temple_nearby$$, $$Temple Nearby$$, $$temple$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 100),
  ($$school_nearby$$, $$School Nearby$$, $$school$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 110),
  ($$hospital_nearby$$, $$Hospital Nearby$$, $$hospital$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 120),
  ($$market_nearby$$, $$Market Nearby$$, $$market$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 130),
  ($$public_transport_nearby$$, $$Public Transport Nearby$$, $$transport$$, $$residential$$, array[$$Flat$$,$$House$$,$$Builder Floor$$], 140),

  -- Shared across residential + commercial (universal)
  ($$lift$$, $$Lift$$, $$lift$$, $$universal$$, array[$$Flat$$,$$House$$,$$Builder Floor$$,$$Shop$$,$$Office$$,$$Showroom$$], 150),
  ($$power_backup$$, $$Power Backup$$, $$power$$, $$universal$$, array[$$Flat$$,$$House$$,$$Builder Floor$$,$$Office$$,$$Showroom$$], 160),
  ($$visitor_parking$$, $$Visitor Parking$$, $$parking$$, $$universal$$, array[$$Flat$$,$$House$$,$$Builder Floor$$,$$Office$$,$$Showroom$$], 170),
  ($$security$$, $$Security$$, $$shield$$, $$universal$$, array[$$Flat$$,$$House$$,$$Builder Floor$$,$$Warehouse-Godown$$], 180),

  -- Plot
  ($$boundary_wall$$, $$Boundary Wall$$, $$wall$$, $$plot$$, array[$$Plot$$], 190),
  ($$corner_plot$$, $$Corner Plot$$, $$corner$$, $$plot$$, array[$$Plot$$], 200),
  ($$park_facing$$, $$Park Facing$$, $$park-facing$$, $$plot$$, array[$$Plot$$], 210),
  ($$gated_colony$$, $$Gated Colony$$, $$gated$$, $$plot$$, array[$$Plot$$], 220),
  ($$electricity_available$$, $$Electricity Available$$, $$electricity$$, $$plot$$, array[$$Plot$$], 230),
  ($$water_connection$$, $$Water Connection$$, $$water-conn$$, $$plot$$, array[$$Plot$$], 240),
  ($$sewer_line$$, $$Sewer Line$$, $$sewer$$, $$plot$$, array[$$Plot$$], 250),
  ($$road_access$$, $$Road Access$$, $$road$$, $$plot$$, array[$$Plot$$], 260),

  -- Shop
  ($$main_road_facing$$, $$Main Road Facing$$, $$road-facing$$, $$commercial$$, array[$$Shop$$], 270),
  ($$corner_shop$$, $$Corner Shop$$, $$shop-corner$$, $$commercial$$, array[$$Shop$$], 280),
  ($$storage_area$$, $$Storage Area$$, $$storage$$, $$commercial$$, array[$$Shop$$], 290),
  ($$high_footfall$$, $$High Footfall$$, $$footfall$$, $$commercial$$, array[$$Shop$$], 300),

  -- Office / Showroom
  ($$reception$$, $$Reception$$, $$reception$$, $$commercial$$, array[$$Office$$,$$Showroom$$], 310),
  ($$conference_room$$, $$Conference Room$$, $$meeting$$, $$commercial$$, array[$$Office$$,$$Showroom$$], 320),
  ($$pantry$$, $$Pantry$$, $$pantry$$, $$commercial$$, array[$$Office$$,$$Showroom$$], 330),
  ($$workstations$$, $$Workstations$$, $$workstation$$, $$commercial$$, array[$$Office$$,$$Showroom$$], 340),
  ($$server_room$$, $$Server Room$$, $$server$$, $$commercial$$, array[$$Office$$,$$Showroom$$], 350),

  -- Warehouse / Godown
  ($$high_ceiling$$, $$High Ceiling$$, $$ceiling$$, $$commercial$$, array[$$Warehouse-Godown$$], 360),
  ($$open_yard$$, $$Open Yard$$, $$yard$$, $$commercial$$, array[$$Warehouse-Godown$$], 370),
  ($$fire_safety$$, $$Fire Safety$$, $$fire$$, $$commercial$$, array[$$Warehouse-Godown$$], 380),
  ($$power_connection$$, $$Power Connection$$, $$power-conn$$, $$commercial$$, array[$$Warehouse-Godown$$], 390),
  ($$office_cabin$$, $$Office Cabin$$, $$cabin$$, $$commercial$$, array[$$Warehouse-Godown$$], 400)
) as v(key, label, icon, category, applicable_property_types, sort_order)
where not exists (select 1 from amenities);
