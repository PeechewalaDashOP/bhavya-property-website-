import type { Metadata } from "next";
import NearbyClient from "./NearbyClient";

export const metadata: Metadata = {
  title: "Properties Near Me — Kota | Prop100",
  description:
    "Find hostels, PGs, flats and rooms near your coaching institute or location in Kota. Sort by distance, filter by budget and type.",
};

export default function NearbyPage() {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  return <NearbyClient mapsKey={mapsKey} />;
}
