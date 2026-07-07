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

type Props = { params: Promise<{ slug: string; subtype: string }> };

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

export default async function AreaTypePage({ params }: Props) {
  const { slug, subtype } = await params;
  const area  = AREA_SLUGS[slug];
  const ptype = TYPE_SLUGS[subtype];
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
