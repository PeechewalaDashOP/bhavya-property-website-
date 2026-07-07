import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  HUB_SLUGS, TYPE_SLUGS, AREA_SLUGS,
  getPropertiesFiltered, priceRange, hubTitle, hubDesc,
  getBaseUrl,
} from "@/lib/seoHelpers";
import { SeoPageShell } from "@/components/SeoGrid";

type Props = { params: Promise<{ hub: string; type: string }> };

export async function generateStaticParams() {
  return Object.keys(HUB_SLUGS).flatMap((hub) =>
    Object.keys(TYPE_SLUGS).map((type) => ({ hub, type }))
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hub, type } = await params;
  const hubName = HUB_SLUGS[hub];
  const ptype   = TYPE_SLUGS[type];
  if (!hubName || !ptype) return { title: "Not Found" };

  const title = hubTitle(hubName, ptype);
  const desc  = hubDesc(hubName, ptype);
  const base = getBaseUrl();
  return {
    title: `${title} | Prop100`,
    description: desc,
    ...(base && { alternates: { canonical: `${base}/near/${hub}/${type}` } }),
    openGraph: { title, description: desc },
  };
}

export default async function HubTypePage({ params }: Props) {
  const { hub, type } = await params;
  const hubName = HUB_SLUGS[hub];
  const ptype   = TYPE_SLUGS[type];
  if (!hubName || !ptype) notFound();

  const props = await getPropertiesFiltered({ coaching: hubName, ptype });
  const range = priceRange(props);

  // Sibling type pills for same hub
  const typePills = Object.entries(TYPE_SLUGS).map(([ts, label]) => ({
    label,
    href: `/near/${hub}/${ts}`,
    active: ts === type,
  }));

  // Other hubs for same type
  const otherHubLinks = Object.entries(HUB_SLUGS)
    .filter(([s]) => s !== hub)
    .map(([s, l]) => ({ label: `${ptype} near ${l}`, href: `/near/${s}/${type}` }));

  // Area links for same type
  const areaLinks = Object.entries(AREA_SLUGS).map(([as, l]) => ({
    label: `${ptype} in ${l}`,
    href: `/kota/${as}/${type}`,
  }));

  const base = getBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": hubTitle(hubName, ptype),
    "description": hubDesc(hubName, ptype, props.length),
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
      h1={hubTitle(hubName, ptype)}
      desc={hubDesc(hubName, ptype, props.length)}
      breadcrumbs={[
        { label: `Near ${hubName}`, href: `/near/${hub}` },
        { label: ptype },
      ]}
      count={props.length}
      priceRange={range}
      pills={typePills}
      properties={props}
      jsonLd={jsonLd}
      related={[
        { title: `${ptype} near other coaching institutes`, links: otherHubLinks },
        { title: `${ptype} by area in Kota`, links: areaLinks },
        { title: `All types near ${hubName}`, links: Object.entries(TYPE_SLUGS).map(([ts, l]) => ({ label: l, href: `/near/${hub}/${ts}` })) },
      ]}
    />
  );
}
