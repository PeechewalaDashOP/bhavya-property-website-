import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AREA_SLUGS, TYPE_SLUGS, HUB_TO_SLUG,
  getPropertiesFiltered, priceRange,
  areaTypeTitle, areaTypeDesc,
  getBaseUrl,
} from "@/lib/seoHelpers";
import { COACHING_HUBS } from "@/lib/constants";
import { SeoPageShell } from "@/components/SeoGrid";
import { createClient } from "@supabase/supabase-js";
import { PropertyFull } from "@/lib/types";
import PropertyDetail from "@/app/property/[slug]/PropertyDetail";

type Props = { params: Promise<{ slug: string; subtype: string }> };

// Refresh every 60s (same as the homepage) — otherwise these statically
// generated pages stay frozen with whatever data existed at the last deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  return Object.keys(AREA_SLUGS).flatMap((slug) =>
    Object.keys(TYPE_SLUGS).map((subtype) => ({ slug, subtype }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subtype } = await params;
  const area  = AREA_SLUGS[slug];
  const ptype = TYPE_SLUGS[subtype];
  if (!area || !ptype) return { title: "Not Found" };

  const title = areaTypeTitle(area, ptype);
  const desc  = areaTypeDesc(area, ptype);
  const base = getBaseUrl();
  return {
    title: `${title} | Prop100`,
    description: desc,
    ...(base && { alternates: { canonical: `${base}/kota/${slug}/${subtype}` } }),
    openGraph: { title, description: desc },
  };
}

async function fetchPropertyBySlug(propertySlug: string): Promise<PropertyFull | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db
    .from("properties")
    .select("*, property_units(*), dealers!dealer_id(id,name,role,years,rating)")
    .eq("slug", propertySlug)
    .eq("is_approved", true)
    .maybeSingle();
  if (!data) return null;
  const units = Array.isArray(data.property_units)
    ? data.property_units.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    : [];
  return { ...data, property_units: units } as PropertyFull;
}

export default async function AreaTypePage({ params }: Props) {
  const { slug, subtype } = await params;
  const area  = AREA_SLUGS[slug];
  const ptype = TYPE_SLUGS[subtype];

  // If subtype isn't a known type slug, try it as a property slug
  // This handles /kota/[locality]/[property-slug] URLs
  if (!ptype) {
    const property = await fetchPropertyBySlug(subtype);
    if (property) {
      const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
      return <PropertyDetail property={property} mapsKey={mapsKey} initialParams={{}} />;
    }
    notFound();
  }

  if (!area || !ptype) notFound();

  const props = await getPropertiesFiltered({ area, ptype });
  const range = priceRange(props);

  // Sibling type pills for this area
  const typePills = Object.entries(TYPE_SLUGS).map(([ts, label]) => ({
    label,
    href: `/kota/${slug}/${ts}`,
    active: ts === subtype,
  }));

  // Other areas for same type
  const otherAreaLinks = Object.entries(AREA_SLUGS)
    .filter(([s]) => s !== slug)
    .map(([s, l]) => ({ label: `${ptype} in ${l}`, href: `/kota/${s}/${subtype}` }));

  // Hub links for same type
  const hubLinks = COACHING_HUBS.filter((h) => h !== "Other").map((h) => ({
    label: `${ptype} near ${h}`,
    href: `/near/${HUB_TO_SLUG[h]}/${subtype}`,
  }));

  const base = getBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": areaTypeTitle(area, ptype),
    "description": areaTypeDesc(area, ptype, props.length),
    "numberOfItems": props.length,
    "itemListElement": props.slice(0, 10).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      ...(base && p.slug && { "url": `${base}/property/${p.slug}` }),
      "name": p.title,
    })),
  };

  return (
    <SeoPageShell
      h1={areaTypeTitle(area, ptype)}
      desc={areaTypeDesc(area, ptype, props.length)}
      breadcrumbs={[
        { label: area, href: `/kota/${slug}` },
        { label: ptype },
      ]}
      count={props.length}
      priceRange={range}
      pills={typePills}
      properties={props}
      jsonLd={jsonLd}
      related={[
        { title: `${ptype} in other areas`, links: otherAreaLinks },
        { title: `${ptype} near coaching institutes`, links: hubLinks },
        { title: `All property types in ${area}`, links: Object.entries(TYPE_SLUGS).map(([ts, l]) => ({ label: l, href: `/kota/${slug}/${ts}` })) },
      ]}
    />
  );
}
