/* ──────────────────────────────────────────────────────────────
   Sale wizard — types & config. Deliberately independent of the
   shared ../types.ts (Rent/PG's StandardForm, SALE_PTYPES, etc.) —
   see docs/sale-architecture.md for why Sale has its own flow/schema
   instead of extending StandardFlow. Rent's file is never imported
   here and is never touched by this module.
   ────────────────────────────────────────────────────────────── */

export const SALE_PROPERTY_TYPES = [
  { key: "Flat", label: "Flat", icon: "🏢" },
  { key: "House", label: "House", icon: "🏠" },
  { key: "Builder Floor", label: "Builder Floor", icon: "🏗️" },
  { key: "Plot", label: "Plot", icon: "🌳" },
  { key: "Shop", label: "Shop", icon: "🏪" },
  { key: "Office", label: "Office", icon: "💼" },
  { key: "Showroom", label: "Showroom", icon: "🛍️" },
  { key: "Warehouse-Godown", label: "Warehouse / Godown", icon: "📦" },
] as const;

export type SalePtype = (typeof SALE_PROPERTY_TYPES)[number]["key"];

export const PLOT_TYPES = [
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
  { key: "agricultural", label: "Agricultural" },
  { key: "industrial", label: "Industrial" },
] as const;

export const FACING_OPTIONS = [
  { key: "N", label: "North" },
  { key: "S", label: "South" },
  { key: "E", label: "East" },
  { key: "W", label: "West" },
  { key: "NE", label: "North East" },
  { key: "NW", label: "North West" },
  { key: "SE", label: "South East" },
  { key: "SW", label: "South West" },
] as const;

export const OWNERSHIP_TYPES = [
  { key: "freehold", label: "Freehold" },
  { key: "leasehold", label: "Leasehold" },
  { key: "co_operative", label: "Co-operative" },
  { key: "power_of_attorney", label: "Power of Attorney" },
] as const;

export const PARKING_TYPES = [
  { key: "none", label: "No Parking" },
  { key: "bike", label: "Bike Parking" },
  { key: "car", label: "Car Parking" },
  { key: "both", label: "Both" },
] as const;

export const PROPERTY_AGE_OPTIONS = [
  { key: "new", label: "New Construction" },
  { key: "0-1", label: "0-1 Years" },
  { key: "1-5", label: "1-5 Years" },
  { key: "5-10", label: "5-10 Years" },
  { key: "10+", label: "10+ Years" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { key: "ready_to_move", label: "Ready to Move" },
  { key: "under_construction", label: "Under Construction" },
] as const;

export const AREA_UNITS = [
  { key: "sqft", label: "sq.ft" },
  { key: "sqyard", label: "sq.yard" },
  { key: "sqm", label: "sqm" },
  { key: "acre", label: "acre" },
  { key: "bigha", label: "bigha" },
] as const;

export const FURNISHING_OPTIONS = [
  { key: "unfurnished", label: "Unfurnished" },
  { key: "semi-furnished", label: "Semi Furnished" },
  { key: "furnished", label: "Fully Furnished" },
] as const;

export const FLOOR_SPECIAL_OPTIONS = [
  { key: "ground", label: "Ground Floor" },
  { key: "basement", label: "Basement" },
  { key: "top", label: "Top Floor" },
] as const;

export const OWNER_ROLES = [
  { key: "owner", label: "Owner" },
  { key: "builder", label: "Builder" },
  { key: "broker", label: "Broker" },
] as const;

export const CONTACT_TIME_OPTIONS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "anytime", label: "Anytime" },
] as const;

export const DOCUMENT_TYPES = [
  { key: "sale_deed", label: "Sale Deed" },
  { key: "registry", label: "Registry" },
  { key: "patta", label: "Patta" },
  { key: "rera", label: "RERA" },
  { key: "mutation", label: "Mutation" },
  { key: "other", label: "Other" },
] as const;

/* ── Form shape — must stay a plain JSON-serializable object (no File
   objects) since it's autosaved verbatim into property_drafts.form_data.
   Photo/video File state lives separately in SaleFlow.tsx, exactly like
   StandardFlow/HostelFlow already do. ─────────────────────────────── */
export type SaleForm = {
  // Step 1 — Property Basics
  ptype: string;
  loc: string;
  landmark: string;
  societyName: string;
  streetAddress: string;
  lat: number | null;
  lng: number | null;

  bhk: number; // Flat/Builder Floor: BHK. House: Bedrooms.
  baths: number;
  balconies: number;
  houseFloors: string; // House "Floors" field only
  floorNum: string;
  totalFloors: string;

  plotType: string; // "" | residential | commercial | agricultural | industrial

  shopWashroom: boolean;
  cabins: string;
  meetingRooms: string;
  officeWashrooms: string;
  coveredArea: string;
  openArea: string;
  truckAccess: boolean;
  loadingDock: boolean;

  propertyAge: string; // "" | new | 0-1 | 1-5 | 5-10 | 10+
  availabilityStatus: string; // "" | ready_to_move | under_construction
  possessionDate: string;

  // Step 2 — Specifications
  price: string;
  priceNegotiable: boolean;
  areaValue: string;
  areaUnit: string; // sqft | sqyard | sqm | acre | bigha
  furnishing: string; // "" | unfurnished | semi-furnished | furnished
  floorSpecial: string; // "" | ground | basement | top
  facing: string; // "" | N | S | E | W | NE | NW | SE | SW
  ownershipType: string; // "" | freehold | leasehold | co_operative | power_of_attorney
  parkingType: string; // none | bike | car | both
  amenityKeys: string[];
  description: string;

  // Step 4 — Owner Details & Publish
  ownerRole: string; // owner | builder | broker
  sellerName: string;
  whatsappSameAsPhone: boolean;
  whatsappNumber: string;
  email: string;
  preferredContactTime: string; // "" | morning | afternoon | evening | anytime
  declarationChecked: boolean;
};

export function emptySaleForm(sellerName = ""): SaleForm {
  return {
    ptype: "Flat",
    loc: "",
    landmark: "",
    societyName: "",
    streetAddress: "",
    lat: null,
    lng: null,

    bhk: 1,
    baths: 1,
    balconies: 0,
    houseFloors: "",
    floorNum: "",
    totalFloors: "",

    plotType: "",

    shopWashroom: false,
    cabins: "",
    meetingRooms: "",
    officeWashrooms: "",
    coveredArea: "",
    openArea: "",
    truckAccess: false,
    loadingDock: false,

    propertyAge: "",
    availabilityStatus: "",
    possessionDate: "",

    price: "",
    priceNegotiable: false,
    areaValue: "",
    areaUnit: "sqft",
    furnishing: "",
    floorSpecial: "",
    facing: "",
    ownershipType: "",
    parkingType: "none",
    amenityKeys: [],
    description: "",

    ownerRole: "owner",
    sellerName,
    whatsappSameAsPhone: true,
    whatsappNumber: "",
    email: "",
    preferredContactTime: "",
    declarationChecked: false,
  };
}

/* ── Dynamic field-visibility helpers — one small pure function per
   field group, mirroring the pattern already used in the shared
   ../types.ts (needsBhk/needsFloor). See docs/sale-architecture.md §6
   for the full visibility matrix. ─────────────────────────────────── */
export function needsBhk(ptype: string): boolean {
  return ["Flat", "House", "Builder Floor"].includes(ptype);
}
// Floor Number + Total Floors pair — Flat, Builder Floor, Shop, Office,
// Showroom. Plot has no floor concept; House uses a single "Floors" field
// (needsHouseFloors) instead; Warehouse/Godown is ground-level, no floor.
export function needsFloorInfo(ptype: string): boolean {
  return ["Flat", "Builder Floor", "Shop", "Office", "Showroom"].includes(ptype);
}
export function needsHouseFloors(ptype: string): boolean {
  return ptype === "House";
}
export function needsPlotType(ptype: string): boolean {
  return ptype === "Plot";
}
export function needsShopFields(ptype: string): boolean {
  return ptype === "Shop";
}
export function needsOfficeFields(ptype: string): boolean {
  return ptype === "Office" || ptype === "Showroom";
}
export function needsWarehouseFields(ptype: string): boolean {
  return ptype === "Warehouse-Godown";
}
export function needsFurnishing(ptype: string): boolean {
  return ["Flat", "House", "Builder Floor"].includes(ptype);
}
