"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { fmt } from "@/lib/format";
import styles from "./styles.module.css";

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

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false, loading: () => <div className={styles.mapLoading}>Loading map…</div> });

const PTYPES = ["All", "Hostel", "PG", "Room", "Flat", "House", "Shop", "Plot"];
const SALE_BUDGETS: [string, string][] = [["", "Any budget"], ["2000000", "Under ₹20L"], ["3500000", "Under ₹35L"], ["5000000", "Under ₹50L"], ["10000000", "Under ₹1Cr"]];
const RENT_BUDGETS: [string, string][] = [["", "Any budget"], ["5000", "Under ₹5k"], ["8000", "Under ₹8k"], ["12000", "Under ₹12k"], ["20000", "Under ₹20k"]];

export default function MapClient({ properties }: { properties: MapProp[] }) {
  const [ptype, setPtype] = useState("All");
  const [listingType, setListingType] = useState<"all" | "rent" | "sale">("all");
  const [budget, setBudget] = useState("");
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("map");

  const filtered = properties.filter((p) => {
    if (listingType !== "all" && p.type !== listingType) return false;
    if (ptype !== "All" && p.ptype !== ptype) return false;
    if (budget) {
      const price = p.rent_per_month ?? p.price;
      if (price > Number(budget)) return false;
    }
    return true;
  });

  const activeProperty = filtered.find((p) => p.id === activeId) ?? null;

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.backBtn}>← Home</Link>
        <span className={styles.logo}>Prop<b>100</b> <span className={styles.mapLabel}>Map</span></span>
        <span className={styles.count}>{filtered.length} properties</span>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <select className={styles.fsel} value={listingType} onChange={(e) => { setListingType(e.target.value as "all"|"rent"|"sale"); setBudget(""); }}>
          <option value="all">All</option>
          <option value="rent">For Rent</option>
          <option value="sale">For Sale</option>
        </select>
        <select className={styles.fsel} value={ptype} onChange={(e) => setPtype(e.target.value)}>
          {PTYPES.map((t) => <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>)}
        </select>
        <select className={styles.fsel} value={budget} onChange={(e) => setBudget(e.target.value)}>
          {(listingType === "sale" ? SALE_BUDGETS : RENT_BUDGETS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Mobile view toggle */}
      <div className={styles.mobileToggle}>
        <button className={`${styles.toggleBtn} ${mobileView === "map" ? styles.toggleActive : ""}`} onClick={() => setMobileView("map")}>🗺️ Map</button>
        <button className={`${styles.toggleBtn} ${mobileView === "list" ? styles.toggleActive : ""}`} onClick={() => setMobileView("list")}>☰ List ({filtered.length})</button>
      </div>

      {/* Body */}
      <div className={styles.body}>

        {/* Left — property list */}
        <div className={`${styles.list} ${mobileView === "list" ? styles.mobileVisible : styles.mobileHidden}`}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No properties match these filters.</div>
          ) : (
            filtered.map((p) => {
              const price = p.rent_per_month ?? p.price;
              const isActive = p.id === activeId;
              return (
                <div
                  key={p.id}
                  className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                  onMouseEnter={() => setHoverId(p.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => setActiveId(isActive ? null : p.id)}
                >
                  {p.img && <img src={p.img} alt={p.title} className={styles.cardImg} />}
                  <div className={styles.cardBody}>
                    <div className={styles.cardPrice}>{fmt(price)}{p.type === "rent" ? "/mo" : ""}</div>
                    <div className={styles.cardTitle}>{p.title}</div>
                    <div className={styles.cardMeta}>📍 {p.loc} · {p.ptype}{p.bhk > 0 ? ` · ${p.bhk} BHK` : ""}</div>
                    {p.dealers && <div className={styles.cardDealer}>🏷️ {p.dealers.name}</div>}
                    {isActive && p.slug && (
                      <Link href={`/property/${p.slug}`} className={styles.viewBtn}>View Details →</Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right — map */}
        <div className={`${styles.mapWrap} ${mobileView === "map" ? styles.mobileVisible : styles.mobileHidden}`}>
          <LeafletMap
            properties={filtered}
            hoverId={hoverId}
            activeId={activeId}
            onSelect={(id) => { setActiveId(id === activeId ? null : id); setMobileView("list"); }}
          />
        </div>
      </div>

      {/* Bottom popup on mobile when a property is selected */}
      {activeProperty && (
        <div className={styles.bottomCard}>
          <button className={styles.bottomClose} onClick={() => setActiveId(null)}>×</button>
          <div className={styles.bottomPrice}>{fmt(activeProperty.rent_per_month ?? activeProperty.price)}{activeProperty.type === "rent" ? "/mo" : ""}</div>
          <div className={styles.bottomTitle}>{activeProperty.title}</div>
          <div className={styles.bottomMeta}>📍 {activeProperty.loc} · {activeProperty.ptype}</div>
          {activeProperty.slug && (
            <Link href={`/property/${activeProperty.slug}`} className={styles.viewBtn}>View Details →</Link>
          )}
        </div>
      )}
    </div>
  );
}
