"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PropertyFull, PropertyUnit } from "@/lib/types";
import { AREA_COORDS, PTYPE_ICONS } from "@/lib/constants";
import { fmt } from "@/lib/format";
import { CATEGORY_AXES, AXIS_OPTIONS, AXIS_LABELS, AxisKey, chipLabel } from "@/lib/variantConfig";
import {
  HOUSE_RULE_LABELS, SERVICE_LABELS, COMMON_AMENITY_LABELS,
  TENANT_TYPE_LABELS, gateTimeLabel, noticePeriodLabel, photoCaption,
} from "@/lib/hostelLabels";
import Lightbox, { LightboxItem } from "./Lightbox";
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

  useEffect(() => {
    if (open) { setPhase("form"); setError(""); setOtp(""); }
  }, [open]);

  function startCooldown() {
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
    }, 1000);
  }

  // OTP temporarily disabled — submits directly until WhatsApp Business API is approved.
  async function submitForm() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (name.trim().length < 2) { setError("Enter your name (at least 2 characters)"); return; }
    if (cleanPhone.length !== 10) { setError("Enter a valid 10-digit phone number"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/leads", {
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
      }),
    });
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
        onClick={onClose}
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

              <button
                className={styles.submitBtn}
                onClick={submitForm}
                disabled={loading}
              >
                {loading ? "Saving…" : "Get Contact Details →"}
              </button>

              <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                Your details are shared only with this partner — no spam, no brokerage fee.
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
                className={styles.submitBtn}
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
                    <a href={`tel:+91${dealerPhone}`} className={styles.revealPhoneBtn}>
                      📞 +91 {fmtPhone(dealerPhone)}
                    </a>
                    <a
                      href={`https://wa.me/91${dealerPhone}?text=${encodeURIComponent(`Hi, I'm interested in ${property.title}${selectedUnit ? ` — ${selectedUnit.label}` : ""}. My reference: ${ref}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.revealWaBtn}
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

function initSel(
  units: PropertyUnit[],
  axes: AxisKey[],
  params: Record<string, string>
): Record<string, string> {
  if (axes.length === 0 || units.length === 0) return {};

  const fromUrl: Record<string, string> = {};
  for (const ax of axes) {
    if (params[ax]) fromUrl[ax] = params[ax];
  }
  if (Object.keys(fromUrl).length === axes.length) {
    const match = units.find((u) =>
      axes.every((ax) => String(u.attributes?.[ax] ?? "") === fromUrl[ax])
    );
    if (match) return fromUrl;
  }

  const candidates = units.filter((u) => (u.available_count ?? 0) > 0);
  const source = candidates.length > 0 ? candidates : units;
  const best = source.reduce((a, b) =>
    (a.price_per_month ?? 0) <= (b.price_per_month ?? 0) ? a : b
  );
  const result: Record<string, string> = {};
  for (const ax of axes) {
    const v = best.attributes?.[ax];
    if (v !== undefined && v !== null) result[ax] = String(v);
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

function availInfo(count: number): { text: string; cls: string } {
  if (count === 0) return { text: "Full — no vacancy", cls: styles.availFull };
  if (count <= 2) return { text: `⚡ Only ${count} left`, cls: styles.availFew };
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

/* ─── Main component ─────────────────────────────────────────── */
export default function PropertyDetail({
  property,
  mapsKey,
  initialParams = {},
}: {
  property: PropertyFull;
  mapsKey: string;
  initialParams?: Record<string, string>;
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
  const [heroIdx, setHeroIdx] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [similarProps, setSimilarProps] = useState<SimilarProp[]>([]);

  const selectedUnit = resolveUnit(units, sel, axes);

  const displayGallery =
    selectedUnit?.unit_photos?.length ? selectedUnit.unit_photos : gallery;
  const hasGallery = displayGallery.length > 0;

  useEffect(() => { setHeroIdx(0); }, [selectedUnit?.id]);

  // Unified photo + video list for the full-screen lightbox — videos open in
  // the same viewer instead of a separate tab, and photos are captioned from
  // whatever tag/section the owner picked during upload.
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
  const showDistWidget = Boolean(mapsKey && propLat && propLng);

  const openSheet = useCallback(() => { setSheetOpen(true); }, []);

  const displayPrice = selectedUnit
    ? selectedUnit.price_per_month
    : property.type === "rent"
    ? (property.rent_per_month ?? property.price)
    : property.price;

  const displayDeposit = selectedUnit?.deposit_amount ?? property.deposit_amount;

  const availUnit = selectedUnit ?? (units.length === 1 ? units[0] : null);
  const avail = availUnit !== null ? availInfo(availUnit.available_count ?? 0) : null;
  const freshDays = availUnit ? daysSince(availUnit.last_confirmed_at) : null;

  const isFull = (availUnit?.available_count ?? -1) === 0;
  const ctaLabel = selectedUnit
    ? `Get Contact — ${selectedUnit.label}`
    : "Get Partner Contact";

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
  if (property.nearest_coaching_hub) highlights.push({ icon: "🎓", label: `Near ${property.nearest_coaching_hub}` });
  if (property.furnishing_status === "furnished") highlights.push({ icon: "🛋️", label: "Fully Furnished" });
  if (property.furnishing_status === "semi-furnished") highlights.push({ icon: "🛋️", label: "Semi-Furnished" });
  if (property.min_stay_months) highlights.push({ icon: "📅", label: `Min ${property.min_stay_months} Month${property.min_stay_months > 1 ? "s" : ""}` });
  if (property.hostel_meta?.usp_text) highlights.push({ icon: "✨", label: property.hostel_meta.usp_text });

  const isHostelOrPG = ["Hostel", "PG", "hostel", "pg"].includes(property.ptype);
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
        {hasGallery ? (
          <>
            <div className={styles.galleryHeroWrap}>
              <img
                className={styles.galleryHero}
                src={displayGallery[heroIdx]}
                alt={property.title}
                onClick={() => setLightboxIndex(heroIdx)}
                style={{ cursor: "zoom-in" }}
              />
              {/* Counter */}
              <div className={styles.galleryCounter}>
                {heroIdx + 1} / {displayGallery.length}
              </div>
              {/* Tap-to-zoom hint */}
              <div className={styles.galleryZoomHint} aria-hidden="true">🔍</div>
              {/* Nav arrows */}
              {displayGallery.length > 1 && (
                <>
                  <button
                    className={`${styles.galleryArrow} ${styles.galleryArrowLeft}`}
                    onClick={() => setHeroIdx((i) => (i - 1 + displayGallery.length) % displayGallery.length)}
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>
                  <button
                    className={`${styles.galleryArrow} ${styles.galleryArrowRight}`}
                    onClick={() => setHeroIdx((i) => (i + 1) % displayGallery.length)}
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {displayGallery.length > 1 && (
              <div className={styles.thumbStrip}>
                {displayGallery.map((src, i) => (
                  <div
                    key={i}
                    className={`${styles.thumb} ${i === heroIdx ? styles.thumbActive : ""}`}
                    onClick={() => setHeroIdx(i)}
                  >
                    <img src={src} alt="" />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className={styles.galleryPlaceholder}>
            {PTYPE_ICONS[property.ptype] ?? "🏠"}
          </div>
        )}

        {/* Videos — open in the same full-screen viewer as photos */}
        {videos.length > 0 && (
          <div className={styles.videoLinks}>
            {videos.map((url, i) => (
              <button
                key={i}
                className={styles.videoLink}
                onClick={() => setLightboxIndex(displayGallery.length + i)}
              >
                🎬 Video tour {videos.length > 1 ? i + 1 : ""}
              </button>
            ))}
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
              {property.is_verified && <span className={`${styles.badge} ${styles.badgeVerified}`}>✓ Verified</span>}
              {property.is_featured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>⭐ Featured</span>}
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
            <div className={styles.propTitle}>{property.title}</div>
            <div className={styles.propLoc}>
              📍 {property.loc}, Kota
              {property.nearest_coaching_hub && ` · 🎓 Near ${property.nearest_coaching_hub}`}
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

          {/* §4 About / Description */}
          {property.description && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>About This Property</div>
              <div
                className={`${styles.descText} ${descExpanded ? styles.descExpanded : styles.descClamped}`}
              >
                {property.description}
              </div>
              {property.description.length > 200 && (
                <button
                  className={styles.readMoreBtn}
                  onClick={() => setDescExpanded((v) => !v)}
                >
                  {descExpanded ? "Show less ↑" : "Read more ↓"}
                </button>
              )}
            </div>
          )}

          {/* §5 Room & Rent Details */}
          {property.type === "rent" && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>Rent & Room Details</div>
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
                {property.nearest_coaching_hub && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>🎓 Nearest Coaching</span>
                    <span className={styles.detailValue}>{property.nearest_coaching_hub}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* §6 Amenities grid */}
          {(() => {
            const base = [
              { icon: "🍽️", label: "Meals Included", val: property.meals_included },
              { icon: "📶", label: "WiFi Included", val: property.wifi_included },
              { icon: "🚗", label: "Parking", val: property.parking_available },
              { icon: "🚿", label: "Attached Bath", val: property.attached_bathroom },
            ].filter((a) => a.val);
            // Common-area amenities from the hostel wizard (kitchen, RO, lift, gym, etc.)
            // De-duplicated against the base list (wifi already covered above).
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
          })()}

          {/* §7 Hostel rules — only for hostel/PG */}
          {isHostelOrPG && (
            <div className={styles.hostelRulesCard}>
              <div className={styles.hostelRulesTitle}>🏠 {hm?.pg_name || property.ptype} Rules &amp; Policy</div>
              <div className={styles.hostelRulesList}>
                {property.gender_preference && property.gender_preference !== "any" && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>
                      {property.gender_preference === "boys" ? "👦" : "👧"}
                    </span>
                    <span>
                      {property.gender_preference === "boys" ? "Boys only hostel" : "Girls only hostel"}
                    </span>
                  </div>
                )}
                {property.meals_included && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>🍽️</span>
                    <span>Meals provided (check timing with partner)</span>
                  </div>
                )}
                {property.min_stay_months && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>📅</span>
                    <span>Minimum stay: {property.min_stay_months} month{property.min_stay_months > 1 ? "s" : ""}</span>
                  </div>
                )}
                {displayDeposit && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>💰</span>
                    <span>Security deposit: ₹{displayDeposit.toLocaleString("en-IN")} (refundable)</span>
                  </div>
                )}

                {/* Rich fields from the PG/Hostel wizard, when present */}
                {hm?.tenant_types && hm.tenant_types.length > 0 && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>🎓</span>
                    <span>For: {hm.tenant_types.map((t) => TENANT_TYPE_LABELS[t] ?? t).join(" & ")}</span>
                  </div>
                )}
                {hm?.gate_timing_enabled && hm.gate_closing_time && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>🚪</span>
                    <span>Gate closes at {gateTimeLabel(hm.gate_closing_time)}</span>
                  </div>
                )}
                {hm?.notice_period && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>📝</span>
                    <span>Notice period: {noticePeriodLabel(hm.notice_period)}</span>
                  </div>
                )}
                {hm?.services && hm.services.length > 0 && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>🧺</span>
                    <span>
                      Services: {hm.services.map((s) => SERVICE_LABELS[s]?.label ?? s).join(", ")}
                    </span>
                  </div>
                )}
                {hm?.house_rules && hm.house_rules.length > 0 && hm.house_rules.map((r) => (
                  <div key={r} className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>🚫</span>
                    <span>{HOUSE_RULE_LABELS[r] ?? r}</span>
                  </div>
                ))}
                {hm?.landmark && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>📍</span>
                    <span>Landmark: {hm.landmark}</span>
                  </div>
                )}

                {!hm && (
                  <div className={styles.hostelRule}>
                    <span className={styles.hostelRuleIcon}>ℹ️</span>
                    <span>Contact partner to confirm entry timing, visitor policy &amp; food menu</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* §8 Location + distance — map is embedded here only, no outbound
              "open in Google Maps" link, so a student can't jump straight to
              directions/contact off-platform before going through the lead gate */}
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

          {/* §9 Dealer card */}
          {dealer && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>Listed By</div>
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
                  <button className={styles.dealerCtaBtn} onClick={openSheet}>
                    Contact
                  </button>
                )}
              </div>
            </div>
          )}

          {/* §10 Reviews placeholder */}
          <div className={styles.card}>
            <div className={styles.sectionTitle}>Tenant Reviews</div>
            <div className={styles.reviewsPlaceholder}>
              <div className={styles.reviewStars}>★★★★★</div>
              <div className={styles.reviewMsg}>No reviews yet for this property.</div>
              <div className={styles.reviewSub}>
                Reviews from verified tenants will appear here.
              </div>
            </div>
          </div>

          {/* §11 Similar properties */}
          {similarProps.length > 0 && (
            <div className={styles.card}>
              <div className={styles.sectionTitle}>Similar Properties</div>
              <div className={styles.similarScroll}>
                {similarProps.map((p) => (
                  <SimilarCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: sticky buy box ── */}
        <div className={styles.rightCol}>
          <div className={styles.buyBox}>
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

            {/* CTA — hidden when full */}
            {!isFull && (
              <button className={styles.buyCtaBtn} onClick={openSheet}>
                {ctaLabel}
              </button>
            )}

            {/* Location snippet */}
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              📍 {property.loc}, Kota
              {property.nearest_coaching_hub && (
                <div>🎓 Near {property.nearest_coaching_hub}</div>
              )}
            </div>

            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
              Your details are shared only with this dealer — no spam, no brokerage fee.
            </p>
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
            <button className={styles.ctaBtn} onClick={openSheet}>
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
