/* ──────────────────────────────────────────────────────────────
   Room (PG) wizard — types & config. Deliberately independent of
   ../types.ts (Hostel's shared HostelForm/ROOM_CATEGORIES/etc.) — this
   flow reuses the SAME hostel_meta/property_units DB shape as Hostel
   (see docs note in RoomFlow.tsx), but has its own frontend field set,
   labels, and category list per Bhavya's spec. The Hostel flow's own
   files are never imported here and never touched by this module.

   Frontend label is always "Room (PG)" — "PG" is kept only as a
   familiar term for Kota users. The stored ptype is always exactly
   "Room". ────────────────────────────────────────────────────────── */

export type RoomCategoryKey = "single" | "double" | "triple" | "kitchen";

export const ROOM_TYPE_OPTIONS: { key: RoomCategoryKey; label: string; capacity: number }[] = [
  { key: "single", label: "Single Room", capacity: 1 },
  { key: "double", label: "Double Room", capacity: 2 },
  { key: "triple", label: "Triple Room", capacity: 3 },
  { key: "kitchen", label: "Room with Kitchen", capacity: 1 },
];

export type RoomUserType = "owner" | "manager" | "broker";

export const ROOM_USER_TYPES: { key: RoomUserType; label: string }[] = [
  { key: "owner", label: "Owner" },
  { key: "manager", label: "Property Manager" },
  { key: "broker", label: "Broker" },
];

export const PREFERRED_TENANTS = [
  { key: "students", label: "Students" },
  { key: "professionals", label: "Working Professionals" },
  { key: "family", label: "Family" },
  { key: "anyone", label: "Anyone" },
] as const;

export type CoolingType = "" | "ac" | "cooler" | "fan";

export const COOLING_OPTIONS: { key: CoolingType; label: string; icon: string }[] = [
  { key: "ac", label: "AC", icon: "❄️" },
  { key: "cooler", label: "Cooler", icon: "🌬️" },
  { key: "fan", label: "Fan", icon: "🌀" },
];

// Furniture chips — Almirah (Cupboard) label is intentional, per Bhavya:
// more familiar to Kota users than "Cupboard" alone.
export const FURNITURE_OPTIONS = [
  { key: "bed", label: "Bed" },
  { key: "mattress", label: "Mattress" },
  { key: "study_table", label: "Study Table" },
  { key: "chair", label: "Chair" },
  { key: "almirah", label: "Almirah (Cupboard)" },
  { key: "geyser", label: "Geyser" },
] as const;

export const MESS_MEAL_OPTIONS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
] as const;

export const MESS_TYPE_OPTIONS = [
  { key: "veg", label: "Veg" },
  { key: "non_veg", label: "Non Veg" },
] as const;

export type ElectricityBilling = "" | "included" | "metered" | "fixed";

export const ELECTRICITY_OPTIONS: { key: ElectricityBilling; label: string }[] = [
  { key: "included", label: "Included" },
  { key: "metered", label: "Separate Meter" },
  { key: "fixed", label: "Fixed Charge" },
];

// "Bike / Cycle" wording is intentional — most students in Kota use
// bicycles or bikes, per Bhavya.
export const PARKING_OPTIONS = [
  { key: "bike_cycle", label: "Bike / Cycle" },
  { key: "car", label: "Car" },
] as const;

// A different, paired rule set than Hostel's HOUSE_RULES — modern chip
// style, explicit opposite pairs (Visitors Allowed/Restricted, Pets
// Allowed/Not Allowed) rather than single implied-negative flags.
export const HOUSE_RULES = [
  { key: "no_smoking", label: "Smoking Not Allowed" },
  { key: "no_alcohol", label: "Alcohol Not Allowed" },
  { key: "visitors_allowed", label: "Visitors Allowed" },
  { key: "visitors_restricted", label: "Visitors Restricted" },
  { key: "pets_allowed", label: "Pets Allowed" },
  { key: "pets_not_allowed", label: "Pets Not Allowed" },
  { key: "veg_only", label: "Veg Only" },
] as const;

export const GATE_TIMES = [
  { value: "20:00", label: "8:00 PM" },
  { value: "21:00", label: "9:00 PM" },
  { value: "22:00", label: "10:00 PM" },
  { value: "23:00", label: "11:00 PM" },
  { value: "00:00", label: "12:00 AM" },
] as const;

/* ── Per-room-type variant (Step 2) — the "+ Add Another Variant"
   mechanism. `variantName` is purely for the owner's own inventory
   management (e.g. "AC Premium", "Balcony Room") — never shown on the
   public listing; falls back to "Variant 1"/"Variant 2"/... by position
   whenever left blank. `id` is the real identity (multiple variants can
   share the same `key`/category). ─────────────────────────────────── */
export type RoomVariant = {
  id: string;
  key: RoomCategoryKey;
  variantName: string;
  totalRooms: string; // "Total Rooms of this Variant" — maps to property_units.total_count
  rentPerMonth: string;
  deposit: string;
  coolingType: CoolingType;
  attachedBathroom: boolean;
  kitchen: boolean;
  balcony: boolean;
  furnished: boolean;
  furniture: string[];
  availableFrom: string;
};

function variantId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyRoomVariant(key: RoomCategoryKey): RoomVariant {
  return {
    id: variantId(),
    key,
    variantName: "",
    totalRooms: "",
    rentPerMonth: "",
    deposit: "",
    coolingType: "",
    attachedBathroom: false,
    kitchen: key === "kitchen",
    balcony: false,
    furnished: false,
    furniture: [],
    availableFrom: "",
  };
}

export function variantDisplayName(v: RoomVariant, positionIndex: number): string {
  return v.variantName.trim() || `Variant ${positionIndex + 1}`;
}

export function roomTypeLabel(key: RoomCategoryKey): string {
  return ROOM_TYPE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function roomTypeCapacity(key: RoomCategoryKey): number {
  return ROOM_TYPE_OPTIONS.find((o) => o.key === key)?.capacity ?? 1;
}

/* ── Form shape — plain JSON-serializable object (no File objects),
   autosaved verbatim into property_drafts.form_data, same convention as
   HostelForm/SaleForm. Photo/video File state lives in RoomFlow.tsx. ── */
export type RoomForm = {
  // Step 1
  propertyName: string;
  userType: RoomUserType;
  roomTypeSelection: "single" | "multiple";
  selectedCategories: RoomCategoryKey[];

  loc: string;
  address: string;
  landmark: string;
  pincode: string;
  coachingHub: string;
  lat: number | null;
  lng: number | null;

  targetGender: "male" | "female" | "both";
  tenantTypes: string[];
  operationalSince: string;

  // Step 2
  rooms: RoomVariant[];

  // Step 3
  messAvailable: boolean;
  messMeals: string[];
  messType: string;
  electricity: ElectricityBilling;
  parkingTypes: string[];
  laundry: boolean;
  housekeeping: boolean;
  roWater: boolean;
  cctv: boolean;
  gateAlwaysOpen: boolean;
  gateClosingTime: string;
  houseRules: string[];
  description: string;

  // Owner contact — leads route to this number, same pattern as Hostel.
  ownerName: string;
  ownerPhone: string;
  ownerHasWhatsapp: boolean;
};

export function emptyRoomForm(): RoomForm {
  return {
    propertyName: "",
    userType: "owner",
    roomTypeSelection: "single",
    selectedCategories: [],

    loc: "",
    address: "",
    landmark: "",
    pincode: "",
    coachingHub: "",
    lat: null,
    lng: null,

    targetGender: "both",
    tenantTypes: [],
    operationalSince: "",

    rooms: [],

    messAvailable: false,
    messMeals: [],
    messType: "",
    electricity: "",
    parkingTypes: [],
    laundry: false,
    housekeeping: false,
    roWater: false,
    cctv: false,
    gateAlwaysOpen: true,
    gateClosingTime: "22:00",
    houseRules: [],
    description: "",

    ownerName: "",
    ownerPhone: "",
    ownerHasWhatsapp: true,
  };
}

/* Toggling a room category (single-select or within multi-select) keeps
   its Step-2 variant list in sync — adding = append one empty variant,
   removing = drop its variants. Mirrors the Hostel flow's own
   toggleCategory convention (see hostel/Step1Core.tsx). */
export function setSingleCategory(form: RoomForm, key: RoomCategoryKey): RoomForm {
  return {
    ...form,
    roomTypeSelection: "single",
    selectedCategories: [key],
    rooms: [emptyRoomVariant(key)],
  };
}

export function toggleMultipleCategory(form: RoomForm, key: RoomCategoryKey): RoomForm {
  const on = form.selectedCategories.includes(key);
  if (on) {
    return {
      ...form,
      selectedCategories: form.selectedCategories.filter((k) => k !== key),
      rooms: form.rooms.filter((r) => r.key !== key),
    };
  }
  return {
    ...form,
    selectedCategories: [...form.selectedCategories, key],
    rooms: [...form.rooms, emptyRoomVariant(key)],
  };
}

export function hasKitchen(form: RoomForm): boolean {
  return form.selectedCategories.includes("kitchen") || form.rooms.some((r) => r.kitchen);
}
