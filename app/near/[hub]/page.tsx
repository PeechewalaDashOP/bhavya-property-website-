import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  HUB_SLUGS, TYPE_SLUGS, AREA_SLUGS,
  getPropertiesFiltered, priceRange, hubTitle, hubDesc,
  getBaseUrl,
} from "@/lib/seoHelpers";
import { PTYPE_ICONS } from "@/lib/constants";
import { SeoPageShell } from "@/components/SeoGrid";

type Props = { params: Promise<{ hub: string }> };

// Refresh every 60s (same as the homepage) — otherwise these statically
// generated pages stay frozen with whatever data existed at the last deploy.
export const revalidate = 60;

export async function generateStaticParams() {
  return Object.keys(HUB_SLUGS).map((hub) => ({ hub }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hub } = await params;
  const hubName = HUB_SLUGS[hub];
  if (!hubName) return { title: "Not Found" };

  const title = hubTitle(hubName);
  const desc  = hubDesc(hubName);
  const base = getBaseUrl();
  return {
    title: `${title} | Prop100`,
    description: desc,
    ...(base && { alternates: { canonical: `${base}/near/${hub}` } }),
    openGraph: { title, description: desc },
  };
}

export default async function HubPage({ params }: Props) {
  const { hub } = await params;
  const hubName = HUB_SLUGS[hub];
  if (!hubName) notFound();

  const props = await getPropertiesFiltered({ coaching: hubName });
  const range = priceRange(props);

  const typePills = Object.entries(TYPE_SLUGS).map(([ts, label]) => ({
    label: `${PTYPE_ICONS[label] ?? ""} ${label}`,
    href: `/near/${hub}/${ts}`,
  }));

  // Area links for properties near this hub
  const areaLinks = Object.entries(AREA_SLUGS).map(([as, l]) => ({
    label: `${hubName} area — ${l}`,
    href: `/kota/${as}`,
  }));

  // Other hub links
  const otherHubLinks = Object.entries(HUB_SLUGS)
    .filter(([s]) => s !== hub)
    .map(([s, l]) => ({ label: `Near ${l} Kota`, href: `/near/${s}` }));

  const base = getBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": hubTitle(hubName),
    "description": hubDesc(hubName, undefined, props.length),
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
      h1={hubTitle(hubName)}
      desc={hubDesc(hubName, undefined, props.length)}
      breadcrumbs={[{ label: `Near ${hubName}` }]}
      count={props.length}
      priceRange={range}
      pills={typePills}
      properties={props}
      jsonLd={jsonLd}
      related={[
        { title: `Property type near ${hubName}`, links: Object.entries(TYPE_SLUGS).map(([ts, l]) => ({ label: `${l} near ${hubName}`, href: `/near/${hub}/${ts}` })) },
        { title: "Other coaching institutes", links: otherHubLinks },
        { title: "Browse by area", links: areaLinks.slice(0, 8) },
      ]}
    />
  );
}
