import { createClient } from "@supabase/supabase-js";
import { fmt } from "./format";

/* ─── Slug ↔ Label maps ──────────────────────────────────────── */

export const AREA_SLUGS: Record<string, string> = {
  "talwandi":             "Talwandi",
  "rajeev-gandhi-nagar":  "Rajeev Gandhi Nagar",
  "mahaveer-nagar":       "Mahaveer Nagar",
  "vigyan-nagar":         "Vigyan Nagar",
  "dadabadi":             "Dadabadi",
  "borkhera":             "Borkhera",
  "shreenathpuram":       "Shreenathpuram",
  "rangbari":             "Rangbari",
  "rk-puram":             "R.K. Puram",
  "keshavpura":           "Keshavpura",
  "kunhadi":              "Kunhadi",
  "coral-park":           "Coral Park",
  "nayapura":             "Nayapura",
  "jawahar-nagar":        "Jawahar Nagar",
};

export const TYPE_SLUGS: Record<string, string> = {
  "hostel": "Hostel",
  "pg":     "PG",
  "room":   "Room",
  "flat":   "Flat",
  "house":  "House",
  "shop":   "Shop",
  "plot":   "Plot",
};

export const HUB_SLUGS: Record<string, string> = {
  "allen":     "Allen",
  "resonance": "Resonance",
  "fiitjee":   "FIITJEE",
  "vibrant":   "Vibrant",
  "motion":    "Motion",
};

// Reverse maps — label → slug
export const AREA_TO_SLUG = Object.fromEntries(
  Object.entries(AREA_SLUGS).map(([slug, label]) => [label, slug])
);
export const TYPE_TO_SLUG = Object.fromEntries(
  Object.entries(TYPE_SLUGS).map(([slug, label]) => [label, slug])
);
export const HUB_TO_SLUG = Object.fromEntries(
  Object.entries(HUB_SLUGS).map(([slug, label]) => [label, slug])
);

/* ─── Property type ─────────────────────────────────────────── */

export type SeoProperty = {
  id: number;
  slug: string | null;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  bhk: number;
  title: string;
  price: number;
  rent_per_month: number | null;
  sqft: number | null;
  img: string | null;
  gallery: string[] | null;
  nearest_coaching_hub: string | null;
  dealers: { name: string } | null;
};

/* ─── Fetch helper ──────────────────────────────────────────── */

export async function getPropertiesFiltered(opts: {
  area?: string;
  ptype?: string;
  coaching?: string;
  limit?: number;
}): Promise<SeoProperty[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];

  const db = createClient(url, key, { auth: { persistSession: false } });
  let q = db
    .from("properties")
    .select("id,slug,type,ptype,loc,bhk,title,price,rent_per_month,sqft,img,gallery,nearest_coaching_hub,dealers!dealer_id(name)")
    .eq("is_approved", true);

  if (opts.area)     q = q.eq("loc", opts.area);
  if (opts.ptype)    q = q.eq("ptype", opts.ptype);
  if (opts.coaching) q = q.eq("nearest_coaching_hub", opts.coaching);
  q = q.limit(opts.limit ?? 60).order("posted_days");

  const { data } = await q;
  return (data ?? []) as unknown as SeoProperty[];
}

/* ─── SEO text generators ───────────────────────────────────── */

// Title helpers
export function areaTypeTitle(area: string, ptype?: string): string {
  if (!ptype) return `Property in ${area}, Kota — Flats, Hostels, PG & Rooms`;
  const typeLabel = ptypeFullLabel(ptype);
  return `${typeLabel} in ${area}, Kota — ${ptypeSuffix(ptype, area)}`;
}

export function typeTitle(ptype: string): string {
  return `${ptypeFullLabel(ptype)} in Kota — ${ptypeSuffix(ptype)}`;
}

export function hubTitle(hub: string, ptype?: string): string {
  if (!ptype) return `Properties Near ${hub} Kota — Hostel, PG, Flat & Rooms`;
  return `${ptypeFullLabel(ptype)} Near ${hub} Kota — ${ptypeSuffix(ptype)}`;
}

// Description helpers
export function areaTypeDesc(area: string, ptype?: string, count = 0): string {
  const ct = count > 0 ? `${count} verified ` : "";
  if (!ptype) {
    return `Find ${ct}hostels, PGs, 1BHK & 2BHK flats, rooms and houses in ${area}, Kota. Near coaching institutes. Verified dealers, zero brokerage. Rent starts ₹3,000/month.`;
  }
  return `Find ${ct}${ptype.toLowerCase()} in ${area}, Kota. ${ptypeDescSuffix(ptype, area)} Direct from verified dealers — no brokerage, no middleman.`;
}

export function typeDesc(ptype: string, count = 0): string {
  const ct = count > 0 ? `${count} verified ` : "";
  return `Find ${ct}${ptype.toLowerCase()} in Kota. ${ptypeDescSuffix(ptype)} Direct from verified local dealers — zero brokerage.`;
}

export function hubDesc(hub: string, ptype?: string, count = 0): string {
  const ct = count > 0 ? `${count} verified ` : "";
  const t = ptype ? ptype.toLowerCase() : "properties";
  return `Find ${ct}${t} near ${hub} coaching institute in Kota. ${ptype ? ptypeDescSuffix(ptype) : "Hostels, PGs, rooms and flats for students."} Verified dealers, direct contact.`;
}

// Internal helpers
function ptypeFullLabel(ptype: string): string {
  const map: Record<string, string> = {
    Hostel: "Hostel", PG: "PG Accommodation", Room: "Room for Rent",
    Flat: "Flat for Rent & Sale", House: "House for Rent & Sale",
    Shop: "Shop & Commercial Property", Plot: "Plot for Sale",
  };
  return map[ptype] ?? ptype;
}

function ptypeSuffix(ptype: string, area?: string): string {
  const loc = area ? `${area}, ` : "";
  const map: Record<string, string> = {
    Hostel: `Boys & Girls Hostels Near Coaching`,
    PG: `Boys & Girls PG with & without Food`,
    Room: `Furnished Single & Double Rooms`,
    Flat: `1BHK, 2BHK, 3BHK Apartments in ${loc}Kota`,
    House: `Independent Houses & Villas`,
    Shop: `Showrooms, Offices & Retail Spaces`,
    Plot: `Residential & Commercial Plots`,
  };
  return map[ptype] ?? `Verified ${ptype} in ${loc}Kota`;
}

function ptypeDescSuffix(ptype: string, area?: string): string {
  const loc = area ? `${area}, ` : "";
  const map: Record<string, string> = {
    Hostel: `Boys & girls hostels in ${loc}Kota with AC, cooler, meals options. Near Allen, Resonance, FIITJEE. Rent ₹3,000–₹10,000/month.`,
    PG: `Boys & girls PG in ${loc}Kota — with food, without food, single & shared rooms. ₹3,500–₹9,000/month.`,
    Room: `Furnished & semi-furnished rooms in ${loc}Kota. AC, attached bath, wifi options. ₹2,500–₹8,000/month.`,
    Flat: `1BHK, 2BHK, 3BHK flats in ${loc}Kota for rent and sale. Furnished, semi-furnished, gated societies.`,
    House: `2BHK, 3BHK, 4BHK independent houses in ${loc}Kota for rent and sale. With parking, garden, terrace options.`,
    Shop: `Showrooms, offices, retail spaces and commercial property in ${loc}Kota. Ground floor, main road locations available.`,
    Plot: `Residential and commercial plots in ${loc}Kota. NA approved, corner plots, various sizes.`,
  };
  return map[ptype] ?? "";
}

/* ─── Base URL helper ───────────────────────────────────────── */
// Returns the app base URL only when explicitly configured.
// Without it, canonical tags and JSON-LD URLs are omitted rather than wrong.
export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

/* ─── Price summary for a list of properties ────────────────── */
export function priceRange(props: SeoProperty[]): string {
  if (!props.length) return "";
  const prices = props.map((p) => p.rent_per_month ?? p.price).filter(Boolean);
  if (!prices.length) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}
