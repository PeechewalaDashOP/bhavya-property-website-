import { createClient } from "@supabase/supabase-js";
import MapClient from "./MapClient";

type MapProp = {
  id: number;
  slug: string | null;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  bhk: number;
  title: string;
  price: number;
  rent_per_month: number | null;
  img: string | null;
  lat: number | null;
  lng: number | null;
  dealers: { name: string } | null;
};

async function getProperties(): Promise<MapProp[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db
    .from("properties")
    .select("id,slug,type,ptype,loc,bhk,title,price,rent_per_month,img,lat,lng,dealers!dealer_id(name)")
    .eq("is_approved", true)
    .limit(200);
  return (data ?? []) as unknown as MapProp[];
}

export const metadata = { title: "Map View — Prop100 Kota" };

export default async function MapPage() {
  const properties = await getProperties();
  return <MapClient properties={properties} />;
}
