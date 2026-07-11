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
