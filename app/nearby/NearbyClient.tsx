"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AREA_COORDS, KOTA_AREAS, PTYPE_ICONS } from "@/lib/constants";
import { fmt } from "@/lib/format";
import styles from "./styles.module.css";

/* ─── Types ─────────────────────────────────────────────────── */
type NearbyProp = {
  id: number;
  slug: string | null;
  type: "sale" | "rent";
  ptype: string;
  loc: string;
  bhk: number;
  baths: number;
  title: string;
  price: number;
  rent_per_month: number | null;
  sqft: number | null;
  img: string | null;
  gallery: string[];
  nearest_coaching_hub: string | null;
  lat: number | null;
  lng: number | null;
  dealers: { name: string; role: string } | null;
  distance?: number; // km — filled client-side
};

/* ─── Haversine ─────────────────────────────────────────────── */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/* ─── Skeleton card ─────────────────────────────────────────── */
function SkCard() {
  return (
    <div className={styles.skCard}>
      <span className={styles.sk} style={{ display: "block", width: "100%", aspectRatio: "16/9" }} />
      <div style={{ padding: 14 }}>
        <span className={styles.sk} style={{ width: "50%", height: 22, marginBottom: 8 }} />
        <span className={styles.sk} style={{ width: "75%", height: 17, marginBottom: 6 }} />
        <span className={styles.sk} style={{ width: "60%", height: 14 }} />
      </div>
    </div>
  );
}

const RADII = [1, 2, 5, 10];
const PTYPES = ["All", "Hostel", "PG", "Room", "Flat", "House", "Shop"];

/* ─── Main component ─────────────────────────────────────────── */
export default function NearbyClient({ mapsKey }: { mapsKey: string }) {
  const router = useRouter();

  // User location
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locLabel, setLocLabel] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  // Properties
  const [allProps, setAllProps] = useState<NearbyProp[]>([]);
  const [propsLoading, setPropsLoading] = useState(true);

  // Filters
  const [radius, setRadius] = useState(5);
  const [ptype, setPtype] = useState("All");
  const [budgetMax, setBudgetMax] = useState(""); // "" = any

  // Fetch all approved properties once (client-side, publishable key, RLS-gated)
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) { setPropsLoading(false); return; }

    const db = createClient(url, key, { auth: { persistSession: false } });
    db
      .from("properties")
      .select("id,slug,type,ptype,loc,bhk,baths,title,price,rent_per_month,sqft,img,gallery,nearest_coaching_hub,lat,lng,dealers!dealer_id(name,role)")
      .eq("is_approved", true)
      .then(({ data }) => {
        setAllProps((data ?? []) as unknown as NearbyProp[]);
        setPropsLoading(false);
      });
  }, []);


  // GPS: browser geolocation
  function useGps() {
    if (!navigator.geolocation) {
      setGpsError("GPS not supported on this device.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setLocLabel("Your current location");
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError("Location access denied. Please allow location or type a place below.");
        else setGpsError("Could not get your location. Please type a location below.");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  // Area dropdown fallback — pick from KOTA_AREAS
  function selectArea(area: string) {
    if (!area) return;
    const c = AREA_COORDS[area];
    if (!c) return;
    setUserLat(c.lat);
    setUserLng(c.lng);
    setLocLabel(area + ", Kota");
    setGpsError("");
  }

  function clearLocation() {
    setUserLat(null);
    setUserLng(null);
    setLocLabel("");
  }

  // Compute + filter properties
  const results = (() => {
    if (userLat === null || userLng === null) return [];

    const withDist = allProps.map((p) => {
      // use property lat/lng if set, else area fallback
      const pLat = p.lat ?? AREA_COORDS[p.loc]?.lat ?? null;
      const pLng = p.lng ?? AREA_COORDS[p.loc]?.lng ?? null;
      const distance = pLat != null && pLng != null
        ? haversine(userLat!, userLng!, pLat, pLng)
        : 999;
      return { ...p, distance };
    });

    return withDist
      .filter((p) => p.distance <= radius)
      .filter((p) => ptype === "All" || p.ptype === ptype)
      .filter((p) => {
        if (!budgetMax) return true;
        const price = p.rent_per_month ?? p.price;
        return price <= Number(budgetMax);
      })
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
  })();

  const hasLocation = userLat !== null && userLng !== null;

  function goProperty(p: NearbyProp) {
    if (p.slug) router.push(`/property/${p.slug}`);
  }

  return (
    <div className={styles.page}>

      {/* Top nav */}
      <div className={styles.topNav}>
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.backBtn} aria-label="Back">←</Link>
          <span className={styles.navLogo}>
            Prop<span style={{ color: "var(--red)" }}>100</span>
          </span>
          <span className={styles.navTitle}>Nearby Properties</span>
        </div>
      </div>

      {/* Location picker */}
      <div className={styles.locCard}>
        <div className={styles.locCardInner}>
          <div className={styles.locLabel}>Find Properties Near You</div>
          <div className={styles.locSub}>
            Use GPS or type your coaching / college / area
          </div>

          {/* GPS button */}
          <button className={styles.gpsBtn} onClick={useGps} disabled={gpsLoading}>
            {gpsLoading ? "⏳ Getting location…" : "📍 Use My Current Location"}
          </button>

          {gpsError && (
            <p style={{ fontSize: 13, color: "#f87171", marginBottom: 10 }}>{gpsError}</p>
          )}

          <div className={styles.orRow}>
            <div className={styles.orLine} />
            <span className={styles.orText}>OR</span>
            <div className={styles.orLine} />
          </div>

          {/* Area dropdown */}
          <select
            className={styles.locSelect}
            defaultValue=""
            onChange={(e) => selectArea(e.target.value)}
          >
            <option value="" disabled>Select area in Kota…</option>
            {KOTA_AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Active location pill */}
          {hasLocation && (
            <div className={styles.locPill}>
              📍 {locLabel}
              <span className={styles.locPillClear} onClick={clearLocation}>×</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter chips */}
      {hasLocation && (
        <div className={styles.filtersWrap}>
          <div className={styles.filtersInner}>
            {/* Radius */}
            {RADII.map((r) => (
              <button
                key={r}
                className={`${styles.fchip} ${radius === r ? styles.fchipActive : ""}`}
                onClick={() => setRadius(r)}
              >
                {r} km
              </button>
            ))}
            <div style={{ width: 1, background: "var(--line)", flexShrink: 0 }} />
            {/* Property type */}
            {PTYPES.map((t) => (
              <button
                key={t}
                className={`${styles.fchip} ${ptype === t ? styles.fchipActive : ""}`}
                onClick={() => setPtype(t)}
              >
                {t === "All" ? "All Types" : `${PTYPE_ICONS[t] ?? ""} ${t}`}
              </button>
            ))}
            <div style={{ width: 1, background: "var(--line)", flexShrink: 0 }} />
            {/* Budget */}
            <select
              className={styles.fchipSelect}
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
            >
              <option value="">Budget: Any</option>
              <option value="5000">Under ₹5k/mo</option>
              <option value="8000">Under ₹8k/mo</option>
              <option value="12000">Under ₹12k/mo</option>
              <option value="20000">Under ₹20k/mo</option>
              <option value="5000000">Under ₹50L (sale)</option>
            </select>
          </div>
        </div>
      )}

      {/* Results */}
      <div className={styles.body}>

        {/* Not yet picked a location */}
        {!hasLocation && !propsLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🗺️</div>
            <div className={styles.emptyTitle}>Pick your location above</div>
            <div className={styles.emptySub}>
              Use GPS or choose an area to see properties sorted by distance from you.
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {propsLoading && (
          <>
            <SkCard /><SkCard /><SkCard />
          </>
        )}

        {/* Results */}
        {hasLocation && !propsLoading && (
          <>
            <div className={styles.resultCount}>
              Showing <b>{results.length}</b> propert{results.length === 1 ? "y" : "ies"} within <b>{radius} km</b> of {locLabel}
            </div>

            {results.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                <div className={styles.emptyTitle}>Nothing found nearby</div>
                <div className={styles.emptySub}>
                  Try increasing the radius or changing the filters.
                  More properties are added every week.
                </div>
              </div>
            ) : (
              results.map((p) => {
                const price = p.rent_per_month ?? p.price;
                const img = p.img ?? p.gallery?.[0];
                return (
                  <div key={p.id} className={styles.card} onClick={() => goProperty(p)}>
                    <div className={styles.imgWrap}>
                      {img ? (
                        <img src={img} alt={p.title} className={styles.cardImg} />
                      ) : (
                        <div className={styles.cardImgPlaceholder}>
                          {PTYPE_ICONS[p.ptype] ?? "🏠"}
                        </div>
                      )}
                      <span className={styles.cardTag}>
                        {p.type === "rent" ? "For Rent" : "For Sale"}
                      </span>
                      {p.distance != null && p.distance < 990 && (
                        <span className={styles.distBadge}>
                          📍 {fmtDist(p.distance)}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardPrice}>
                        {fmt(price)}
                        {p.type === "rent" && (
                          <span className={styles.cardPricePer}>/month</span>
                        )}
                      </div>
                      <div className={styles.cardTitle}>{p.title}</div>
                      <div className={styles.cardLoc}>
                        📍 {p.loc}, Kota
                        {p.nearest_coaching_hub ? ` · 🎓 Near ${p.nearest_coaching_hub}` : ""}
                      </div>
                      <div className={styles.cardStats}>
                        {p.bhk > 0 && <span><b>{p.bhk}</b> BHK</span>}
                        {p.baths > 0 && <span><b>{p.baths}</b> Bath</span>}
                        {p.sqft && p.sqft > 0 && (
                          <span><b>{p.sqft.toLocaleString("en-IN")}</b> sqft</span>
                        )}
                      </div>
                      <div className={styles.cardFoot}>
                        <div className={styles.cardDealer}>
                          {p.dealers ? <>By <b>{p.dealers.name}</b></> : ""}
                        </div>
                        <button
                          className={styles.cardCta}
                          onClick={(e) => { e.stopPropagation(); goProperty(p); }}
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
