"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PropertyFull, PropertyUnit } from "@/lib/types";
import { AREA_COORDS, PTYPE_ICONS } from "@/lib/constants";
import { fmt, capFirst } from "@/lib/format";
import { CATEGORY_AXES, AXIS_OPTIONS, AXIS_LABELS, AxisKey, chipLabel } from "@/lib/variantConfig";
import {
  HOUSE_RULE_LABELS, SERVICE_LABELS, COMMON_AMENITY_LABELS,
  TENANT_TYPE_LABELS, gateTimeLabel, noticePeriodLabel, photoCaption,
} from "@/lib/hostelLabels";
import Lightbox, { LightboxItem } from "./Lightbox";
import { CommissionBadge } from "@/components/CommissionBadge";
import styles from "./styles.module.css";

/* ─── Haversine distance (km) ─────────────────────────────── */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtPhone(p: string): string {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.slice(0, 5) + " " + d.slice(5);
}

/* ─── Consistent line-icon set — used in the hostel-listing sections below
   (Price Breakdown, Rules & Policy, Location & Nearby, FAQ, Locality Guide,
   gallery tabs) so this rebuilt part of the page reads as one icon family
   instead of the emoji sprinkled through the rest of the (frozen) page. ─── */
type IconName =
  | "check" | "shield" | "pin" | "clock" | "users" | "ban" | "refresh" | "calendar"
  | "paw" | "volume" | "plug" | "info" | "food" | "wifi" | "snow" | "bolt" | "drop"
  | "book" | "car" | "lift" | "finger" | "bath" | "chevronDown" | "star" | "phone"
  | "whatsapp" | "sparkle" | "beds";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "check": return <svg {...common}><path d="M4 12l6 6L20 6" /></svg>;
    case "shield": return <svg {...common}><path d="M12 2l8 3v6c0 5-3.4 8.4-8 11-4.6-2.6-8-6-8-11V5z" /><path d="M9 12l2 2 4-4" /></svg>;
    case "pin": return <svg {...common}><path d="M12 22s7-6.5 7-12A7 7 0 0 0 5 10c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.4" /></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="9" r="2.6" /><path d="M15.5 12.5A5.5 5.5 0 0 1 21.5 18" /></svg>;
    case "ban": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>;
    case "refresh": return <svg {...common}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>;
    case "paw": return <svg {...common}><circle cx="7" cy="8.5" r="1.6" /><circle cx="12" cy="6" r="1.6" /><circle cx="17" cy="8.5" r="1.6" /><path d="M12 12c-4 0-6 3-6 5.5S8 20 12 20s6-1 6-2.5S16 12 12 12z" /></svg>;
    case "volume": return <svg {...common}><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 8a5 5 0 0 1 0 8" /></svg>;
    case "plug": return <svg {...common}><path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0z" /><path d="M12 18v3" /></svg>;
    case "info": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>;
    case "food": return <svg {...common}><path d="M6 2v8a2 2 0 0 0 2 2v10M6 2v6M9 2v6M6 8h3M17 2c-2 0-3 3-3 6s1 4 3 4v10" /></svg>;
    case "wifi": return <svg {...common}><path d="M2 8.5a17 17 0 0 1 20 0M5.5 12.5a12 12 0 0 1 13 0M9 16.5a7 7 0 0 1 6 0" /><circle cx="12" cy="20" r="1" /></svg>;
    case "snow": return <svg {...common}><path d="M12 2v20M4.9 5.9l14.2 12.2M19.1 5.9 4.9 18.1M2 12h20M6.5 4l-2 2 .5 3M17.5 4l2 2-.5 3M6.5 20l-2-2 .5-3M17.5 20l2-2-.5-3" /></svg>;
    case "bolt": return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
    case "drop": return <svg {...common}><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z" /></svg>;
    case "book": return <svg {...common}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" /><path d="M4 4.5v16" /></svg>;
    case "car": return <svg {...common}><path d="M5 16V9l2-4h10l2 4v7" /><path d="M3 16h18v3H3z" /><circle cx="7.5" cy="19" r="1.5" /><circle cx="16.5" cy="19" r="1.5" /></svg>;
    case "lift": return <svg {...common}><rect x="5" y="2" width="14" height="20" rx="1" /><path d="M10 8l2-2 2 2M10 16l2 2 2-2" /></svg>;
    case "finger": return <svg {...common}><path d="M12 3a7 7 0 0 0-7 7c0 3 1 5 1 7M12 3a7 7 0 0 1 7 7c0 3-.5 5.5-1.5 7.5M9 10a3 3 0 0 1 6 0c0 4 1 6 2 8M9 10c0 4.5-1 7-3 9" /></svg>;
    case "bath": return <svg {...common}><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M7 12V6a2 2 0 0 1 3.5-1.3M2 12h20" /></svg>;
    case "chevronDown": return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
    case "star": return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>;
    case "phone": return <svg {...common}><path d="M4 5c0-1 1-2 2-2h2l2 5-2 1.4a12 12 0 0 0 5.6 5.6L15 13l5 2v2c0 1-1 2-2 2C10 19 4 13 4 5z" /></svg>;
    case "whatsapp": return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.6 14.3c-.24.7-1.4 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3a3.3 3.3 0 0 1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.5c-.1.2-.3.3-.1.6.2.4.9 1.5 2 2.4 1.3 1.2 2.4 1.5 2.7 1.7.3.1.5.1.7-.1l.6-.8c.2-.3.4-.2.7-.1l1.8.9c.2.1.4.2.5.3.1.2.1 1-.2 1.7z" /></svg>;
    case "sparkle": return <svg {...common} strokeWidth={1.8}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>;
    case "beds": return <svg {...common}><path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" /><path d="M2 18v2M22 18v2M2 12V7a2 2 0 0 1 2-2h5v5" /></svg>;
    default: return null;
  }
}

/* ─── Gallery category buckets — classifies each photo using the SAME
   (tag, section) pairs the admin/owner photo tagger already writes to
   hostel_meta (see app/admin/photoTagOptions.ts), so tabs reflect whatever
   categories this specific listing's photos actually have — nothing
   fabricated. A bucket only becomes a tab if at least one photo lands in it. ─── */
type PhotoBucket =
  | "rooms" | "washroom" | "room_amenities" | "common_amenities" | "kitchen"
  | "mess" | "building" | "corridor" | "temple" | "common_area" | "neighborhood"
  | "video" | "other";

const BUCKET_LABELS: Record<PhotoBucket, string> = {
  rooms: "Rooms", washroom: "Washroom", room_amenities: "Room Amenities",
  common_amenities: "Amenities", kitchen: "Kitchen", mess: "Mess",
  building: "Building", corridor: "Corridor", temple: "Temple",
  common_area: "Common Area", neighborhood: "Neighborhood", video: "Videos", other: "More",
};

const BUCKET_ORDER: PhotoBucket[] = [
  "rooms", "washroom", "mess", "kitchen", "room_amenities", "common_amenities",
  "building", "corridor", "temple", "common_area", "neighborhood", "video", "other",
];

const ROOM_SECTION_KEYS = new Set(["single", "double", "triple", "four", "other"]);

function photoBucket(url: string, hm: { photo_tags?: Record<string, string>; photo_sections?: Record<string, string> } | null | undefined): PhotoBucket {
  const tag = hm?.photo_tags?.[url];
  const section = hm?.photo_sections?.[url];
  if (tag === "toilet") return "washroom";
  if (tag === "amenities") return "room_amenities";
  if (section === "amenities") return "common_amenities";
  if (section === "kitchen") return "kitchen";
  if (section === "mess_area") return "mess";
  if (section === "building") return "building";
  if (section === "corridor") return "corridor";
  if (section === "temple") return "temple";
  if (section === "common_area") return "common_area";
  if (section === "neighborhood") return "neighborhood";
  if (tag === "room" || tag === "bed" || (section && ROOM_SECTION_KEYS.has(section))) return "rooms";
  return "other";
}

/* ─── Distance widget ─────────────────────────────────────── */
function DistanceWidget({
  lat, lng, mapsKey,
}: {
  lat: number; lng: number; mapsKey: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [destLat, setDestLat] = useState<number | null>(null);
  const [destLng, setDestLng] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapsKey || typeof window === "undefined") return;
    if ((window as unknown as Record<string, unknown>)["google"]) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [mapsKey]);

  useEffect(() => {
    if (!loaded || !inputRef.current) return;
    const google = (window as unknown as Record<string, unknown>)["google"] as {
      maps: {
        places: {
          Autocomplete: new (
            el: HTMLInputElement,
            opts: Record<string, unknown>
          ) => { addListener: (e: string, cb: () => void) => void; getPlace: () => { geometry?: { location?: { lat: () => number; lng: () => number } } } };
        };
      };
    };
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "in" },
      fields: ["geometry", "name"],
    });
    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;
      const dLat = place.geometry.location.lat();
      const dLng = place.geometry.location.lng();
      setDestLat(dLat);
      setDestLng(dLng);
      setDistance(haversine(lat, lng, dLat, dLng));
    });
  }, [loaded, lat, lng]);

  const mapsUrl = destLat != null && destLng != null
    ? `https://www.google.com/maps/dir/${lat},${lng}/${destLat},${destLng}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className={styles.distCard}>
      <input
        ref={inputRef}
        className={styles.distInput}
        placeholder="Enter your coaching / college / location…"
        type="text"
      />
      {distance !== null ? (
        <div className={styles.distResult}>
          <div>
            <div className={styles.distKm}>{distance.toFixed(1)} km</div>
            <div className={styles.distKmSub}>straight-line distance from this property</div>
          </div>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.mapsBtn}>
            🗺 Get Directions
          </a>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Type a location above and select it from the dropdown to calculate distance.
        </p>
      )}
    </div>
  );
}

/* ─── Reviews — anyone can post, no OTP/login gate (explicit product
   decision); goes live immediately. Admin can delete from the admin
   panel. See app/api/reviews/route.ts. ─────────────────────────── */
type ReviewRow = { id: number; reviewer_name: string; rating: number; comment: string | null; created_at: string };

function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  const full = Math.round(rating);
  return (
    <span style={{ color: "#f5a623", fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(full)}{"☆".repeat(5 - full)}
    </span>
  );
}

function ReviewsSection({ propertyId, upgraded = false }: { propertyId: number; upgraded?: boolean }) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/reviews?property_id=${propertyId}`)
      .then((r) => r.json())
      .then((d) => { setReviews(d.reviews ?? []); setAverage(d.average ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    setErr("");
    if (name.trim().length < 2) { setErr("Please enter your name."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, reviewer_name: name.trim(), rating, comment: comment.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to submit review.");
      setDone(true);
      setName(""); setComment(""); setRating(5);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to submit review.");
    }
    setSubmitting(false);
  }

  return (
    <div className={`${styles.card} ${upgraded ? styles.cardUpgraded : ""}`}>
      <div className={upgraded ? styles.sectionTitleLg : styles.sectionTitle}>Tenant Reviews</div>

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className={styles.reviewsPlaceholder}>
          <div className={styles.reviewStars}>★★★★★</div>
          <div className={styles.reviewMsg}>No reviews yet for this property.</div>
          <div className={styles.reviewSub}>Be the first to share your experience.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{average.toFixed(1)}</span>
            <Stars rating={average} size={16} />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>({reviews.length} review{reviews.length === 1 ? "" : "s"})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 13.5 }}>{r.reviewer_name}</strong>
                  <Stars rating={r.rating} />
                </div>
                {r.comment && <p style={{ fontSize: 13, color: "var(--ink)", marginTop: 4, lineHeight: 1.5 }}>{r.comment}</p>}
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                  {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {done ? (
        <p style={{ fontSize: 13, color: "var(--color-primary)", fontWeight: 600 }}>✓ Thanks — your review is live.</p>
      ) : !showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", background: "rgba(15,118,110,0.08)", border: "1.5px solid var(--color-primary)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
        >
          ✍️ Write a review
        </button>
      ) : (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, marginBottom: 10, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                onClick={() => setRating(n)}
                style={{ cursor: "pointer", fontSize: 24, color: n <= rating ? "#f5a623" : "#d9d9d9" }}
              >
                ★
              </span>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience (optional)"
            rows={3}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, resize: "vertical", fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }}
          />
          {err && <p style={{ color: "var(--color-danger)", fontSize: 12.5, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={submit}
              disabled={submitting}
              style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--ok, #16a06a)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Submitting…" : "Submit review"}
            </button>
            <button
              onClick={() => { setShowForm(false); setErr(""); }}
              disabled={submitting}
              style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 16px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lead sheet ─────────────────────────────────────────────── */
type LeadPhase = "form" | "otp" | "done";

function LeadSheet({
  open,
  onClose,
  property,
  selectedUnit,
}: {
  open: boolean;
  onClose: () => void;
  property: PropertyFull;
  selectedUnit: PropertyUnit | null;
}) {
  // "Room" = the Room (PG) flow's ptype (reuses this same hostel_meta/
  // property_units-backed rich display — see app/dealer/post/room/).
  const isHostelOrPG = ["Hostel", "PG", "Room", "hostel", "pg", "room"].includes(property.ptype);
  const [phase, setPhase] = useState<LeadPhase>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [occupants, setOccupants] = useState<number>(1);
  const [msg, setMsg] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [dealerPhone, setDealerPhone] = useState("");
  const [ref, setRef] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setPhase("form"); setError(""); setOtp(""); setConsentChecked(false);
      // Verified-device prefill (30-day httpOnly cookie from a prior OTP)
      fetch("/api/leads/verified")
        .then((r) => r.json())
        .then((d) => {
          if (d?.verified) {
            if (d.name) setName(String(d.name));
            if (d.phone) setPhone(String(d.phone));
          }
        })
        .catch(() => {});
    }
  }, [open]);

  function startCooldown() {
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
    }, 1000);
  }

  // Sends the OTP over WhatsApp and moves to the verify step. The lead itself
  // (name, unit, move-in date, etc.) isn't saved yet — that happens in
  // submitOtp() below, only after the code is verified.
  async function sendOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (name.trim().length < 2) { setError("Enter your name (at least 2 characters)"); return; }
    if (cleanPhone.length !== 10) { setError("Enter a valid 10-digit phone number"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to send OTP. Please try again."); return; }
    setOtp("");
    setPhase("otp");
    startCooldown();
  }

  // Verified-device fast path: if this browser already OTP-verified this
  // number (30-day cookie), the lead saves in one round trip — no OTP step.
  // 401 = cookie missing/expired/different number → normal OTP flow.
  async function submitContact() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (name.trim().length < 2) { setError("Enter your name (at least 2 characters)"); return; }
    if (cleanPhone.length !== 10) { setError("Enter a valid 10-digit phone number"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/leads/verified", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        phone: cleanPhone,
        propId: property.id,
        dealerId: property.dealers?.id ?? null,
        unitId: selectedUnit?.id ?? null,
        unitLabel: selectedUnit?.label ?? null,
        moveInDate: moveIn || null,
        occupants,
        intent: "contact",
        msg: msg.trim() || null,
        consentedToCommission: property.type === "sale" ? consentChecked : null,
      }),
    });
    if (res.status === 401) { setLoading(false); await sendOtp(); return; }
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to save. Please try again."); return; }
    setDealerPhone(data.dealerPhone ?? "");
    setRef(data.ref ?? "");
    setPhase("done");
  }

  async function submitOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: cleanPhone,
        token: cleanOtp,
        name: name.trim(),
        propId: property.id,
        dealerId: property.dealers?.id ?? null,
        unitId: selectedUnit?.id ?? null,
        unitLabel: selectedUnit?.label ?? null,
        moveInDate: moveIn || null,
        occupants,
        intent: "contact",
        msg: msg.trim() || null,
        consentedToCommission: property.type === "sale" ? consentChecked : null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Incorrect OTP. Please try again."); return; }
    setDealerPhone(data.dealerPhone ?? "");
    setRef(data.ref ?? "");
    setPhase("done");
  }

  async function resendOtp() {
    const cleanPhone = phone.replace(/\D/g, "");
    setLoading(true);
    setError("");
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to resend OTP"); return; }
    setOtp("");
    startCooldown();
  }

  const displayPrice = selectedUnit
    ? `₹${selectedUnit.price_per_month.toLocaleString("en-IN")}/month`
    : property.type === "rent"
    ? `${fmt(property.rent_per_month ?? property.price)}/month`
    : fmt(property.price);

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        onClick={() => {
          // The OTP step's content is much shorter than the form step's, so
          // the sheet shrinks and exposes backdrop where the form used to
          // be — a stray tap there must not silently discard an OTP already
          // sent. "← Change phone number" below is the intentional way back.
          if (phase === "otp") return;
          onClose();
        }}
      />
      <div className={`${styles.sheet} ${open ? styles.sheetOpen : ""}`}>
        <div className={styles.sheetHandle} />
        <div className={styles.sheetBody}>

          {phase === "form" && (
            <>
              <div className={styles.sheetTitle}>Get Partner Contact</div>
              <div className={styles.sheetSub}>{property.title}</div>
              {selectedUnit && (
                <div className={styles.sheetUnitBadge}>
                  🏠 {selectedUnit.label} · {displayPrice}
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Your Name</label>
                <input
                  className={styles.formInput}
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Phone Number</label>
                <input
                  className={styles.formInput}
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Needed From (optional)</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={moveIn}
                  onChange={(e) => setMoveIn(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>For How Many People?</label>
                <div className={styles.occupantBtns}>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      className={`${styles.occupantBtn} ${occupants === n ? styles.occupantBtnActive : ""}`}
                      onClick={() => setOccupants(n)}
                    >
                      {n === 4 ? "4+" : n}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Message (optional)</label>
                <textarea
                  className={styles.optTextarea}
                  placeholder="Any specific requirements…"
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={2}
                />
              </div>

              {error && <div className={styles.formError}>{error}</div>}

              {property.type === "sale" && (
                <label className={styles.consentRow}>
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                  />
                  <span>
                    I understand a buyer commission of <b>only 0.25% of the deal price</b> applies
                    only if I close this deal — 75% lesser than the market&apos;s standard commission.
                  </span>
                </label>
              )}

              <button
                className={`${styles.submitBtn} ${isHostelOrPG ? styles.ctaLift : ""}`}
                onClick={submitContact}
                disabled={loading || (property.type === "sale" && !consentChecked)}
              >
                {loading ? "Please wait…" : "Get Contact Details →"}
              </button>

              <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                {property.type === "sale"
                  ? "Your details are shared only with this partner — no spam. Buyer commission applies only on closing, never before."
                  : "Your details are shared only with this partner — no spam, no brokerage fee."}
              </p>
            </>
          )}

          {phase === "otp" && (
            <>
              <div className={styles.sheetTitle}>Verify Your Phone</div>
              <p className={styles.otpHint}>
                OTP sent to <b style={{ color: "var(--ink)" }}>+91 {phone.replace(/\D/g, "")}</b>
                <br />Valid for 10 minutes. Do not share with anyone.
              </p>

              <input
                className={styles.otpInput}
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="——————"
                value={otp}
                onChange={(e) => { setOtp(e.target.value); setError(""); }}
                autoFocus
              />

              {error && <div className={styles.formError}>{error}</div>}

              <button
                className={`${styles.submitBtn} ${isHostelOrPG ? styles.ctaLift : ""}`}
                onClick={submitOtp}
                disabled={loading}
              >
                {loading ? "Verifying…" : "Verify & Get Contact →"}
              </button>

              <div className={styles.resendRow}>
                <button
                  className={styles.resendBtn}
                  disabled={cooldown > 0 || loading}
                  onClick={resendOtp}
                >
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
              <button
                onClick={() => { setPhase("form"); setError(""); setOtp(""); }}
                style={{ display: "block", width: "100%", marginTop: 4, color: "var(--muted)", fontSize: 13, padding: "8px 0", textAlign: "center" }}
              >
                ← Change phone number
              </button>
            </>
          )}

          {phase === "done" && (
            <>
              <div className={styles.sheetTitle}>Contact Partner</div>
              <div className={styles.revealBox}>
                {ref && (
                  <div className={styles.revealRef}>✓ REFERENCE: {ref}</div>
                )}
                {property.dealers && (
                  <div className={styles.revealDealerName}>{property.dealers.name}</div>
                )}
                {dealerPhone ? (
                  <>
                    <a
                      href={`tel:+91${dealerPhone}`}
                      className={`${styles.revealPhoneBtn} ${isHostelOrPG ? styles.ctaLift : ""}`}
                    >
                      📞 +91 {fmtPhone(dealerPhone)}
                    </a>
                    <a
                      href={`https://wa.me/91${dealerPhone}?text=${encodeURIComponent(`Hi, I'm interested in ${property.title}${selectedUnit ? ` — ${selectedUnit.label}` : ""}. My reference: ${ref}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`${styles.revealWaBtn} ${isHostelOrPG ? styles.ctaLift : ""} ${isHostelOrPG ? styles.ctaPulse : ""}`}
                    >
                      💬 WhatsApp the Partner
                    </a>
                  </>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>
                    Partner will contact you shortly on +91 {phone.replace(/\D/g, "")}.
                  </p>
                )}
              </div>
              {ref && (
                <p className={styles.revealNote}>
                  Show reference <b>{ref}</b> to the partner when you visit the property.
                  Your lead has been saved and the partner has been notified on WhatsApp.
                </p>
              )}
              <button className={styles.submitBtn} onClick={onClose}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Variant helpers ─────────────────────────────────────────── */

function orderedAxisValues(axis: AxisKey, units: PropertyUnit[]): string[] {
  const present = new Set(
    units
      .map((u) => u.attributes?.[axis])
      .filter((v) => v !== undefined && v !== null)
      .map((v) => String(v))
  );
  const opts = AXIS_OPTIONS[axis];
  if (opts.length > 0) {
    return opts.filter((o) => present.has(o.value)).map((o) => o.value);
  }
  return Array.from(present).sort((a, b) => Number(a) - Number(b));
}

// Seeds the variant selector. A search/filter link can pin a specific
// variant per axis (e.g. ?occupancy=double) — that's honored axis-by-axis
// rather than all-or-nothing, so "double" still applies even if cooling
// wasn't part of the search. Any axis left unpinned defaults to whichever
// value is first in its canonical order (Single before Double before
// Triple, etc.) — not the cheapest — preferring one still in stock.
function initSel(
  units: PropertyUnit[],
  axes: AxisKey[],
  params: Record<string, string>
): Record<string, string> {
  if (axes.length === 0 || units.length === 0) return {};

  const result: Record<string, string> = {};
  let candidates = units;

  for (const ax of axes) {
    const fromUrl = params[ax];
    const urlValid = fromUrl !== undefined
      && candidates.some((u) => String(u.attributes?.[ax] ?? "") === fromUrl);

    let chosen: string | undefined;
    if (urlValid) {
      chosen = fromUrl;
    } else {
      const ordered = orderedAxisValues(ax, candidates);
      const withStock = ordered.find((v) =>
        candidates.some((u) => String(u.attributes?.[ax] ?? "") === v && (u.available_count ?? 0) > 0)
      );
      chosen = withStock ?? ordered[0];
    }

    if (chosen === undefined) continue;
    result[ax] = chosen;
    candidates = candidates.filter((u) => String(u.attributes?.[ax] ?? "") === chosen);
  }

  return result;
}

function resolveUnit(
  units: PropertyUnit[],
  sel: Record<string, string>,
  axes: AxisKey[]
): PropertyUnit | null {
  if (units.length === 0) return null;
  if (axes.length === 0) return units[0];
  return (
    units.find((u) =>
      axes.every(
        (ax) => sel[ax] !== undefined && String(u.attributes?.[ax] ?? "") === sel[ax]
      )
    ) ?? null
  );
}

function chipEnabled(
  axis: string,
  value: string,
  sel: Record<string, string>,
  axes: AxisKey[],
  units: PropertyUnit[]
): boolean {
  return units.some((u) => {
    if (String(u.attributes?.[axis] ?? "") !== value) return false;
    for (const oa of axes) {
      if (oa === axis || !sel[oa]) continue;
      if (String(u.attributes?.[oa] ?? "") !== sel[oa]) return false;
    }
    return true;
  });
}

function selectChip(
  axis: string,
  value: string,
  current: Record<string, string>,
  axes: AxisKey[],
  units: PropertyUnit[]
): Record<string, string> {
  const next = { ...current, [axis]: value };
  for (const oa of axes) {
    if (oa === axis) continue;
    const valid =
      next[oa] !== undefined &&
      units.some(
        (u) =>
          String(u.attributes?.[axis] ?? "") === value &&
          String(u.attributes?.[oa] ?? "") === next[oa]
      );
    if (valid) continue;
    // The other axis's current value no longer matches — re-seed it with the
    // best compatible option instead of deleting it. Leaving an axis empty
    // makes resolveUnit() return null (it requires every axis to be set),
    // which is why switching e.g. Single -> Double silently stopped updating
    // the gallery/price once an incompatible axis had been cleared once.
    const compatible = units.filter((u) => String(u.attributes?.[axis] ?? "") === value);
    const available = compatible.filter((u) => (u.available_count ?? 0) > 0);
    const source = available.length > 0 ? available : compatible;
    const best = source.length > 0
      ? source.reduce((a, b) => (a.price_per_month ?? 0) <= (b.price_per_month ?? 0) ? a : b)
      : undefined;
    const v = best?.attributes?.[oa];
    if (v !== undefined && v !== null) next[oa] = String(v);
    else delete next[oa];
  }
  return next;
}

// "Only N left" is meant as a real scarcity signal (some rooms already
// taken) — not just "this room type only has a small total to begin with".
// A brand-new unit where nothing has been booked yet (available === total)
// should never read as urgent, no matter how small that total is — that was
// the "Only 1 left" showing on every admin-created room type that left
// total/available at their defaults.
function availInfo(count: number, total: number): { text: string; cls: string } {
  if (count === 0) return { text: "Full — no vacancy", cls: styles.availFull };
  if (count <= 2 && count < total) return { text: `⚡ Only ${count} left`, cls: styles.availFew };
  return { text: `✓ ${count} available`, cls: styles.availOk };
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/* ─── Similar property card ───────────────────────────────────── */
type SimilarProp = {
  id: number;
  slug: string;
  title: string;
  ptype: string;
  loc: string;
  img: string | null;
  rent_per_month: number | null;
  price: number;
  type: string;
};

function SimilarCard({ p }: { p: SimilarProp }) {
  const price = p.type === "rent"
    ? `₹${(p.rent_per_month ?? p.price).toLocaleString("en-IN")}/mo`
    : fmt(p.price);
  return (
    <Link href={`/property/${p.slug}`} className={styles.similarCard}>
      <div className={styles.similarImg}>
        {p.img
          ? <img src={p.img} alt={p.title} />
          : <div className={styles.similarImgPlaceholder}>{PTYPE_ICONS[p.ptype] ?? "🏠"}</div>
        }
      </div>
      <div className={styles.similarBody}>
        <div className={styles.similarPtype}>{p.ptype}</div>
        <div className={styles.similarTitle}>{p.title}</div>
        <div className={styles.similarLoc}>📍 {p.loc}</div>
        <div className={styles.similarPrice}>{price}</div>
      </div>
    </Link>
  );
}

/* ─── NEW hostel-listing sections (property detail page, hostel/PG only) ─── */

function electricityLabel(e: string | null | undefined): string | null {
  if (e === "included") return "Included in rent";
  if (e === "metered") return "As per meter";
  if (e === "fixed") return "Fixed monthly charge";
  return null;
}

function PriceBreakdownCard({
  rent, deposit, electricity, maintenance, extra,
}: {
  rent: number;
  deposit: number | null | undefined;
  electricity: string | null;
  maintenance: number | null | undefined;
  extra: { label: string; value: string }[];
}) {
  const showTotal = Boolean(maintenance) || extra.length > 0;
  const total = rent + (maintenance ?? 0);
  return (
    <div className={`${styles.card} ${styles.cardUpgraded}`}>
      <div className={styles.sectionTitleLg}>Price Breakdown</div>
      <div className={styles.ledger}>
        <div className={styles.ledgerRow}>
          <span>Rent</span>
          <span className={styles.ledgerVal}>₹{rent.toLocaleString("en-IN")} / mo</span>
        </div>
        {deposit ? (
          <div className={styles.ledgerRow}>
            <span>Security Deposit</span>
            <span className={styles.ledgerVal}>₹{deposit.toLocaleString("en-IN")} (refundable)</span>
          </div>
        ) : null}
        {electricity ? (
          <div className={styles.ledgerRow}>
            <span>Electricity</span>
            <span className={styles.ledgerVal}>{electricity}</span>
          </div>
        ) : null}
        {maintenance ? (
          <div className={styles.ledgerRow}>
            <span>Maintenance</span>
            <span className={styles.ledgerVal}>₹{maintenance.toLocaleString("en-IN")} / mo</span>
          </div>
        ) : null}
        {extra.map((e, i) => (
          <div className={styles.ledgerRow} key={i}>
            <span>{e.label}</span>
            <span className={styles.ledgerVal}>{e.value}</span>
          </div>
        ))}
        {showTotal && (
          <div className={`${styles.ledgerRow} ${styles.ledgerTotal}`}>
            <span>Typical monthly outgo</span>
            <span className={styles.ledgerVal}>₹{total.toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

type AmenityItem = { icon: IconName; label: string };

function GroupedAmenitiesCard({ property, hm }: { property: PropertyFull; hm: PropertyFull["hostel_meta"] }) {
  const commonSet = new Set(hm?.common_amenities ?? []);
  const serviceSet = new Set(hm?.services ?? []);

  const food: AmenityItem[] = [];
  if (property.meals_included) food.push({ icon: "food", label: "Meals Included" });
  if (commonSet.has("kitchen")) food.push({ icon: "food", label: "Self-cooking Kitchen" });
  if (commonSet.has("ro")) food.push({ icon: "drop", label: "RO Water" });
  if (commonSet.has("fridge")) food.push({ icon: "snow", label: "Fridge" });
  if (commonSet.has("microwave")) food.push({ icon: "bolt", label: "Microwave" });

  const safety: AmenityItem[] = [];
  if (serviceSet.has("warden")) safety.push({ icon: "shield", label: "Warden" });

  const comfort: AmenityItem[] = [];
  if (property.wifi_included || commonSet.has("wifi")) comfort.push({ icon: "wifi", label: "WiFi" });
  if (property.attached_bathroom) comfort.push({ icon: "bath", label: "Attached Bathroom" });
  if (commonSet.has("lift")) comfort.push({ icon: "lift", label: "Lift" });
  if (commonSet.has("gym")) comfort.push({ icon: "bolt", label: "Gymnasium" });
  if (commonSet.has("power_backup")) comfort.push({ icon: "plug", label: "Power Backup" });
  if (commonSet.has("tv")) comfort.push({ icon: "info", label: "TV" });
  if (serviceSet.has("laundry")) comfort.push({ icon: "drop", label: "Laundry" });
  if (serviceSet.has("cleaning")) comfort.push({ icon: "sparkle", label: "Room Cleaning" });
  if (property.parking_available) comfort.push({ icon: "car", label: "Parking" });
  if (hm?.parking_enabled) {
    (hm.parking_types ?? []).forEach((p) =>
      comfort.push({ icon: "car", label: p === "two_wheeler" ? "2-Wheeler Parking" : "Car Parking" })
    );
  }

  const groups: { label: string; items: AmenityItem[] }[] = [
    { label: "Food", items: food },
    { label: "Study", items: [] },
    { label: "Safety", items: safety },
    { label: "Comfort", items: comfort },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className={`${styles.card} ${styles.cardUpgraded}`}>
      <div className={styles.sectionTitleLg}>Amenities</div>
      {groups.map((g) => (
        <div key={g.label} className={styles.amenityGroup}>
          <div className={styles.amenityGroupLabel}>{g.label}</div>
          <div className={styles.amenityGrid}>
            {g.items.map((a) => (
              <div key={a.label} className={styles.amenity}>
                <span className={styles.amenityIconSvg}><Icon name={a.icon} size={15} /></span>
                {a.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LocationNearbyCard({
  places, coachingHub,
}: {
  places: { name: string; distance: string; category?: string }[] | undefined;
  coachingHub: string | null;
}) {
  if (!places || places.length === 0) return null;
  return (
    <div className={`${styles.card} ${styles.cardUpgraded}`}>
      <div className={styles.sectionTitleLg}>Location &amp; Nearby</div>
      <p className={styles.sectionSub}>
        Walking distances from this property{coachingHub ? ` — near ${coachingHub}` : ""}.
      </p>
      <div className={styles.nearbyList}>
        {places.map((p, i) => (
          <div key={i} className={styles.nearbyRow}>
            <span className={styles.nearbyIcon}><Icon name="pin" size={14} /></span>
            <span className={styles.nearbyName}>{p.name}</span>
            <span className={styles.nearbyDist}>{p.distance}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type RuleEntry = { icon: IconName; name: string; value: string };

function buildRuleEntries(
  property: PropertyFull,
  hm: PropertyFull["hostel_meta"],
  displayDeposit: number | null | undefined
): RuleEntry[] {
  const entries: RuleEntry[] = [];
  if (property.gender_preference && property.gender_preference !== "any") {
    entries.push({
      icon: "users",
      name: property.gender_preference === "boys" ? "Boys Only" : "Girls Only",
      value: "Restricted entry",
    });
  }
  if (property.meals_included) entries.push({ icon: "food", name: "Meals", value: "Provided — confirm timing with partner" });
  if (property.min_stay_months) {
    entries.push({ icon: "calendar", name: "Minimum Stay", value: `${property.min_stay_months} month${property.min_stay_months > 1 ? "s" : ""}` });
  }
  if (displayDeposit) entries.push({ icon: "info", name: "Security Deposit", value: `₹${displayDeposit.toLocaleString("en-IN")} (refundable)` });
  if (hm?.tenant_types && hm.tenant_types.length > 0) {
    entries.push({ icon: "users", name: "For", value: hm.tenant_types.map((t) => TENANT_TYPE_LABELS[t] ?? t).join(" & ") });
  }
  if (hm?.gate_timing_enabled && hm.gate_closing_time) {
    entries.push({ icon: "clock", name: "Gate Timing", value: `Closes ${gateTimeLabel(hm.gate_closing_time)}` });
  }
  if (hm?.notice_period) entries.push({ icon: "refresh", name: "Notice Period", value: noticePeriodLabel(hm.notice_period) });
  if (hm?.services && hm.services.length > 0) {
    entries.push({ icon: "plug", name: "Services", value: hm.services.map((s) => SERVICE_LABELS[s]?.label ?? s).join(", ") });
  }
  (hm?.house_rules ?? []).forEach((r) => entries.push({ icon: "ban", name: "House Rule", value: HOUSE_RULE_LABELS[r] ?? r }));
  if (hm?.landmark) entries.push({ icon: "pin", name: "Landmark", value: hm.landmark });
  return entries;
}

function RulesPolicyGrid({ entries, title }: { entries: RuleEntry[]; title: string }) {
  return (
    <div className={`${styles.card} ${styles.cardUpgraded}`}>
      <div className={styles.sectionTitleLg}>{title} Rules &amp; Policy</div>
      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          Contact partner to confirm entry timing, visitor policy &amp; food menu.
        </p>
      ) : (
        <div className={styles.rulesGrid}>
          {entries.map((r, i) => (
            <div key={i} className={styles.ruleCard}>
              <span className={styles.ruleIconBox}><Icon name={r.icon} size={15} /></span>
              <div>
                <div className={styles.ruleName}>{r.name}</div>
                <div className={styles.ruleVal}>{r.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// TODO: text-based question matching is fragile (a typo'd re-type of a
// default question silently becomes a duplicate instead of an override) —
// revisit when building the FAQ default+override admin editor, which should
// link an override to its default by ID instead of matching on question text.
function mergeFaqs(
  defaults: { question: string; answer: string }[],
  overrides: { question: string; answer: string }[]
): { question: string; answer: string }[] {
  const normalize = (q: string) => q.trim().toLowerCase();
  const overrideMap = new Map(overrides.map((o) => [normalize(o.question), o]));
  const usedKeys = new Set<string>();
  const merged = defaults.map((d) => {
    const key = normalize(d.question);
    const o = overrideMap.get(key);
    if (o) { usedKeys.add(key); return o; }
    return d;
  });
  const additions = overrides.filter((o) => !usedKeys.has(normalize(o.question)));
  return [...merged, ...additions];
}

function FaqAccordion({ items }: { items: { question: string; answer: string }[] | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`${styles.card} ${styles.cardUpgraded}`}>
      <div className={styles.sectionTitleLg}>FAQ</div>
      <div className={styles.faqList}>
        {items.map((f, i) => (
          <details key={i} className={styles.faqItem}>
            <summary className={styles.faqSummary}>
              <span>{f.question}</span>
              <span className={styles.faqChevron}><Icon name="chevronDown" size={14} /></span>
            </summary>
            <p className={styles.faqAnswer}>{f.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

function LocalityGuideCard({ locality }: { locality: PropertyFull["locality"] }) {
  if (!locality) return null;
  const tiles: { label: string; value: string }[] = [];
  if (locality.average_rent) tiles.push({ label: "Average Rent", value: locality.average_rent });
  if (locality.popular_coachings && locality.popular_coachings.length > 0) {
    tiles.push({ label: "Popular Coachings", value: locality.popular_coachings.join(", ") });
  }
  if (locality.best_cafes && locality.best_cafes.length > 0) {
    tiles.push({ label: "Best Cafes", value: locality.best_cafes.join(", ") });
  }
  if (locality.transport) tiles.push({ label: "Transport", value: locality.transport });
  if (locality.safety_note) tiles.push({ label: "Safety", value: locality.safety_note });
  if (tiles.length === 0) return null;

  return (
    <div className={`${styles.card} ${styles.cardUpgraded}`}>
      <div className={styles.sectionTitleLg}>Living in {locality.name}</div>
      <div className={styles.localityGrid}>
        {tiles.map((t, i) => (
          <div key={i} className={styles.localityTile}>
            <div className={styles.localityLabel}>{t.label}</div>
            <div className={styles.localityVal}>{t.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */
export default function PropertyDetail({
  property,
  mapsKey,
  initialParams = {},
  faqDefaults = [],
}: {
  property: PropertyFull;
  mapsKey: string;
  initialParams?: Record<string, string>;
  faqDefaults?: { question: string; answer: string }[];
}) {
  const gallery = property.gallery?.length ? property.gallery : property.img ? [property.img] : [];
  const videos = property.videos ?? [];
  const units = property.property_units ?? [];
  const dealer = property.dealers;

  const axes: AxisKey[] = CATEGORY_AXES[property.ptype] ?? [];
  const showSelector = units.length >= 2 && axes.length > 0;

  const [sel, setSel] = useState<Record<string, string>>(() =>
    initSel(units, axes, initialParams)
  );
  const [heroIdx, setHeroIdx] = useState(() => {
    // Default is always the first photo. The only exception: the visitor
    // arrived via a search/filter link that pins a specific occupancy
    // (e.g. ?occupancy=double) AND the dealer tagged a photo for that room
    // type — then open straight on that photo instead.
    const occ = initialParams.occupancy;
    const sections = property.hostel_meta?.photo_sections;
    if (!occ || !sections) return 0;
    const idx = gallery.findIndex((url) => sections[url] === occ);
    return idx >= 0 ? idx : 0;
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [similarProps, setSimilarProps] = useState<SimilarProp[]>([]);
  const [activeBucket, setActiveBucket] = useState<string>("all");

  const selectedUnit = resolveUnit(units, sel, axes);

  const displayGallery =
    selectedUnit?.unit_photos?.length ? selectedUnit.unit_photos : gallery;

  // Switching variant chips (occupancy or cooling) jumps the SAME shared
  // gallery to a photo tagged for that room type, if the dealer tagged one —
  // one viewer that switches photo, not a separate gallery per variant.
  // Skips its first run: the initial photo is already decided by heroIdx's
  // own useState initializer above (first photo, unless the URL explicitly
  // asked for a variant), so this only reacts to the visitor changing chips.
  // Compares actual values (not a "have I run once" flag) so React Strict
  // Mode's dev-only double-invoke of effects on mount can't defeat the
  // skip — both synthetic runs see the same key as prevSelKey and no-op.
  const prevSelKey = useRef(`${selectedUnit?.id ?? ""}|${sel.occupancy ?? ""}`);
  useEffect(() => {
    const key = `${selectedUnit?.id ?? ""}|${sel.occupancy ?? ""}`;
    if (key === prevSelKey.current) return;
    prevSelKey.current = key;
    const occ = sel.occupancy;
    const sections = property.hostel_meta?.photo_sections;
    const idx = occ && sections ? displayGallery.findIndex((url) => sections[url] === occ) : -1;
    setHeroIdx(idx >= 0 ? idx : 0);
  }, [selectedUnit?.id, sel.occupancy]);

  // Unified photo + video list — also drives the main hero/thumbnail strip
  // (so videos preview inline like Amazon/Flipkart, no tap-in required to
  // even see them) and the full-screen lightbox for a deeper zoomed view.
  const lightboxItems: LightboxItem[] = [
    ...displayGallery.map((url) => ({
      url,
      type: "photo" as const,
      caption: photoCaption(url, property.hostel_meta),
    })),
    ...videos.map((url, i) => ({
      url,
      type: "video" as const,
      caption: videos.length > 1 ? `Video Tour ${i + 1}` : "Video Tour",
    })),
  ];

  // Gallery category tabs (hostel listings only) — bucket every photo/video
  // by the (tag, section) pairs already stored in hostel_meta so tabs reflect
  // whatever categories THIS listing's photos actually have. A tab with no
  // matching photos never appears.
  const galleryBuckets = (() => {
    const map = new Map<PhotoBucket, number[]>();
    lightboxItems.forEach((it, i) => {
      const b: PhotoBucket = it.type === "video" ? "video" : photoBucket(it.url, property.hostel_meta);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(i);
    });
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
      key: b, label: BUCKET_LABELS[b], indices: map.get(b)!,
    }));
  })();
  const visibleThumbIndices =
    activeBucket === "all"
      ? lightboxItems.map((_, i) => i)
      : galleryBuckets.find((b) => b.key === activeBucket)?.indices ?? lightboxItems.map((_, i) => i);

  // Fetch similar properties
  useEffect(() => {
    if (!property.slug) return;
    fetch(`/api/similar?ptype=${encodeURIComponent(property.ptype)}&loc=${encodeURIComponent(property.loc)}&exclude=${encodeURIComponent(property.slug ?? "")}&limit=6`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSimilarProps(d); })
      .catch(() => {});
  }, [property.slug, property.ptype, property.loc]);

  const propLat = property.lat ?? AREA_COORDS[property.loc]?.lat ?? null;
  const propLng = property.lng ?? AREA_COORDS[property.loc]?.lng ?? null;
  // Map embed + "Distance from Your Location" hidden on every property page
  // per explicit request — kept behind a flag rather than deleted in case
  // it comes back later.
  const showDistWidget = false && Boolean(mapsKey && propLat && propLng);

  const openSheet = useCallback(() => { setSheetOpen(true); }, []);

  /* Concierge handoff — replaces the old openSheet (OTP -> reveal owner
     number) as the primary CTA action. openSheet/LeadSheet below is left
     in place but unreached from these buttons; the OTP->reveal flow is
     superseded, not deleted. Session-gated: an anonymous student is sent
     to /account to log in, with the intent stashed so /account can
     resume it straight into WhatsApp after login. */
  const startConcierge = useCallback(async () => {
    const sourceUrl = window.location.pathname;
    const res = await fetch("/api/concierge/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property.id, sourceUrl }),
    });
    if (res.status === 401) {
      sessionStorage.setItem(
        "p100_pending_concierge",
        JSON.stringify({ propertyId: property.id, sourceUrl })
      );
      window.location.href = "/account?next=" + encodeURIComponent(sourceUrl);
      return;
    }
    const data = await res.json();
    if (data.waLink) window.location.href = data.waLink;
  }, [property.id]);

  const displayPrice = selectedUnit
    ? selectedUnit.price_per_month
    : property.type === "rent"
    ? (property.rent_per_month ?? property.price)
    : property.price;

  const displayDeposit = selectedUnit?.deposit_amount ?? property.deposit_amount;

  const availUnit = selectedUnit ?? (units.length === 1 ? units[0] : null);
  const avail = availUnit !== null ? availInfo(availUnit.available_count ?? 0, availUnit.total_count ?? 0) : null;
  const freshDays = availUnit ? daysSince(availUnit.last_confirmed_at) : null;

  const isFull = (availUnit?.available_count ?? -1) === 0;
  const ctaLabel = "Get contact details";

  // "Other" is a locked enum value on nearest_coaching_hub (CLAUDE.md) — the
  // real name the admin/owner typed lives in hostel_meta.custom_coaching_hub
  // instead, so the public page never shows the literal word "Other".
  const coachingHubDisplay =
    property.nearest_coaching_hub === "Other" && property.hostel_meta?.custom_coaching_hub
      ? property.hostel_meta.custom_coaching_hub
      : property.nearest_coaching_hub;

  // Highlights: top features as icon-chips
  const highlights: { icon: string; label: string }[] = [];
  if (property.gender_preference && property.gender_preference !== "any") {
    highlights.push({
      icon: property.gender_preference === "boys" ? "👦" : "👧",
      label: property.gender_preference === "boys" ? "Boys Only" : "Girls Only",
    });
  }
  if (property.meals_included) highlights.push({ icon: "🍽️", label: "Meals Included" });
  if (property.wifi_included) highlights.push({ icon: "📶", label: "Free WiFi" });
  if (property.parking_available) highlights.push({ icon: "🚗", label: "Parking" });
  if (property.attached_bathroom) highlights.push({ icon: "🚿", label: "Attached Bath" });
  if (coachingHubDisplay) highlights.push({ icon: "🎓", label: `Near ${coachingHubDisplay}` });
  if (property.furnishing_status === "furnished") highlights.push({ icon: "🛋️", label: "Fully Furnished" });
  if (property.furnishing_status === "semi-furnished") highlights.push({ icon: "🛋️", label: "Semi-Furnished" });
  if (property.min_stay_months) highlights.push({ icon: "📅", label: `Min ${property.min_stay_months} Month${property.min_stay_months > 1 ? "s" : ""}` });
  if (property.hostel_meta?.usp_text) highlights.push({ icon: "✨", label: property.hostel_meta.usp_text });

  // "Room" = the Room (PG) flow's ptype (reuses this same hostel_meta/
  // property_units-backed rich display — see app/dealer/post/room/).
  const isHostelOrPG = ["Hostel", "PG", "Room", "hostel", "pg", "room"].includes(property.ptype);
  const hm = property.hostel_meta;

  function fmtDateStr(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  }

  function renderVariantSelector() {
    return (
      <div className={styles.variantSection}>
        {axes.map((ax) => {
          const vals = orderedAxisValues(ax, units);
          return (
            <div key={ax} className={styles.variantAxis}>
              <div className={styles.axisLabel}>
                {AXIS_LABELS[ax]}
                {sel[ax] && (
                  <span className={styles.axisSelected}>{chipLabel(ax, sel[ax])}</span>
                )}
              </div>
              <div className={styles.chipRow}>
                {vals.map((v) => {
                  const isActive = sel[ax] === v;
                  const enabled = chipEnabled(ax, v, sel, axes, units);
                  return (
                    <button
                      key={v}
                      className={`${styles.variantChip} ${isActive ? styles.variantChipActive : ""} ${!enabled ? styles.variantChipDisabled : ""}`}
                      onClick={() => {
                        if (enabled) setSel(selectChip(ax, v, sel, axes, units));
                      }}
                      disabled={!enabled}
                      aria-pressed={isActive}
                    >
                      {chipLabel(ax, v)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── Section nodes, computed once and placed in different orders for the
     hostel/PG branch vs. every other property type below. Non-hostel order
     and markup is untouched — only the hostel branch reorders/upgrades. ─── */
  const aboutNode = property.description && (
    <div className={`${styles.card} ${isHostelOrPG ? styles.cardUpgraded : ""}`}>
      <div className={isHostelOrPG ? styles.sectionTitleLg : styles.sectionTitle}>About This Property</div>
      <div className={`${styles.descText} ${descExpanded ? styles.descExpanded : styles.descClamped}`}>
        {property.description}
      </div>
      {property.description.length > 200 && (
        <button className={styles.readMoreBtn} onClick={() => setDescExpanded((v) => !v)}>
          {descExpanded ? "Show less ↑" : "Read more ↓"}
        </button>
      )}
    </div>
  );

  const rentRoomDetailsNode = property.type === "rent" && (
    <div className={`${styles.card} ${isHostelOrPG ? styles.cardUpgraded : ""}`}>
      <div className={isHostelOrPG ? styles.sectionTitleLg : styles.sectionTitle}>Rent & Room Details</div>
      <div className={styles.detailList}>
        {property.available_from && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>📅 Available From</span>
            <span className={styles.detailValue}>{fmtDateStr(property.available_from)}</span>
          </div>
        )}
        {property.min_stay_months && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>🗓 Minimum Stay</span>
            <span className={styles.detailValue}>{property.min_stay_months} month{property.min_stay_months > 1 ? "s" : ""}</span>
          </div>
        )}
        {property.gender_preference && property.gender_preference !== "any" && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>👤 For</span>
            <span className={styles.detailValue} style={{ textTransform: "capitalize" }}>
              {property.gender_preference === "boys" ? "Boys Only" : "Girls Only"}
            </span>
          </div>
        )}
        {property.furnishing_status && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>🛋️ Furnishing</span>
            <span className={styles.detailValue} style={{ textTransform: "capitalize" }}>
              {property.furnishing_status.replace("-", " ")}
            </span>
          </div>
        )}
        {property.floor_number != null && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>🏢 Floor</span>
            <span className={styles.detailValue}>
              {property.floor_number}{property.total_floors ? ` of ${property.total_floors}` : ""}
            </span>
          </div>
        )}
        {coachingHubDisplay && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>🎓 Nearest Coaching</span>
            <span className={styles.detailValue}>{coachingHubDisplay}</span>
          </div>
        )}
      </div>
    </div>
  );

  const legacyAmenitiesNode = (() => {
    const base = [
      { icon: "🍽️", label: "Meals Included", val: property.meals_included },
      { icon: "📶", label: "WiFi Included", val: property.wifi_included },
      { icon: "🚗", label: "Parking", val: property.parking_available },
      { icon: "🚿", label: "Attached Bath", val: property.attached_bathroom },
    ].filter((a) => a.val);
    const fromHostelMeta = (hm?.common_amenities ?? [])
      .filter((k) => k !== "wifi")
      .map((k) => COMMON_AMENITY_LABELS[k])
      .filter((v): v is { label: string; icon: string } => Boolean(v));
    const all = [...base, ...fromHostelMeta];
    const parkingTypes = hm?.parking_enabled
      ? (hm.parking_types ?? []).map((k) => (k === "two_wheeler" ? "2 Wheeler" : "Car"))
      : [];
    const extras = [
      ...(property.features?.length > 0 && !isHostelOrPG ? property.features : []),
      ...parkingTypes.map((p) => `Parking: ${p}`),
    ];
    if (all.length === 0 && extras.length === 0) return null;
    return (
      <div className={styles.card}>
        <div className={styles.sectionTitle}>Amenities</div>
        <div className={styles.amenityGrid}>
          {all.map((a) => (
            <div key={a.label} className={styles.amenity}>
              <span className={styles.amenityIcon}>{a.icon}</span>
              {a.label}
            </div>
          ))}
        </div>
        {extras.length > 0 && (
          <div className={styles.chips} style={{ marginTop: 12 }}>
            {extras.map((f) => (
              <span key={f} className={styles.chip}>{f}</span>
            ))}
          </div>
        )}
      </div>
    );
  })();

  const dealerNode = dealer && (
    <div className={`${styles.card} ${isHostelOrPG ? styles.cardUpgraded : ""}`}>
      <div className={isHostelOrPG ? styles.sectionTitleLg : styles.sectionTitle}>Listed By</div>
      <div className={styles.dealerCard}>
        <div className={styles.dealerAvatar}>{dealer.name[0]}</div>
        <div className={styles.dealerInfo}>
          <div className={styles.dealerName}>{dealer.name}</div>
          <div className={styles.dealerRole}>{dealer.role}</div>
          <div className={styles.dealerStats}>
            <span><b>{dealer.years}</b> yrs exp</span>
            <span>⭐ <b>{dealer.rating}</b> rating</span>
          </div>
        </div>
        {!isFull && (
          <button className={`${styles.dealerCtaBtn} ${isHostelOrPG ? styles.ctaLift : ""}`} onClick={startConcierge}>
            Contact
          </button>
        )}
      </div>
    </div>
  );

  const reviewsNode = <ReviewsSection propertyId={property.id} upgraded={isHostelOrPG} />;

  const similarNode = similarProps.length > 0 && (
    <div className={`${styles.card} ${isHostelOrPG ? styles.cardUpgraded : ""}`}>
      <div className={isHostelOrPG ? styles.sectionTitleLg : styles.sectionTitle}>Similar Properties</div>
      <div className={styles.similarScroll}>
        {similarProps.map((p) => (
          <SimilarCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );

  /* ─── Hostel-only NEW/rebuilt sections ─── */
  const priceBreakdownNode = isHostelOrPG && property.type === "rent" && (
    <PriceBreakdownCard
      rent={displayPrice}
      deposit={displayDeposit}
      electricity={electricityLabel(hm?.electricity)}
      maintenance={availUnit?.maintenance}
      extra={hm?.price_breakdown_extra ?? []}
    />
  );

  const groupedAmenitiesNode = isHostelOrPG && (
    <GroupedAmenitiesCard property={property} hm={hm ?? null} />
  );

  const locationNearbyNode = isHostelOrPG && (
    <LocationNearbyCard places={hm?.nearby_places} coachingHub={coachingHubDisplay} />
  );

  const rulesPolicyNode = isHostelOrPG && (
    <RulesPolicyGrid
      entries={buildRuleEntries(property, hm ?? null, displayDeposit)}
      title={hm?.pg_name || property.ptype}
    />
  );

  const faqNode = isHostelOrPG && <FaqAccordion items={mergeFaqs(faqDefaults, hm?.faqs ?? [])} />;

  const localityGuideNode = isHostelOrPG && <LocalityGuideCard locality={property.locality} />;

  return (
    <div className={styles.page}>
      {/* ── Top nav ── */}
      <div className={styles.topNav}>
        <div className={styles.topNavInner}>
          <Link href="/" className={styles.backBtn} aria-label="Back">←</Link>
          <span className={styles.navLogo}>
            Prop<span style={{ color: "var(--color-primary)" }}>100</span>
          </span>
          <span style={{ fontSize: 13, color: "#7a8fa3", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 4 }}>
            {property.ptype} · {property.loc}
          </span>
        </div>
      </div>

      {/* ── Gallery — full width, above the two-column layout ── */}
      <div className={styles.galleryWrap}>
        {lightboxItems.length > 0 ? (
          <>
            <div className={styles.galleryHeroWrap}>
              {lightboxItems[heroIdx].type === "photo" ? (
                <img
                  className={styles.galleryHero}
                  src={lightboxItems[heroIdx].url}
                  alt={property.title}
                  onClick={() => setLightboxIndex(heroIdx)}
                  style={{ cursor: "zoom-in" }}
                />
              ) : (
                // Video plays inline right here — no tap-in needed to see or
                // start it, matching how photos are already visible outside
                // the lightbox. Tapping the expand hint still opens the
                // full-screen viewer for anyone who wants that.
                <video
                  key={lightboxItems[heroIdx].url}
                  className={styles.galleryHero}
                  src={lightboxItems[heroIdx].url}
                  controls
                  playsInline
                  preload="metadata"
                />
              )}
              {/* Counter */}
              <div className={styles.galleryCounter}>
                {heroIdx + 1} / {lightboxItems.length}
              </div>
              {/* Tap-to-zoom / expand hint */}
              <div
                className={styles.galleryZoomHint}
                aria-hidden="true"
                onClick={() => setLightboxIndex(heroIdx)}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
              >
                {lightboxItems[heroIdx].type === "photo" ? "🔍" : "⛶"}
              </div>
              {/* Nav arrows */}
              {lightboxItems.length > 1 && (
                <>
                  <button
                    className={`${styles.galleryArrow} ${styles.galleryArrowLeft}`}
                    onClick={() => setHeroIdx((i) => (i - 1 + lightboxItems.length) % lightboxItems.length)}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                  <button
                    className={`${styles.galleryArrow} ${styles.galleryArrowRight}`}
                    onClick={() => setHeroIdx((i) => (i + 1) % lightboxItems.length)}
                    aria-label="Next"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {isHostelOrPG && galleryBuckets.length > 1 && (
              <div className={styles.galTabs}>
                <button
                  className={`${styles.galTab} ${activeBucket === "all" ? styles.galTabActive : ""}`}
                  onClick={() => setActiveBucket("all")}
                >
                  All
                </button>
                {galleryBuckets.map((b) => (
                  <button
                    key={b.key}
                    className={`${styles.galTab} ${activeBucket === b.key ? styles.galTabActive : ""}`}
                    onClick={() => setActiveBucket(b.key)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
            {lightboxItems.length > 1 && (
              <div className={styles.thumbStrip}>
                {visibleThumbIndices.map((i) => {
                  const it = lightboxItems[i];
                  return (
                    <div
                      key={i}
                      className={`${styles.thumb} ${i === heroIdx ? styles.thumbActive : ""}`}
                      onClick={() => setHeroIdx(i)}
                    >
                      {it.type === "photo" ? (
                        <img src={it.url} alt="" />
                      ) : (
                        <div className={styles.thumbVideoWrap}>
                          <video src={it.url} muted preload="metadata" />
                          <span className={styles.thumbVideoIcon}>▶</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className={styles.galleryPlaceholder}>
            {PTYPE_ICONS[property.ptype] ?? "🏠"}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          items={lightboxItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Two-column layout ── */}
      <div className={styles.layout}>
        {/* ── Left column ── */}
        <div className={styles.leftCol}>

          {/* §1 Price + Title block */}
          <div className={styles.card}>
            {/* Badge row */}
            <div className={styles.badgeRow}>
              <span className={styles.typeBadge}>{property.type === "rent" ? "For Rent" : "For Sale"}</span>
              {property.is_verified && <span className={`${styles.badge} ${styles.badgeVerified}`}>✓ Verified by Prop100</span>}
              {property.is_featured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>⭐ Featured</span>}
              {property.type === "sale" && <CommissionBadge />}
            </div>
            {/* Price */}
            <div className={styles.priceLine}>
              <span className={styles.priceMain}>
                {property.type === "rent"
                  ? `₹${displayPrice.toLocaleString("en-IN")}`
                  : fmt(displayPrice)}
              </span>
              {property.type === "rent" && <span className={styles.pricePer}>/month</span>}
            </div>
            {property.type === "rent" && displayDeposit && (
              <div className={styles.priceDeposit}>
                Deposit: ₹{displayDeposit.toLocaleString("en-IN")}
              </div>
            )}
            <div className={styles.propTitle}>{capFirst(property.title.split(" | ")[0])}</div>
            <div className={styles.propLoc}>
              📍 {property.loc}, Kota
              {coachingHubDisplay && ` · 🎓 Near ${coachingHubDisplay}`}
            </div>
            {/* Stats row */}
            <div className={styles.statRow}>
              {!showSelector && availUnit?.attributes?.bhk ? (
                <span className={styles.stat}><b>{availUnit.attributes.bhk}</b> BHK</span>
              ) : property.bhk > 0 && !showSelector ? (
                <span className={styles.stat}><b>{property.bhk}</b> BHK</span>
              ) : null}
              {property.baths > 0 && <span className={styles.stat}><b>{property.baths}</b> Bath</span>}
              {property.sqft && property.sqft > 0 && (
                <span className={styles.stat}><b>{property.sqft.toLocaleString("en-IN")}</b> sqft</span>
              )}
              {property.floor_number != null && (
                <span className={styles.stat}>
                  Floor <b>{property.floor_number}</b>
                  {property.total_floors ? `/${property.total_floors}` : ""}
                </span>
              )}
            </div>
          </div>

          {/* §2 Key highlights strip */}
          {highlights.length > 0 && (
            <div className={styles.highlightsWrap}>
              <div className={styles.highlightsStrip}>
                {highlights.map((h) => (
                  <div key={h.label} className={styles.highlightChip}>
                    <span className={styles.highlightIcon}>{h.icon}</span>
                    <span>{h.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* §3 Variant selector — mobile only */}
          {showSelector && (
            <div className={`${styles.card} ${styles.mobileOnly}`}>
              <div className={styles.sectionTitle}>Room Variants</div>
              {renderVariantSelector()}
              {avail && (
                <span className={`${styles.availBadge} ${avail.cls}`} style={{ marginTop: 16 }}>
                  {avail.text}
                </span>
              )}
              {freshDays !== null && (
                <div className={styles.freshness}>
                  {freshDays === 0
                    ? "Availability confirmed today"
                    : `Availability confirmed ${freshDays} day${freshDays !== 1 ? "s" : ""} ago`}
                </div>
              )}
            </div>
          )}

          {/* §3b Availability badge for single-unit — mobile only */}
          {!showSelector && avail && (
            <div className={`${styles.card} ${styles.mobileOnly}`}>
              <span className={`${styles.availBadge} ${avail.cls}`}>{avail.text}</span>
              {freshDays !== null && (
                <div className={styles.freshness} style={{ marginTop: 6 }}>
                  {freshDays === 0
                    ? "Availability confirmed today"
                    : `Availability confirmed ${freshDays} day${freshDays !== 1 ? "s" : ""} ago`}
                </div>
              )}
            </div>
          )}

          {/* §8 Location/distance widget stays hidden site-wide (flag flip,
              see showDistWidget above) — kept, not deleted, for either branch */}
          {showDistWidget && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>Location</div>
              <div className={styles.mapEmbedWrap}>
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${propLat},${propLng}&zoom=15`}
                  width="100%"
                  height="220"
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Property location"
                />
              </div>
              <div className={styles.sectionTitle} style={{ marginTop: 4 }}>Distance from Your Location</div>
              <DistanceWidget lat={propLat!} lng={propLng!} mapsKey={mapsKey} />
            </div>
          )}

          {isHostelOrPG ? (
            /* ── Hostel/PG listing — upgraded, reordered layout ── */
            <>
              {priceBreakdownNode}
              {rentRoomDetailsNode}
              {groupedAmenitiesNode}
              {locationNearbyNode}
              {aboutNode}
              {rulesPolicyNode}
              {dealerNode}
              {reviewsNode}
              {faqNode}
              {localityGuideNode}
              {similarNode}
            </>
          ) : (
            /* ── Every other property type — unchanged order and markup ── */
            <>
              {aboutNode}
              {rentRoomDetailsNode}
              {legacyAmenitiesNode}
              {dealerNode}
              {reviewsNode}
              {similarNode}
            </>
          )}
        </div>

        {/* ── Right column: sticky buy box ── */}
        <div className={styles.rightCol}>
          <div className={`${styles.buyBox} ${isHostelOrPG ? styles.buyBoxHostel : ""}`}>
            {/* Price */}
            <div className={styles.buyPriceLine}>
              <span className={styles.buyPriceMain}>
                {property.type === "rent"
                  ? `₹${displayPrice.toLocaleString("en-IN")}`
                  : fmt(displayPrice)}
              </span>
              {property.type === "rent" && (
                <span className={styles.buyPriceSub}>/month</span>
              )}
            </div>
            {displayDeposit && (
              <div className={styles.buyDeposit}>
                Deposit: ₹{displayDeposit.toLocaleString("en-IN")}
              </div>
            )}

            {/* Variant selector */}
            {showSelector && (
              <>
                <div className={styles.sectionTitle} style={{ marginTop: 16 }}>Room Variants</div>
                {renderVariantSelector()}
              </>
            )}

            {/* Availability */}
            {avail && (
              <span className={`${styles.availBadge} ${avail.cls}`}>
                {avail.text}
              </span>
            )}
            {freshDays !== null && (
              <div className={styles.freshness}>
                {freshDays === 0
                  ? "Confirmed today"
                  : `Confirmed ${freshDays}d ago`}
              </div>
            )}

            {/* CTA — hidden when full. Hover-lift + pulse only on hostel/PG
                listings (the page this redesign covers) — every other
                property type keeps the exact same button unchanged. */}
            {!isFull && (
              <button
                className={`${styles.buyCtaBtn} ${isHostelOrPG ? styles.ctaLift : ""} ${isHostelOrPG ? styles.ctaPulse : ""}`}
                onClick={startConcierge}
              >
                {isHostelOrPG && <Icon name="whatsapp" size={15} />}
                {ctaLabel}
              </button>
            )}

            {/* Trust row + location snippet + disclaimer — grouped so that on
                hostel/PG desktop layouts this whole tail can be pushed down
                to sit flush with the sidebar's bottom edge (buyBoxHostel's
                flex column + this group's margin-top:auto) instead of
                leaving dead space beneath it. Non-hostel gets no extra class
                here, so its layout is unchanged. */}
            <div className={isHostelOrPG ? styles.buyBoxBottomGroup : undefined}>
              {/* Trust row — fills the space below the CTA with real,
                  already-available fields (verified badge + dealer rating)
                  instead of leaving it blank. Hostel/PG only. */}
              {isHostelOrPG && (property.is_verified || dealer) && (
                <div className={styles.sidebarTrustRow}>
                  {property.is_verified && (
                    <span className={styles.sidebarTrustItem}>
                      <Icon name="shield" size={13} /> Verified by Prop100
                    </span>
                  )}
                  {dealer && (
                    <span className={styles.sidebarTrustItem}>
                      <Icon name="star" size={13} /> {dealer.rating} rating · {dealer.years}y exp
                    </span>
                  )}
                </div>
              )}

              {/* Location snippet */}
              <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                📍 {property.loc}, Kota
                {coachingHubDisplay && (
                  <div>🎓 Near {coachingHubDisplay}</div>
                )}
              </div>

              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
                {property.type === "sale"
                  ? "Your details are shared only with this dealer — no spam. Buyer commission: just 0.25% of deal price, only on closing — total 0.75% vs. market's 2% (1%+1%)."
                  : "Your details are shared only with this dealer — no spam, no brokerage fee."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky CTA bar — hidden when full ── */}
      {!isFull && (
        <div className={styles.ctaBar}>
          <div className={styles.ctaBarInner}>
            <div className={styles.ctaPrice}>
              <div className={styles.ctaPriceMain}>{fmt(displayPrice)}</div>
              <div className={styles.ctaPriceSub}>{property.type === "rent" ? "per month" : "sale price"}</div>
            </div>
            <button
              className={`${styles.ctaBtn} ${isHostelOrPG ? styles.ctaLift : ""} ${isHostelOrPG ? styles.ctaPulse : ""}`}
              onClick={startConcierge}
            >
              {isHostelOrPG && <Icon name="whatsapp" size={15} />}
              {ctaLabel}
            </button>
          </div>
        </div>
      )}

      {/* ── Lead gateway sheet ── */}
      <LeadSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        property={property}
        selectedUnit={selectedUnit}
      />
    </div>
  );
}
