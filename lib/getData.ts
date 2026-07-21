import { Area, Locality, Property, PublicDealer } from "./types";
import { AREAS as SAMPLE_AREAS, DEALERS as SAMPLE_DEALERS, PROPS as SAMPLE_PROPS } from "./sampleData";
import { supabase, supabaseEnabled } from "./supabase";
import { getLocalities } from "./queries/localities";

// Server-side data fetch. Falls back to sample data so the app runs with zero
// configuration; once Supabase env vars are set, real data is used.

type Row = Record<string, unknown>;

function toPublicDealer(d: PublicDealer): PublicDealer {
  return { id: d.id, name: d.name, role: d.role, years: d.years, rating: d.rating };
}

const UNKNOWN_DEALER: PublicDealer = { id: 0, name: "Property Owner", role: "", years: 0, rating: 0 };

function mapProperty(row: Row, dealersById: Map<number, PublicDealer>): Property {
  // Never substitute an unrelated real dealer here — a neutral placeholder
  // only, in case a property's dealer_id somehow doesn't resolve.
  const dealer = dealersById.get(row.dealer_id as number) ?? UNKNOWN_DEALER;
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

export async function getData(): Promise<{ properties: Property[]; dealers: PublicDealer[]; areas: Area[]; localities: Locality[] }> {
  if (!supabaseEnabled || !supabase) {
    return {
      properties: SAMPLE_PROPS.map((p) => ({ ...p, slug: null, dealer: toPublicDealer(p.dealer) })),
      dealers: SAMPLE_DEALERS.map(toPublicDealer),
      areas: SAMPLE_AREAS,
      localities: [],
    };
  }
  try {
    // Two separate dealer reads on purpose:
    // - `allDealers` relies on RLS (is_active OR has an approved property) to
    //   resolve the *real* posted-by dealer for every property card, including
    //   self-listed owners (is_active=false) with a live listing.
    // - `verifiedDealers` is explicitly scoped to is_active=true — the curated
    //   "Verified Partners" showcase must never include self-listed owners,
    //   even though RLS now lets their row through for their own property.
    // is_active is PUBLIC VISIBILITY only — it has no bearing on whether a
    // dealer can log in. That's dealers.can_login (see lib/dealerSession.ts /
    // supabase/migration_dealer_auth.sql), a deliberately separate flag so
    // suspending someone's login never unpublishes their listings.
    const [{ data: allDealers }, { data: verifiedDealers }, { data: areas }, { data: props }, localities] = await Promise.all([
      supabase.from("dealers").select("id,name,role,years,rating").order("id"),
      supabase.from("dealers").select("id,name,role,years,rating").eq("is_active", true).order("id"),
      supabase.from("areas").select("*"),
      supabase.from("properties").select("*").eq("is_approved", true).order("posted_days"),
      getLocalities(),
    ]);
    const dealerList = (allDealers ?? []) as unknown as PublicDealer[];
    const verifiedList = (verifiedDealers ?? []) as unknown as PublicDealer[];
    const byId = new Map<number, PublicDealer>(dealerList.map((d) => [d.id, d]));
    return {
      properties: ((props ?? []) as Row[]).map((r) => mapProperty(r, byId)),
      // Never fall back to sample dealers here — an empty array means "no real
      // verified partners yet," which the UI shows a recruitment CTA for instead.
      dealers: verifiedList.map(toPublicDealer),
      areas: ((areas ?? []) as unknown as Area[]).length ? ((areas ?? []) as unknown as Area[]) : SAMPLE_AREAS,
      localities,
    };
  } catch {
    return {
      properties: SAMPLE_PROPS.map((p) => ({ ...p, slug: null, dealer: toPublicDealer(p.dealer) })),
      dealers: SAMPLE_DEALERS.map(toPublicDealer),
      areas: SAMPLE_AREAS,
      localities: [],
    };
  }
}

// Lead writes are handled by POST /api/leads (service role, server-side).
// Do not add client-side lead inserts here.
