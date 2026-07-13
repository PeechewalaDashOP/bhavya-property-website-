import { createClient } from "@supabase/supabase-js";
import { Locality } from "@/lib/types";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getLocalities(): Promise<Locality[]> {
  const { data } = await db()
    .from("localities")
    .select("*")
    .eq("level", "locality")
    .order("sort_order");
  return (data ?? []) as Locality[];
}

export async function getLocalityBySlug(slug: string): Promise<Locality | null> {
  const { data } = await db()
    .from("localities")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data as Locality | null;
}

// Returns locality + its parent (for sublocality → parent resolution)
export async function getLocalityWithParent(
  slug: string
): Promise<{ locality: Locality; parent: Locality | null } | null> {
  const locality = await getLocalityBySlug(slug);
  if (!locality) return null;
  if (!locality.parent_id) return { locality, parent: null };

  const { data: parent } = await db()
    .from("localities")
    .select("*")
    .eq("id", locality.parent_id)
    .maybeSingle();

  return { locality, parent: (parent as Locality | null) };
}

export type LocalitySearchResult = Locality & { parentSlug: string | null };

// Match name + aliases across all levels; attach parentSlug for sublocalities
export async function searchLocalities(q: string): Promise<LocalitySearchResult[]> {
  if (!q.trim()) return [];

  const { data: matches } = await db()
    .from("localities")
    .select("*")
    .ilike("name", `%${q}%`)
    .limit(8);

  const results = (matches ?? []) as Locality[];
  const subIds = results
    .filter((l) => l.level === "sublocality" && l.parent_id)
    .map((l) => l.parent_id as string);

  if (subIds.length === 0) {
    return results.map((l) => ({ ...l, parentSlug: null }));
  }

  const { data: parents } = await db()
    .from("localities")
    .select("id,slug")
    .in("id", subIds);

  const parentMap = new Map(
    ((parents ?? []) as { id: string; slug: string }[]).map((p) => [p.id, p.slug])
  );

  return results.map((l) => ({
    ...l,
    parentSlug:
      l.level === "sublocality" && l.parent_id
        ? (parentMap.get(l.parent_id) ?? null)
        : null,
  }));
}

// Get all properties whose locality_id is this locality or any of its sublocalities
export async function getPropertiesByLocality(
  localitySlug: string
): Promise<Record<string, unknown>[]> {
  const locality = await getLocalityBySlug(localitySlug);
  if (!locality) return [];

  // For a 3-level tree (city → locality → sublocality), two queries cover all descendants
  const { data: descendants } = await db()
    .from("localities")
    .select("id")
    .or(`id.eq.${locality.id},parent_id.eq.${locality.id}`);

  const ids = ((descendants ?? []) as { id: string }[]).map((d) => d.id);
  if (ids.length === 0) return [];

  const { data: props } = await db()
    .from("properties")
    .select("*, dealers!dealer_id(id,name,role,years,rating), property_units(*)")
    .in("locality_id", ids)
    .eq("is_approved", true)
    .order("is_featured", { ascending: false });

  return (props ?? []) as Record<string, unknown>[];
}
