import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PropertyFull } from "@/lib/types";
import PropertyDetail from "./PropertyDetail";

export const revalidate = 60;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchProperty(slug: string): Promise<PropertyFull | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from("properties")
    .select("*, property_units(*), dealers!dealer_id(id, name, role, years, rating)")
    .eq("slug", slug)
    .eq("is_approved", true)
    .maybeSingle();

  if (error || !data) return null;

  // property_units may be null if table doesn't exist yet — handle gracefully
  const units = Array.isArray(data.property_units)
    ? data.property_units.sort(
        (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
      )
    : [];

  return { ...data, property_units: units } as PropertyFull;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const prop = await fetchProperty(slug);
  if (!prop) return { title: "Property Not Found — Prop100" };

  const price = prop.type === "rent"
    ? `₹${(prop.rent_per_month ?? prop.price).toLocaleString("en-IN")}/month`
    : `₹${(prop.price / 100000).toFixed(1)}L`;

  const desc = `${prop.title} in ${prop.loc}, Kota. ${price}. ${prop.description?.slice(0, 100) ?? "View photos, details and contact the dealer on Prop100."}`;
  const image = prop.gallery?.[0] ?? prop.img ?? "";

  return {
    title: `${prop.title} — ${price} | Prop100`,
    description: desc,
    openGraph: {
      title: `${prop.title} | Prop100`,
      description: desc,
      images: image ? [{ url: image, width: 1200, height: 630 }] : [],
      type: "website",
    },
  };
}

function buildJsonLd(prop: PropertyFull) {
  const price = prop.rent_per_month ?? prop.price;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prop100.in";
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": prop.title,
    "description": prop.description ?? `${prop.ptype} in ${prop.loc}, Kota`,
    "url": `${appUrl}/property/${prop.slug}`,
    "image": prop.gallery?.[0] ?? prop.img ?? "",
    "offers": {
      "@type": "Offer",
      "price": price,
      "priceCurrency": "INR",
      "priceSpecification": prop.type === "rent"
        ? { "@type": "UnitPriceSpecification", "price": price, "priceCurrency": "INR", "unitText": "MON" }
        : undefined,
    },
    "address": {
      "@type": "PostalAddress",
      "addressLocality": prop.loc,
      "addressRegion": "Rajasthan",
      "addressCountry": "IN",
      "postalCode": "324001",
    },
    "floorSize": prop.sqft
      ? { "@type": "QuantitativeValue", "value": prop.sqft, "unitCode": "FTK" }
      : undefined,
    "numberOfRooms": prop.bhk || undefined,
    "numberOfBathroomsTotal": prop.baths || undefined,
    "petsAllowed": false,
    "furnishingType": prop.furnishing_status ?? undefined,
  };
}

export default async function PropertyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const rawParams = await (searchParams ?? Promise.resolve({}));

  // Flatten to Record<string, string> (ignore array values)
  const initialParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof v === "string") initialParams[k] = v;
    else if (Array.isArray(v) && v.length > 0) initialParams[k] = v[0];
  }

  const property = await fetchProperty(slug);
  if (!property) notFound();

  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const jsonLd = buildJsonLd(property);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PropertyDetail property={property} mapsKey={mapsKey} initialParams={initialParams} />
    </>
  );
}
