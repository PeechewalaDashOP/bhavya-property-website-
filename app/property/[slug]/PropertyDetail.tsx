"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PropertyFull, PropertyUnit } from "@/lib/types";
import { AREA_COORDS, PTYPE_ICONS } from "@/lib/constants";
import { fmt } from "@/lib/format";
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

  // Reset to form when sheet opens
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
  // To revert: restore this function to call /api/otp/send and setPhase("otp").
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

          {/* Form phase */}
          {phase === "form" && (
            <>
              <div className={styles.sheetTitle}>Get Dealer Contact</div>
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
                Your details are shared only with this dealer — no spam, no brokerage fee.
              </p>
            </>
          )}

          {/* OTP phase */}
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

          {/* Reveal phase */}
          {phase === "done" && (
            <>
              <div className={styles.sheetTitle}>Contact Dealer</div>
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
                      💬 WhatsApp the Dealer
                    </a>
                  </>
                ) : (
                  <p style={{ color: "var(--muted)", fontSize: 14 }}>
                    Dealer will contact you shortly on +91 {phone.replace(/\D/g, "")}.
                  </p>
                )}
              </div>
              {ref && (
                <p className={styles.revealNote}>
                  Show reference <b>{ref}</b> to the dealer when you visit the property.
                  Your lead has been saved and the dealer has been notified on WhatsApp.
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

/* ─── Main component ─────────────────────────────────────────── */
export default function PropertyDetail({
  property,
  mapsKey,
}: {
  property: PropertyFull;
  mapsKey: string;
}) {
  const [heroIdx, setHeroIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<PropertyUnit | null>(null);

  const gallery = property.gallery?.length ? property.gallery : property.img ? [property.img] : [];
  const hasGallery = gallery.length > 0;
  const videos = property.videos ?? [];
  const units = property.property_units ?? [];
  const dealer = property.dealers;

  // Effective lat/lng: use property coords if set, else area fallback
  const propLat = property.lat ?? AREA_COORDS[property.loc]?.lat ?? null;
  const propLng = property.lng ?? AREA_COORDS[property.loc]?.lng ?? null;
  const showDistWidget = Boolean(mapsKey && propLat && propLng);

  const displayPrice = property.type === "rent"
    ? `${fmt(property.rent_per_month ?? property.price)}/month`
    : fmt(property.price);

  const openSheet = useCallback((unit?: PropertyUnit) => {
    setSelectedUnit(unit ?? null);
    setSheetOpen(true);
  }, []);

  const amenities = [
    property.parking_available && { icon: "🚗", label: "Parking" },
    property.wifi_included && { icon: "📶", label: "WiFi" },
    property.attached_bathroom && { icon: "🚿", label: "Attached Bath" },
    property.meals_included && { icon: "🍽️", label: "Meals Included" },
    property.furnishing_status === "furnished" && { icon: "🛋️", label: "Furnished" },
    property.furnishing_status === "semi-furnished" && { icon: "🛋️", label: "Semi-Furnished" },
  ].filter(Boolean) as { icon: string; label: string }[];

  function fmtDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
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
          <span style={{ fontSize: 13, color: "#7a8fa3", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginLeft: 4 }}>
            {property.ptype} · {property.loc}
          </span>
        </div>
      </div>

      {/* Gallery */}
      {hasGallery ? (
        <>
          <img
            className={styles.galleryHero}
            src={gallery[heroIdx]}
            alt={property.title}
          />
          {gallery.length > 1 && (
            <div className={styles.thumbStrip}>
              {gallery.map((src, i) => (
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

      {/* Video links */}
      {videos.length > 0 && (
        <div className={styles.videoLinks}>
          {videos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className={styles.videoLink}>
              🎬 Video tour {videos.length > 1 ? i + 1 : ""}
            </a>
          ))}
        </div>
      )}

      {/* Header card */}
      <div className={styles.card}>
        <div className={styles.priceLine}>
          <span className={styles.priceMain}>{fmt(property.rent_per_month ?? property.price)}</span>
          {property.type === "rent" && <span className={styles.pricePer}>/month</span>}
          <span className={styles.typeBadge}>{property.type === "rent" ? "For Rent" : "For Sale"}</span>
        </div>
        {property.type === "rent" && property.deposit_amount && (
          <div className={styles.priceDeposit}>
            Deposit: ₹{property.deposit_amount.toLocaleString("en-IN")}
          </div>
        )}
        <div className={styles.propTitle}>{property.title}</div>
        <div className={styles.propLoc}>
          📍 {property.loc}, Kota
          {property.nearest_coaching_hub && ` · 🎓 Near ${property.nearest_coaching_hub}`}
        </div>
        <div className={styles.statRow}>
          {property.bhk > 0 && <span className={styles.stat}><b>{property.bhk}</b> BHK</span>}
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
        <div>
          {property.is_verified && <span className={`${styles.badge} ${styles.badgeVerified}`}>✓ Verified</span>}
          {property.is_featured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>⭐ Featured</span>}
        </div>
      </div>

      {/* Units section */}
      {units.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>
            Room / Unit Types — tap to enquire about a specific type
          </div>
          <div className={styles.unitsScroll}>
            {units.map((u) => (
              <div
                key={u.id}
                className={`${styles.unitCard} ${selectedUnit?.id === u.id ? styles.unitCardSelected : ""}`}
                onClick={() => setSelectedUnit((prev) => prev?.id === u.id ? null : u)}
              >
                <div className={styles.unitLabel}>{u.label}</div>
                <div className={styles.unitPrice}>₹{u.price_per_month.toLocaleString("en-IN")}/mo</div>
                <div className={styles.unitMeta}>
                  {u.capacity > 1 ? `${u.capacity} persons · ` : ""}
                  {u.has_ac ? "AC" : u.has_cooler ? "Cooler" : "No cooling"}
                  {u.attached_bath ? " · Attached bath" : ""}
                  {u.meals_included ? " · Meals incl." : ""}
                  {u.deposit_amount ? `\nDeposit ₹${u.deposit_amount.toLocaleString("en-IN")}` : ""}
                </div>
                <span className={`${styles.unitBadge} ${u.available_count === 0 ? styles.unitBadgeFull : ""}`}>
                  {u.available_count === 0
                    ? "Full — no vacancy"
                    : `${u.available_count} of ${u.total_count} available`}
                </span>
              </div>
            ))}
          </div>
          {selectedUnit && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(15,118,110,0.05)", borderRadius: 10, border: "1px solid rgba(15,118,110,0.15)", fontSize: 13, color: "var(--ink)" }}>
              Selected: <b>{selectedUnit.label}</b> — tap &ldquo;Get Dealer Contact&rdquo; below to enquire about this room type.
            </div>
          )}
        </div>
      )}

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Amenities</div>
          <div className={styles.amenityGrid}>
            {amenities.map((a) => (
              <div key={a.label} className={styles.amenity}>
                <span className={styles.amenityIcon}>{a.icon}</span>
                {a.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {property.features?.length > 0 && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Features</div>
          <div className={styles.chips}>
            {property.features.map((f) => (
              <span key={f} className={styles.chip}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {property.description && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>About This Property</div>
          <p style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {property.description}
          </p>
        </div>
      )}

      {/* Rental details */}
      {property.type === "rent" && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Rental Details</div>
          <div className={styles.detailList}>
            {property.available_from && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Available From</span>
                <span className={styles.detailValue}>{fmtDate(property.available_from)}</span>
              </div>
            )}
            {property.min_stay_months && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Minimum Stay</span>
                <span className={styles.detailValue}>{property.min_stay_months} month{property.min_stay_months > 1 ? "s" : ""}</span>
              </div>
            )}
            {property.gender_preference && property.gender_preference !== "any" && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Gender Preference</span>
                <span className={styles.detailValue} style={{ textTransform: "capitalize" }}>{property.gender_preference}</span>
              </div>
            )}
            {property.furnishing_status && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Furnishing</span>
                <span className={styles.detailValue} style={{ textTransform: "capitalize" }}>{property.furnishing_status.replace("-", " ")}</span>
              </div>
            )}
            {property.nearest_coaching_hub && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Nearest Coaching</span>
                <span className={styles.detailValue}>{property.nearest_coaching_hub}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Distance calculator */}
      {showDistWidget && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Distance from Your Location</div>
          <DistanceWidget lat={propLat!} lng={propLng!} mapsKey={mapsKey} />
        </div>
      )}

      {/* Dealer info */}
      {dealer && (
        <div className={styles.card}>
          <div className={styles.sectionTitle}>Listed By</div>
          <div className={styles.dealerRow}>
            <div className={styles.dealerAvatar}>{dealer.name[0]}</div>
            <div>
              <div className={styles.dealerName}>{dealer.name}</div>
              <div className={styles.dealerRole}>{dealer.role}</div>
              <div className={styles.dealerStats}>
                <span><b>{dealer.years}</b> yrs exp</span>
                <span><b>⭐{dealer.rating}</b> rating</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky CTA */}
      <div className={styles.ctaBar}>
        <div className={styles.ctaBarInner}>
          <div className={styles.ctaPrice}>
            <div className={styles.ctaPriceMain}>{fmt(property.rent_per_month ?? property.price)}</div>
            <div className={styles.ctaPriceSub}>{property.type === "rent" ? "per month" : "sale price"}</div>
          </div>
          <button className={styles.ctaBtn} onClick={() => openSheet(selectedUnit ?? undefined)}>
            {selectedUnit ? `Enquire — ${selectedUnit.label}` : "Get Dealer Contact"}
          </button>
        </div>
      </div>

      {/* Lead gateway sheet */}
      <LeadSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        property={property}
        selectedUnit={selectedUnit}
      />
    </div>
  );
}
