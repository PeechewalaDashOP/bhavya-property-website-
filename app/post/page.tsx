import { getData } from "@/lib/getData";
import PostClient from "@/components/PostClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Post a Property | KotaProperty",
  description:
    "List your property on KotaProperty — reach verified buyers and renters in Kota, Rajasthan. Free listing, reviewed within 24 hours.",
};

export default async function PostPropertyPage() {
  const { areas } = await getData();
  return <PostClient areas={areas} />;
}
