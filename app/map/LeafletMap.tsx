"use client";

import { useEffect, useRef } from "react";
import { AREA_COORDS } from "@/lib/constants";
import "leaflet/dist/leaflet.css";

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
};

type Props = {
  properties: MapProp[];
  hoverId: number | null;
  activeId: number | null;
  onSelect: (id: number) => void;
};

const KOTA_CENTER: [number, number] = [25.1462, 75.8492];

function fmt(n: number) {
  if (n >= 10000000) return "₹" + (n / 10000000).toFixed(1) + " Cr";
  if (n >= 100000) return "₹" + (n / 100000).toFixed(1) + " L";
  return "₹" + n.toLocaleString("en-IN");
}

function makeIcon(L: typeof import("leaflet"), active: boolean, hovered: boolean) {
  const bg = active ? "#16a34a" : hovered ? "#2563eb" : "#e63946";
  const size = active ? 18 : hovered ? 16 : 12;
  return L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.45);transition:all 0.15s"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function LeafletMap({ properties, hoverId, activeId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<number, import("leaflet").Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const map = L.map(containerRef.current!, {
        center: KOTA_CENTER,
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Update markers when properties / hover / active change
  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      const map = mapRef.current!;
      const existing = new Set(markersRef.current.keys());

      properties.forEach((p) => {
        const lat = p.lat ?? AREA_COORDS[p.loc]?.lat;
        const lng = p.lng ?? AREA_COORDS[p.loc]?.lng;
        if (!lat || !lng) return;

        const isActive = p.id === activeId;
        const isHovered = p.id === hoverId;
        const icon = makeIcon(L, isActive, isHovered);

        if (markersRef.current.has(p.id)) {
          markersRef.current.get(p.id)!.setIcon(icon);
          existing.delete(p.id);
        } else {
          const price = p.rent_per_month ?? p.price;
          const marker = L.marker([lat, lng], { icon })
            .addTo(map)
            .bindPopup(
              `<div style="min-width:160px;font-family:inherit">
                <div style="font-weight:700;font-size:14px;color:#e63946">${fmt(price)}${p.type === "rent" ? "/mo" : ""}</div>
                <div style="font-size:13px;margin:2px 0">${p.title}</div>
                <div style="font-size:12px;color:#666">📍 ${p.loc} · ${p.ptype}</div>
              </div>`,
              { closeButton: false, maxWidth: 220 }
            )
            .on("click", () => onSelect(p.id));
          markersRef.current.set(p.id, marker);
          existing.delete(p.id);
        }
      });

      // Remove markers for properties no longer in filtered list
      existing.forEach((id) => {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      });
    });
  }, [properties, hoverId, activeId, onSelect]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
