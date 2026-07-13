/* ──────────────────────────────────────────────────────────────
   Post-Property wizard — shared types & config.
   Single source of truth for both the PG/Hostel flow and the
   standard (rent/sale) flow.
   ────────────────────────────────────────────────────────────── */

/* Purpose is a FORM-LEVEL construct only.
   It maps to the DB columns at save time:
     "pg"   -> type='rent', ptype='Hostel' | 'PG'
     "rent" -> type='rent', ptype=<chosen>
     "sale" -> type='sale', ptype=<chosen>                        */
export type Purpose = "rent" | "sale" | "pg";

export type PgKind = "Hostel" | "PG";

export type RoomCategoryKey = "single" | "double" | "triple" | "four" | "other";

export type UserType = "owner" | "manager" | "agent";

/* ── Option lists ──────────────────────────────────────────── */

export const PURPOSES: { key: Purpose; label: string; icon: string; sub: string }[] = [
  { key: "pg",   label: "PG / Hostel", icon: "🏨", sub: "Rooms let per bed" },
  { key: "rent", label: "For Rent",    icon: "🔑", sub: "Flat, house, room, shop" },
  { key: "sale", label: "For Sale",    icon: "🏷️", sub: "Flat, house, shop, plot" },
];

/* Hostel/PG is NOT in these lists — it has its own purpose. */
export const RENT_PTYPES = ["Room", "Flat", "House", "Shop"] as const;
export const SALE_PTYPES = ["Flat", "House", "Shop", "Plot"] as const;

export const ROOM_CATEGORIES: { key: RoomCategoryKey; label: string; capacity: number }[] = [
  { key: "single", label: "Single",  capacity: 1 },
  { key: "double", label: "Double",  capacity: 2 },
  { key: "triple", label: "Triple",  capacity: 3 },
  { key: "four",   label: "Four",    capacity: 4 },
  { key: "other",  label: "Other",   capacity: 1 },
];

export const USER_TYPES: { key: UserType; label: string }[] = [
  { key: "owner",   label: "Owner" },
  { key: "manager", label: "Property Manager" },
  { key: "agent",   label: "Agent" },
];

// AC / Air Cooler are NOT here — they're a dedicated per-variant single-select
// (COOLING_TYPES below) so "Single + AC" and "Single + Cooler" can exist as
// two separate bookable options instead of two checkboxes on one shared card.
export const ROOM_FACILITIES = [
  { key: "geyser",     label: "Geyser",     icon: "🚿" },
  { key: "washroom",   label: "Washroom",   icon: "🚽" },
  { key: "cupboard",   label: "Cupboard",   icon: "🗄️" },
  { key: "tv",         label: "TV",         icon: "📺" },
  { key: "cot",        label: "Cot",        icon: "🛏️" },
  { key: "mattress",   label: "Mattress",   icon: "🛌" },
  { key: "side_table", label: "Side Table", icon: "🪑" },
  { key: "chair",      label: "Chair",      icon: "💺" },
] as const;

export type CoolingType = "ac" | "cooler" | "none";

export const COOLING_TYPES: { key: CoolingType; label: string; icon: string }[] = [
  { key: "ac",     label: "AC",         icon: "❄️" },
  { key: "cooler", label: "Air Cooler", icon: "🌬️" },
  { key: "none",   label: "No Cooling", icon: "➖" },
];

export const HOUSE_RULES = [
  { key: "veg_only",         label: "Veg only" },
  { key: "no_smoking",       label: "No smoking" },
  { key: "no_alcohol",       label: "Alcohol not allowed" },
  { key: "no_opp_gender",    label: "Opposite gender entry not allowed" },
  { key: "no_guardian",      label: "Guardian stay not allowed" },
] as const;

export const TENANT_TYPES = [
  { key: "students",      label: "Students" },
  { key: "professionals", label: "Working Professionals" },
] as const;

export const CORE_SERVICES = [
  { key: "laundry",  label: "Laundry",       icon: "🧺" },
  { key: "cleaning", label: "Room Cleaning", icon: "🧹" },
  { key: "warden",   label: "Warden",        icon: "👮" },
] as const;

export const COMMON_AMENITIES = [
  { key: "kitchen",      label: "Kitchen for self-cooking", icon: "🍳" },
  { key: "ro",           label: "RO Water",                 icon: "💧" },
  { key: "fridge",       label: "Fridge",                   icon: "🧊" },
  { key: "microwave",    label: "Microwave",                icon: "🔥" },
  { key: "lift",         label: "Lift",                     icon: "🛗" },
  { key: "gym",          label: "Gymnasium",                icon: "🏋️" },
  { key: "power_backup", label: "Power Backup",             icon: "🔌" },
  { key: "wifi",         label: "Wi-Fi",                    icon: "📶" },
  { key: "tv",           label: "TV",                       icon: "📺" },
] as const;

export const PARKING_TYPES = [
  { key: "two_wheeler", label: "2 Wheeler", icon: "🛵" },
  { key: "car",         label: "Car",       icon: "🚗" },
] as const;

export const NOTICE_PERIODS = [
  { value: "15", label: "15 days" },
  { value: "30", label: "1 month" },
  { value: "60", label: "2 months" },
] as const;

export const GATE_TIMES = [
  { value: "20:00", label: "8:00 PM" },
  { value: "21:00", label: "9:00 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "23:00", label: "11:00 PM" },
  { value: "00:00", label: "12:00 AM" },
] as const;

export const USP_CATEGORIES = [
  "Food", "Room", "PG Building", "Locality", "Amenities", "Other",
] as const;

/* Photo context tags — attached to each uploaded image */
export const PHOTO_TAGS = [
  { value: "bed",        label: "Bed image" },
  { value: "room",       label: "Room image" },
  { value: "toilet",     label: "Toilet image" },
  { value: "amenities",  label: "Room amenities" },
  { value: "tour",       label: "Room tour video" },
] as const;

/* Media sections shown on Step 4 (fixed, non-room ones) */
export const MEDIA_SECTIONS = [
  { key: "building",     label: "Building View",     icon: "🏢" },
  { key: "common_area",  label: "Common Area",       icon: "🛋️" },
  { key: "amenities",    label: "Common Amenities",  icon: "✨" },
  { key: "kitchen",      label: "Kitchen",           icon: "🍳" },
  { key: "neighborhood", label: "Neighborhood View", icon: "🏘️" },
] as const;

/* ── Per-room-category configuration (Step 2) ──────────────── */
// `id` is the real identity — multiple RoomConfig entries can share the same
// `key` (occupancy category), e.g. two "single" entries: one AC, one Cooler,
// each its own bookable variant with its own rent/deposit/availability.
export type RoomConfig = {
  id: string;
  key: RoomCategoryKey;
  customLabel: string;      // used only when key === "other"
  numRooms: string;
  rentPerBed: string;
  deposit: string;
  facilities: string[];     // keys from ROOM_FACILITIES
  coolingType: CoolingType;
};

function roomConfigId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyRoomConfig(key: RoomCategoryKey): RoomConfig {
  return {
    id: roomConfigId(),
    key,
    customLabel: "",
    numRooms: "",
    rentPerBed: "",
    deposit: "",
    facilities: [],
    coolingType: "none",
  };
}

/* ── PG / Hostel form ──────────────────────────────────────── */
export type HostelForm = {
  // Step 1
  pgKind: PgKind;
  pgName: string;
  userType: UserType;
  loc: string;
  address: string;
  pincode: string;
  landmark: string;
  operationalSince: string;
  presentOnFloor: string;
  coachingHub: string;
  roomCategories: RoomCategoryKey[];

  // Step 2
  rooms: RoomConfig[];
  targetGender: "male" | "female" | "both";
  tenantTypes: string[];
  houseRules: string[];
  noticePeriod: string;
  gateTimingEnabled: boolean;
  gateClosingTime: string;
  services: string[];
  foodProvided: boolean;

  // Step 3
  commonAmenities: string[];
  parkingEnabled: boolean;
  parkingTypes: string[];
  uspCategory: string;
  uspText: string;
  description: string;

  // Step 4
  availFrom: string;
  minStay: string;
};

export function emptyHostelForm(): HostelForm {
  return {
    pgKind: "Hostel",
    pgName: "",
    userType: "owner",
    loc: "",
    address: "",
    pincode: "",
    landmark: "",
    operationalSince: "",
    presentOnFloor: "",
    coachingHub: "",
    roomCategories: [],

    rooms: [],
    targetGender: "both",
    tenantTypes: [],
    houseRules: [],
    noticePeriod: "30",
    gateTimingEnabled: false,
    gateClosingTime: "22:00",
    services: [],
    foodProvided: false,

    commonAmenities: [],
    parkingEnabled: false,
    parkingTypes: [],
    uspCategory: "",
    uspText: "",
    description: "",

    availFrom: "",
    minStay: "",
  };
}

/* ── Standard (rent / sale) form ───────────────────────────── */
export type StandardForm = {
  purpose: "rent" | "sale";
  ptype: string;
  loc: string;
  bhk: number;
  baths: number;
  price: string;
  deposit: string;
  sqft: string;
  furnishing: string;
  availFrom: string;
  minStay: string;
  floorNum: string;
  totalFloors: string;
  parking: boolean;
  wifi: boolean;
  attachedBath: boolean;
  coachingHub: string;
  features: string[];
  description: string;
};

export function emptyStandardForm(purpose: "rent" | "sale"): StandardForm {
  return {
    purpose,
    ptype: purpose === "rent" ? "Flat" : "Flat",
    loc: "",
    bhk: 1,
    baths: 1,
    price: "",
    deposit: "",
    sqft: "",
    furnishing: "",
    availFrom: "",
    minStay: "",
    floorNum: "",
    totalFloors: "",
    parking: false,
    wifi: false,
    attachedBath: false,
    coachingHub: "",
    features: [],
    description: "",
  };
}

/* ── Helpers ───────────────────────────────────────────────── */

export function roomCategoryLabel(cfg: RoomConfig): string {
  if (cfg.key === "other") return cfg.customLabel.trim() || "Other";
  return ROOM_CATEGORIES.find((c) => c.key === cfg.key)?.label ?? cfg.key;
}

export function roomCategoryCapacity(cfg: RoomConfig): number {
  return ROOM_CATEGORIES.find((c) => c.key === cfg.key)?.capacity ?? 1;
}

/* Does this property type need BHK / bathroom counts? */
export function needsBhk(ptype: string): boolean {
  return !["Shop", "Plot"].includes(ptype);
}

/* Does this property type have a floor? */
export function needsFloor(ptype: string): boolean {
  return ptype !== "Plot";
}

/* Sale listings never ask for rent-only fields. */
export function isRentPurpose(p: Purpose): boolean {
  return p === "rent" || p === "pg";
}
