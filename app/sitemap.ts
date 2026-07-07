import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { AREA_SLUGS, TYPE_SLUGS, HUB_SLUGS } from "@/lib/seoHelpers";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://prop100.in";

async function getApprovedSlugs(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { data } = await db
      .from("properties")
      .select("slug")
      .eq("is_approved", true)
      .not("slug", "is", null);
    return (data ?? []).map((r: { slug: string }) => r.slug).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getApprovedSlugs();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,            lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/nearby`, lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
  ];

  // Individual property pages (highest priority after home)
  const propertyPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/property/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  // /kota/[area] — 14 pages
  const areaPages: MetadataRoute.Sitemap = Object.keys(AREA_SLUGS).map((s) => ({
    url: `${BASE}/kota/${s}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // /kota/[type] — 7 pages
  const typePages: MetadataRoute.Sitemap = Object.keys(TYPE_SLUGS).map((s) => ({
    url: `${BASE}/kota/${s}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // /kota/[area]/[type] — 14 × 7 = 98 pages
  const areaTypePages: MetadataRoute.Sitemap = Object.keys(AREA_SLUGS).flatMap((aSlug) =>
    Object.keys(TYPE_SLUGS).map((tSlug) => ({
      url: `${BASE}/kota/${aSlug}/${tSlug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }))
  );

  // /near/[hub] — 5 pages
  const hubPages: MetadataRoute.Sitemap = Object.keys(HUB_SLUGS).map((s) => ({
    url: `${BASE}/near/${s}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85, // high — coaching searches are primary traffic source
  }));

  // /near/[hub]/[type] — 5 × 7 = 35 pages
  const hubTypePages: MetadataRoute.Sitemap = Object.keys(HUB_SLUGS).flatMap((hSlug) =>
    Object.keys(TYPE_SLUGS).map((tSlug) => ({
      url: `${BASE}/near/${hSlug}/${tSlug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    }))
  );

  return [
    ...staticPages,
    ...propertyPages,
    ...hubPages,       // coaching pages first — highest traffic intent
    ...hubTypePages,
    ...typePages,
    ...areaPages,
    ...areaTypePages,
  ];
}
