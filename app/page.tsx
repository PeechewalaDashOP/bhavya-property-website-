import { getData } from "@/lib/getData";
import SiteClient from "@/components/SiteClient";

// Server Component: fetches data (Supabase or sample fallback) and passes it to
// the interactive client. Because Next SSRs the client component, the initial
// listings render into the HTML — good for SEO.
export const revalidate = 60;

export default async function Page() {
  const { properties, dealers, areas, localities } = await getData();
  return <SiteClient properties={properties} dealers={dealers} areas={areas} localities={localities} />;
}
