export type PublicDealer = {
  id: number;
  name: string;
  role: string;
  years: number;
  rating: number;
};

export type Dealer = PublicDealer & {
  phone: string;
};

export type Area = {
  name: string;
  coaching: string | null;
  img: string;
};

export type Property = {
  id: number;
  slug?: string | null;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  coaching: string | null;
  genderPreference: string | null;
  tenantPreference: string[] | null;
  bhk: number;
  baths: number;
  title: string;
  price: number;
  sqft: number;
  furnish: string;
  img: string;
  gallery: string[];
  features: string[];
  dealer: PublicDealer;
  verified: boolean;
  photos: number;
  postedDays: number;
  desc: string;
};

export type Locality = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  level: 'city' | 'locality' | 'sublocality';
  latitude: number | null;
  longitude: number | null;
  status: 'live' | 'coming_soon';
  sort_order: number | null;
  aliases: string[];
  created_at: string;
  // Locality Guide fields (property detail page) — shared across every
  // property in this locality rather than duplicated per-listing. See
  // supabase/migration_locality_guide.sql.
  average_rent?: string | null;
  popular_coachings?: string[] | null;
  best_cafes?: string[] | null;
  transport?: string | null;
  safety_note?: string | null;
};

export type UnitAttributes = {
  bhk?: number;
  occupancy?: 'single' | 'double' | 'triple';
  cooling?: 'ac' | 'cooler' | 'none';
  [key: string]: unknown;
};

export type PropertyUnit = {
  id: number;
  property_id: number;
  label: string;
  capacity: number;
  price_per_month: number;
  deposit_amount: number | null;
  total_count: number;
  available_count: number;
  has_ac: boolean;
  has_cooler: boolean;
  attached_bath: boolean;
  meals_included: boolean;
  description: string | null;
  sort_order: number;
  attributes?: UnitAttributes | null;
  unit_photos?: string[] | null;
  last_confirmed_at?: string | null;
  maintenance?: number | null;
  area_sqft?: number | null;
  floor_num?: number | null;
};

export type HostelMeta = {
  pg_name?: string;
  user_type?: "owner" | "manager" | "agent";
  address?: string;
  pincode?: string | null;
  landmark?: string | null;
  operational_since?: string | null;
  present_on_floor?: string | null;
  room_categories?: string[];
  target_gender?: "male" | "female" | "both";
  tenant_types?: string[];
  house_rules?: string[];
  notice_period?: string;
  gate_timing_enabled?: boolean;
  gate_closing_time?: string | null;
  services?: string[];
  food_provided?: boolean;
  electricity?: "included" | "metered" | "fixed" | null;
  common_amenities?: string[];
  parking_enabled?: boolean;
  parking_types?: string[];
  usp_category?: string | null;
  usp_text?: string | null;
  photo_tags?: Record<string, string>;
  photo_sections?: Record<string, string>;
  // Free-typed coaching hub name — only set when nearest_coaching_hub (the
  // locked enum column) is "Other"; lets the public page show the real name
  // instead of the literal word "Other".
  custom_coaching_hub?: string | null;
  // Price Breakdown section (property detail page) — extra ledger rows
  // beyond rent/deposit/electricity/maintenance, e.g. { label: "Late Entry
  // Charges", value: "₹100 / instance" }. Rendered only when populated.
  price_breakdown_extra?: { label: string; value: string }[];
  // Location & Nearby section — walking distances to coaching institutes /
  // key nearby places. Rendered only when populated. Stays per-property
  // (unlike Locality Guide) — exact walking distances are specific to each
  // building's location.
  nearby_places?: { name: string; distance: string; category?: string }[];
  // FAQ overrides/additions on top of the shared faq_defaults table — matched
  // by question text (see mergeFaqs() in PropertyDetail.tsx).
  faqs?: { question: string; answer: string }[];
};

// Sale module — property-type-specific fields for "For Sale" listings.
// One row per sale property, 1:1 with `properties` (property_id is both PK
// and FK on the DB side). See docs/sale-architecture.md §2.2/§4.2.
export type SalePropertyDetails = {
  property_id: number;
  landmark: string | null;
  society_name: string | null;
  street_address: string | null;
  balconies: number | null;
  house_floors: number | null;
  plot_type: "residential" | "commercial" | "agricultural" | "industrial" | null;
  cabins: number | null;
  meeting_rooms: number | null;
  office_washrooms: number | null;
  shop_washroom: boolean | null;
  covered_area: number | null;
  open_area: number | null;
  truck_access: boolean | null;
  loading_dock: boolean | null;
  property_age: "new" | "0-1" | "1-5" | "5-10" | "10+" | null;
  availability_status: "ready_to_move" | "under_construction" | null;
  possession_date: string | null;
  price_negotiable: boolean;
  area_value: number | null;
  area_unit: "sqft" | "sqyard" | "sqm" | "acre" | "bigha" | null;
  floor_special: "ground" | "basement" | "top" | null;
  facing: "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW" | null;
  ownership_type: "freehold" | "leasehold" | "co_operative" | "power_of_attorney" | null;
  parking_type: "none" | "bike" | "car" | "both" | null;
  poster_role: "owner" | "builder" | "broker" | null;
  documents: { doc_type: string; url: string }[];
  created_at: string;
  updated_at: string;
};

// Global amenities master list (docs/sale-architecture.md §2.3) — not
// Sale-specific, designed for other property types to adopt later.
export type Amenity = {
  id: number;
  key: string;
  label: string;
  icon: string | null;
  category: "residential" | "plot" | "commercial" | "universal";
  applicable_property_types: string[];
  is_active: boolean;
  sort_order: number;
};

export type ListingStatus = "pending" | "live" | "paused_owner" | "paused_admin" | "rejected";

export type PropertyDraft = {
  id: number;
  dealer_id: number;
  purpose: "rent" | "sale" | "pg";
  form_data: Record<string, unknown>;
  updated_at: string;
};

export type PropertyFull = {
  id: number;
  slug: string | null;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  bhk: number;
  baths: number;
  title: string;
  price: number;
  rent_per_month: number | null;
  deposit_amount: number | null;
  sqft: number | null;
  furnish: string | null;
  furnishing_status: string | null;
  img: string | null;
  gallery: string[];
  videos: string[];
  features: string[];
  description: string | null;
  gender_preference: string | null;
  available_from: string | null;
  nearest_coaching_hub: string | null;
  meals_included: boolean;
  parking_available: boolean;
  wifi_included: boolean;
  attached_bathroom: boolean;
  min_stay_months: number | null;
  floor_number: number | null;
  total_floors: number | null;
  lat: number | null;
  lng: number | null;
  locality_id: string | null;
  // Joined `localities` row (see app/property/[slug]/page.tsx's
  // `locality:localities!locality_id(*)` select) — carries the Locality
  // Guide fields. Optional/undefined when not selected by a given query.
  locality?: Locality | null;
  amenities: Record<string, boolean> | null;
  hostel_meta: HostelMeta | null;
  // Sale module joins — optional/undefined when not selected by a given
  // query (only the property detail page's future sale-display work would
  // populate these; the posting flow writes them via separate inserts).
  sale_details?: SalePropertyDetails | null;
  amenity_keys?: string[];
  verified: boolean;
  is_verified: boolean;
  is_featured: boolean;
  posted_days: number;
  created_at: string;
  dealers: PublicDealer | null;
  property_units: PropertyUnit[];
};

export type Lead = {
  id: number;
  reference_code: string;
  customer_name: string;
  customer_phone: string;
  property_id: number | null;
  dealer_id: number | null;
  unit_id: number | null;
  unit_label: string | null;
  intent: string | null;
  source_url: string | null;
  magic_token: string;
  status: "new" | "contacted" | "closed" | "dead";
  move_in_date: string | null;
  occupants: number | null;
  msg: string | null;
  contacted_at: string | null;
  closed_at: string | null;
  created_at: string;
};
