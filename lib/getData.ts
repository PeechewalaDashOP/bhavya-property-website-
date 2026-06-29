import { Area, Dealer, Property } from "./types";
import { AREAS as SAMPLE_AREAS, DEALERS as SAMPLE_DEALERS, PROPS as SAMPLE_PROPS } from "./sampleData";
import { supabase, supabaseEnabled } from "./supabase";

// Server-side data fetch. Falls back to sample data so the app runs with zero
// configuration; once Supabase env vars are set, real data is used.

type Row = Record<string, unknown>;

function mapProperty(row: Row, dealersById: Map<number, Dealer>): Property {
  return {
    id: row.id as number,
    type: row.type as "sale" | "rent",
    ptype: row.ptype as string,
    loc: row.loc as string,
    coaching: (row.coaching as string) ?? null,
    bhk: (row.bhk as number) ?? 0,
    baths: (row.baths as number) ?? 0,
    title: row.title as string,
    price: row.price as number,
    sqft: row.sqft as number,
    furnish: row.furnish as string,
    img: (row.img as string) ?? ((row.gallery as string[]) ?? [])[0],
    gallery: (row.gallery as string[]) ?? [],
    features: (row.features as string[]) ?? [],
    dealer: dealersById.get(row.dealer_id as number) ?? SAMPLE_DEALERS[0],
    verified: Boolean(row.verified),
    photos: (row.photos as number) ?? 6,
    postedDays: (row.posted_days as number) ?? 0,
    desc: (row.description as string) ?? ""
  };
}

export async function getData(): Promise<{ properties: Property[]; dealers: Dealer[]; areas: Area[] }> {
  if (!supabaseEnabled || !supabase) {
    return { properties: SAMPLE_PROPS, dealers: SAMPLE_DEALERS, areas: SAMPLE_AREAS };
  }
  try {
    const [{ data: dealers }, { data: areas }, { data: props }] = await Promise.all([
      supabase.from("dealers").select("*").order("id"),
      supabase.from("areas").select("*"),
      supabase.from("properties").select("*").order("posted_days")
    ]);
    const dealerList = (dealers ?? []) as unknown as Dealer[];
    const byId = new Map<number, Dealer>(dealerList.map((d) => [d.id, d]));
    return {
      properties: ((props ?? []) as Row[]).map((r) => mapProperty(r, byId)),
      dealers: dealerList.length ? dealerList : SAMPLE_DEALERS,
      areas: ((areas ?? []) as unknown as Area[]).length ? ((areas ?? []) as unknown as Area[]) : SAMPLE_AREAS
    };
  } catch {
    return { properties: SAMPLE_PROPS, dealers: SAMPLE_DEALERS, areas: SAMPLE_AREAS };
  }
}

// Client-side lead insert (used by the gateway + footer form + chatbot).
export async function saveLead(lead: {
  ref: string;
  name: string;
  phone: string;
  intent: string;
  prop: string;
  dealer: string;
  price: number;
  msg?: string;
}): Promise<void> {
  if (supabaseEnabled && supabase) {
    try {
      await supabase.from("leads").insert({ ...lead, status: "New" });
    } catch {
      /* swallow — keep UX smooth in the prototype */
    }
  }
}
