import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  AREA_SLUGS, TYPE_SLUGS, HUB_TO_SLUG, TYPE_TO_SLUG,
  getPropertiesFiltered, priceRange,
  areaTypeTitle, typeTitle, areaTypeDesc, typeDesc,
  getBaseUrl,
} from "@/lib/seoHelpers";
import { PTYPE_ICONS, COACHING_HUBS } from "@/lib/constants";
import { SeoPageShell } from "@/components/SeoGrid";

type Props = { params: Promise<{ slug: string }> };

// Pre-generate all area pages + all type pages at build time
export async function generateStaticParams() {
  return [
    ...Object.keys(AREA_SLUGS).map((slug) => ({ slug })),
    ...Object.keys(TYPE_SLUGS).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const area  = AREA_SLUGS[slug];
  const ptype = TYPE_SLUGS[slug];
  if (!area && !ptype) return { title: "Not Found" };

  const title = area ? areaTypeTitle(area) : typeTitle(ptype);
  const desc  = area ? areaTypeDesc(area) : typeDesc(ptype);
  const base = getBaseUrl();
  return {
    title: `${title} | Prop100`,
    description: desc,
    ...(base && { alternates: { canonical: `${base}/kota/${slug}` } }),
    openGraph: { title, description: desc },
  };
}

export default async function KotaSlugPage({ params }: Props) {
  const { slug } = await params;
  const area  = AREA_SLUGS[slug];
  const ptype = TYPE_SLUGS[slug];
  if (!area && !ptype) notFound();

  if (area) {
    // ── Area page ──────────────────────────────────────────────
    const props = await getPropertiesFiltered({ area });
    const range = priceRange(props);

    // type pills → /kota/[area]/[type]
    const typePills = Object.entries(TYPE_SLUGS).map(([ts, label]) => ({
      label: `${PTYPE_ICONS[label] ?? ""} ${label}`,
      href: `/kota/${slug}/${ts}`,
    }));

    // Related: other areas, coaching hubs
    const otherAreas = Object.entries(AREA_SLUGS)
      .filter(([s]) => s !== slug)
      .slice(0, 10)
      .map(([s, l]) => ({ label: l, href: `/kota/${s}` }));

    const hubLinks = COACHING_HUBS.filter((h) => h !== "Other").map((h) => ({
      label: `Near ${h}`,
      href: `/near/${HUB_TO_SLUG[h]}`,
    }));

    const base = getBaseUrl();
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": areaTypeTitle(area),
      "description": areaTypeDesc(area, undefined, props.length),
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
        h1={areaTypeTitle(area)}
        desc={areaTypeDesc(area, undefined, props.length)}
        breadcrumbs={[{ label: area }]}
        count={props.length}
        priceRange={range}
        pills={typePills}
        properties={props}
        jsonLd={jsonLd}
        related={[
          { title: "Browse by property type", links: Object.entries(TYPE_SLUGS).map(([ts, l]) => ({ label: l + " in " + area, href: `/kota/${slug}/${ts}` })) },
          { title: "Other areas in Kota", links: otherAreas },
          { title: "Find by coaching", links: hubLinks },
        ]}
      />
    );
  }

  // ── Type page ────────────────────────────────────────────────
  const props = await getPropertiesFiltered({ ptype });
  const range = priceRange(props);

  const areaPills = Object.entries(AREA_SLUGS).map(([as, label]) => ({
    label,
    href: `/kota/${as}/${slug}`,
  }));

  const hubPills = COACHING_HUBS.filter((h) => h !== "Other").map((h) => ({
    label: `Near ${h}`,
    href: `/near/${HUB_TO_SLUG[h]}/${slug}`,
  }));

  const base2 = getBaseUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": typeTitle(ptype),
    "description": typeDesc(ptype, props.length),
    "numberOfItems": props.length,
    "itemListElement": props.slice(0, 10).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      ...(base2 && p.slug && { "url": `${base2}/property/${p.slug}` }),
      "name": p.title,
    })),
  };

  return (
    <SeoPageShell
      h1={typeTitle(ptype)}
      desc={typeDesc(ptype, props.length)}
      breadcrumbs={[{ label: ptype }]}
      count={props.length}
      priceRange={range}
      pills={areaPills}
      properties={props}
      jsonLd={jsonLd}
      related={[
        { title: `${ptype} by area`, links: Object.entries(AREA_SLUGS).map(([as, l]) => ({ label: `${ptype} in ${l}`, href: `/kota/${as}/${TYPE_TO_SLUG[ptype]}` })) },
        { title: `${ptype} near coaching`, links: hubPills },
        { title: "Other property types", links: Object.entries(TYPE_SLUGS).filter(([ts]) => ts !== slug).map(([ts, l]) => ({ label: l + " in Kota", href: `/kota/${ts}` })) },
      ]}
    />
  );
}
