import { Area, Property, PublicDealer } from "./types";
import { AREAS as SAMPLE_AREAS, DEALERS as SAMPLE_DEALERS, PROPS as SAMPLE_PROPS } from "./sampleData";
import { supabase, supabaseEnabled } from "./supabase";

// Server-side data fetch. Falls back to sample data so the app runs with zero
// configuration; once Supabase env vars are set, real data is used.

type Row = Record<string, unknown>;

function toPublicDealer(d: PublicDealer): PublicDealer {
  return { id: d.id, name: d.name, role: d.role, years: d.years, rating: d.rating };
}

function mapProperty(row: Row, dealersById: Map<number, PublicDealer>): Property {
  const dealer = dealersById.get(row.dealer_id as number) ?? toPublicDealer(SAMPLE_DEALERS[0]);
  const gallery = (row.gallery as string[]) ?? [];
  return {
    id: row.id as number,
    slug: (row.slug as string) ?? null,
    type: row.type as "sale" | "rent",
    ptype: row.ptype as string,
    loc: row.loc as string,
    coaching: (row.coaching as string) ?? null,
    bhk: (row.bhk as number) ?? 0,
    baths: (row.baths as number) ?? 0,
    title: row.title as string,
    price: (row.rent_per_month as number) ?? (row.price as number),
    sqft: (row.sqft as number) ?? 0,
    furnish: (row.furnishing_status as string) ?? (row.furnish as string) ?? "",
    img: (row.img as string) ?? gallery[0] ?? "",
    gallery,
    features: (row.features as string[]) ?? [],
    dealer: toPublicDealer(dealer),
    verified: Boolean(row.is_verified ?? row.verified),
    photos: (row.photos as number) ?? gallery.length,
    postedDays: (row.posted_days as number) ?? 0,
    desc: (row.description as string) ?? "",
  };
}

export async function getData(): Promise<{ properties: Property[]; dealers: PublicDealer[]; areas: Area[] }> {
  if (!supabaseEnabled || !supabase) {
    return {
      properties: SAMPLE_PROPS.map((p) => ({ ...p, slug: null, dealer: toPublicDealer(p.dealer) })),
      dealers: SAMPLE_DEALERS.map(toPublicDealer),
      areas: SAMPLE_AREAS,
    };
  }
  try {
    const [{ data: dealers }, { data: areas }, { data: props }] = await Promise.all([
      supabase.from("dealers").select("id,name,role,years,rating").order("id"),
      supabase.from("areas").select("*"),
      supabase.from("properties").select("*").eq("is_approved", true).order("posted_days")
    ]);
    const dealerList = (dealers ?? []) as unknown as PublicDealer[];
    const byId = new Map<number, PublicDealer>(dealerList.map((d) => [d.id, d]));
    return {
      properties: ((props ?? []) as Row[]).map((r) => mapProperty(r, byId)),
      dealers: dealerList.length ? dealerList.map(toPublicDealer) : SAMPLE_DEALERS.map(toPublicDealer),
      areas: ((areas ?? []) as unknown as Area[]).length ? ((areas ?? []) as unknown as Area[]) : SAMPLE_AREAS
    };
  } catch {
    return {
      properties: SAMPLE_PROPS.map((p) => ({ ...p, slug: null, dealer: toPublicDealer(p.dealer) })),
      dealers: SAMPLE_DEALERS.map(toPublicDealer),
      areas: SAMPLE_AREAS,
    };
  }
}

// Lead writes are handled by POST /api/leads (service role, server-side).
// Do not add client-side lead inserts here.
