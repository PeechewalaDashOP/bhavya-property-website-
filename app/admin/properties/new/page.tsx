"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { KOTA_AREAS, COACHING_HUBS, FEATURES_LIST, TENANT_PREFERENCES } from "@/lib/constants";
import { compressImages } from "@/lib/imageCompress";
import { compressVideos, validateVideoSize } from "@/lib/videoCompress";
import { uploadFileWithRetry } from "@/lib/upload";

type Purpose = "rent" | "sale" | "pg";

const RENT_PTYPES = ["Room", "Flat", "House", "Shop", "Office", "Showroom", "Warehouse-Godown"];
const SALE_PTYPES = ["Flat", "House", "Shop", "Plot", "Office", "Showroom", "Warehouse-Godown"];

function needsBhk(ptype: string) {
  return !["Shop", "Plot", "Office", "Showroom", "Warehouse-Godown"].includes(ptype);
}
function needsFloor(ptype: string) {
  return ptype !== "Plot";
}

type UnitRow = {
  id: string;
  label: string;
  capacity: string;
  price_per_month: string;
  deposit_amount: string;
  total_count: string;
  available_count: string;
  has_ac: boolean;
  has_cooler: boolean;
  attached_bath: boolean;
  meals_included: boolean;
  description: string;
};

function emptyUnit(): UnitRow {
  return {
    id: Math.random().toString(36).slice(2, 9),
    label: "", capacity: "1", price_per_month: "", deposit_amount: "",
    total_count: "1", available_count: "1",
    has_ac: false, has_cooler: false, attached_bath: false, meals_included: false,
    description: "",
  };
}

const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 4, display: "block" };
const inputStyle: React.CSSProperties = {
  width: "100%", border: "1.5px solid var(--line)", borderRadius: 8, padding: "9px 11px",
  fontSize: 13.5, background: "var(--surface)", color: "var(--ink)", boxSizing: "border-box",
};
const sectionStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 18, marginBottom: 14,
};
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 14 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 };

export default function AdminNewPropertyPage() {
  const router = useRouter();

  // Owner (cold-call contact — already verified by phone, no OTP needed)
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerWhatsapp, setOwnerWhatsapp] = useState(true);

  // Core
  const [purpose, setPurpose] = useState<Purpose>("pg");
  const [ptype, setPtype] = useState("Hostel");
  const [loc, setLoc] = useState("");
  const [bhk, setBhk] = useState("1");
  const [baths, setBaths] = useState("1");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [sqft, setSqft] = useState("");
  const [furnishing, setFurnishing] = useState("");
  const [floorNum, setFloorNum] = useState("");
  const [totalFloors, setTotalFloors] = useState("");
  const [parking, setParking] = useState(false);
  const [wifi, setWifi] = useState(false);
  const [attachedBath, setAttachedBath] = useState(false);
  const [coachingHub, setCoachingHub] = useState("");
  const [availFrom, setAvailFrom] = useState("");
  const [minStay, setMinStay] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [tenantPreference, setTenantPreference] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsMsg, setGpsMsg] = useState("");

  // PG/Hostel-only
  const [pgName, setPgName] = useState("");
  const [genderPreference, setGenderPreference] = useState("");
  const [mealsIncluded, setMealsIncluded] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>([emptyUnit()]);

  // Media
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [videoErr, setVideoErr] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: number; slug: string; title: string } | null>(null);

  const ptypeOptions = purpose === "pg" ? ["Hostel", "PG"] : purpose === "rent" ? RENT_PTYPES : SALE_PTYPES;

  function setPurposeAndDefaultPtype(p: Purpose) {
    setPurpose(p);
    setPtype(p === "pg" ? "Hostel" : p === "rent" ? "Room" : "Flat");
  }

  function toggleFeature(f: string) {
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }
  function toggleTenantPref(t: string) {
    setTenantPreference((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function updateUnit(id: string, patch: Partial<UnitRow>) {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }
  function addUnit() {
    setUnits((prev) => [...prev, emptyUnit()]);
  }
  function removeUnit(id: string) {
    setUnits((prev) => (prev.length > 1 ? prev.filter((u) => u.id !== id) : prev));
  }

  function useGps() {
    if (!navigator.geolocation) { setGpsMsg("GPS not available on this device."); return; }
    setGpsMsg("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsMsg(`Captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => setGpsMsg("Couldn't get location — you can skip this."),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function onVideoFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    for (const f of arr) {
      const msg = validateVideoSize(f);
      if (msg) { setVideoErr(msg); return; }
    }
    setVideoErr("");
    setVideos((prev) => [...prev, ...arr]);
  }

  function reset() {
    setOwnerName(""); setOwnerPhone(""); setOwnerWhatsapp(true);
    setPurposeAndDefaultPtype("pg");
    setLoc(""); setBhk("1"); setBaths("1"); setPrice(""); setDeposit(""); setSqft("");
    setFurnishing(""); setFloorNum(""); setTotalFloors(""); setParking(false); setWifi(false);
    setAttachedBath(false); setCoachingHub(""); setAvailFrom(""); setMinStay("");
    setFeatures([]); setTenantPreference([]); setDescription(""); setLat(null); setLng(null); setGpsMsg("");
    setPgName(""); setGenderPreference(""); setMealsIncluded(false); setUnits([emptyUnit()]);
    setPhotos([]); setVideos([]); setVideoErr(""); setDone(null); setErr("");
  }

  async function submit() {
    setErr("");
    if (!supabase) return;
    if (ownerName.trim().length < 2) { setErr("Owner name is required."); return; }
    if (ownerPhone.replace(/\D/g, "").length !== 10) { setErr("Owner phone must be 10 digits."); return; }
    if (!loc) { setErr("Pick a locality."); return; }
    const validUnits = units.filter((u) => u.label && Number(u.price_per_month) > 0);
    if (purpose === "pg" && validUnits.length === 0) {
      setErr("Add at least one room type with a price for PG/Hostel listings.");
      return;
    }
    if (purpose !== "pg" && (!price || Number(price) <= 0)) { setErr("Enter a price / rent."); return; }

    // PG/Hostel has no single price — the listing card shows the cheapest
    // room type's rate, same convention as the dealer wizard (HostelFlow.tsx).
    const cheapestUnit = purpose === "pg"
      ? [...validUnits].sort((a, b) => Number(a.price_per_month) - Number(b.price_per_month))[0]
      : null;
    const effectivePrice = purpose === "pg" ? Number(cheapestUnit?.price_per_month) || 0 : Number(price);
    const effectiveDeposit = purpose === "pg" ? (cheapestUnit?.deposit_amount ? Number(cheapestUnit.deposit_amount) : null) : (deposit ? Number(deposit) : null);

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/admin/login"); return; }
      const authHeader = { Authorization: `Bearer ${session.access_token}` };

      let photoPaths: string[] = [];
      let videoPaths: string[] = [];

      if (photos.length > 0 || videos.length > 0) {
        setUploadMsg("Compressing media…");
        const [compPhotos, compVideos] = await Promise.all([compressImages(photos), compressVideos(videos)]);

        const allFiles = [
          ...compPhotos.map((f) => ({ name: f.name, type: f.type, category: "photo" as const })),
          ...compVideos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
        ];

        setUploadMsg("Preparing upload…");
        const prepRes = await fetch("/api/admin/property/prepare-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ files: allFiles }),
        });
        if (!prepRes.ok) {
          const d = await prepRes.json().catch(() => ({}));
          throw new Error(d.error ?? "Could not prepare upload.");
        }
        const prep = await prepRes.json();
        const uploadUrls: { signedUrl: string; publicUrl: string }[] = prep.files;
        const allFileObjs = [...compPhotos, ...compVideos];

        const refreshSignedUrl = async (meta: (typeof allFiles)[number]) => {
          const r = await fetch("/api/admin/property/prepare-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ files: [meta] }),
          });
          if (!r.ok) throw new Error("Could not retry upload — please try again.");
          const d = await r.json();
          return d.files[0].signedUrl as string;
        };

        for (let i = 0; i < uploadUrls.length; i++) {
          const { signedUrl, publicUrl } = uploadUrls[i];
          const isPhoto = i < compPhotos.length;
          const num = isPhoto ? i + 1 : i - compPhotos.length + 1;
          setUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${num}…`);
          await uploadFileWithRetry(signedUrl, allFileObjs[i], () => {}, () => refreshSignedUrl(allFiles[i]));
          if (isPhoto) photoPaths.push(publicUrl);
          else videoPaths.push(publicUrl);
        }
        photoPaths = photoPaths.filter(Boolean);
        videoPaths = videoPaths.filter(Boolean);
      }

      setUploadMsg("Publishing listing…");

      const isPg = purpose === "pg";
      const body = {
        type: purpose === "sale" ? "sale" : "rent",
        ptype,
        loc,
        bhk: needsBhk(ptype) && !isPg ? Number(bhk) || 0 : 0,
        baths: needsBhk(ptype) && !isPg ? Number(baths) || 0 : 0,
        price: effectivePrice,
        rent_per_month: purpose === "sale" ? null : effectivePrice,
        deposit_amount: effectiveDeposit,
        sqft: sqft ? Number(sqft) : null,
        furnishing_status: furnishing || null,
        meals_included: isPg ? mealsIncluded : false,
        gender_preference: isPg ? (genderPreference || null) : null,
        available_from: availFrom || null,
        min_stay_months: minStay ? Number(minStay) : null,
        floor_number: needsFloor(ptype) && floorNum ? Number(floorNum) : null,
        total_floors: needsFloor(ptype) && totalFloors ? Number(totalFloors) : null,
        attached_bathroom: attachedBath,
        parking_available: parking,
        wifi_included: wifi,
        nearest_coaching_hub: coachingHub || null,
        features,
        tenant_preference: purpose === "rent" ? tenantPreference : [],
        description,
        photoPaths,
        videoPaths,
        units: isPg
          ? units
              .filter((u) => u.label && Number(u.price_per_month) > 0)
              .map((u, i) => ({
                label: u.label,
                capacity: Number(u.capacity) || 1,
                price_per_month: Number(u.price_per_month),
                deposit_amount: u.deposit_amount ? Number(u.deposit_amount) : null,
                total_count: Number(u.total_count) || 1,
                available_count: Math.min(Number(u.available_count) || 1, Number(u.total_count) || 1),
                has_ac: u.has_ac,
                has_cooler: u.has_cooler,
                attached_bath: u.attached_bath,
                meals_included: u.meals_included,
                description: u.description || null,
                sort_order: i,
              }))
          : [],
        hostel_meta: isPg ? { pg_name: pgName || undefined, target_gender: genderPreference === "boys" ? "male" : genderPreference === "girls" ? "female" : "both", food_provided: mealsIncluded } : undefined,
        lat, lng,
        owner: { name: ownerName.trim(), phone: ownerPhone.replace(/\D/g, ""), whatsapp: ownerWhatsapp },
      };

      const res = await fetch("/api/admin/property", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to publish listing.");

      setDone({ id: data.id, slug: data.slug, title: `${ptype} in ${loc}` });
      setUploadMsg("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setUploadMsg("");
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: "60px auto", textAlign: "center", ...sectionStyle }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Listing published & live</div>
        <div style={{ color: "var(--muted)", marginBottom: 20 }}>{done.title}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/property/${done.slug}`} target="_blank" rel="noreferrer" style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(15,118,110,0.08)", color: "var(--color-primary)", fontWeight: 700, fontSize: 13.5, textDecoration: "none", border: "1.5px solid var(--color-primary)" }}>
            View public listing →
          </a>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 10, background: "var(--ok, #16a06a)", color: "#fff", fontWeight: 700, fontSize: 13.5, border: "none", cursor: "pointer" }}>
            + Add another
          </button>
          <button onClick={() => router.push("/admin/properties")} style={{ padding: "10px 18px", borderRadius: 10, background: "var(--surface)", color: "var(--muted)", fontWeight: 700, fontSize: 13.5, border: "1.5px solid var(--line)", cursor: "pointer" }}>
            Back to Properties
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Add Listing</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            Enter details from a cold-call directly — goes live immediately, no owner OTP needed.
          </p>
        </div>
        <button onClick={() => router.push("/admin/properties")} style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
          ← Back
        </button>
      </div>

      {/* Owner */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Owner contact (already verified on the call)</div>
        <div style={grid}>
          <label>
            <span style={labelStyle}>Owner name *</span>
            <input style={inputStyle} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Ramesh Sharma" />
          </label>
          <label>
            <span style={labelStyle}>Phone (10 digits) *</span>
            <input style={inputStyle} value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98XXXXXXXX" inputMode="numeric" />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
            <input type="checkbox" checked={ownerWhatsapp} onChange={(e) => setOwnerWhatsapp(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Same number on WhatsApp</span>
          </label>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
          If this number is already in our system, the listing attaches to that owner automatically. Leads route to this number — the owner can later log in via OTP with the same number to manage it themselves.
        </p>
      </div>

      {/* Purpose + type + location */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>What are we listing?</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["pg", "PG / Hostel"], ["rent", "For Rent"], ["sale", "For Sale"]] as [Purpose, string][]).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPurposeAndDefaultPtype(p)}
              style={{
                flex: 1, padding: "10px 8px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: purpose === p ? "1.5px solid var(--color-primary)" : "1.5px solid var(--line)",
                background: purpose === p ? "rgba(15,118,110,0.08)" : "var(--surface)",
                color: purpose === p ? "var(--color-primary)" : "var(--ink)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={grid}>
          <label>
            <span style={labelStyle}>Property type *</span>
            <select style={inputStyle} value={ptype} onChange={(e) => setPtype(e.target.value)}>
              {ptypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span style={labelStyle}>Locality *</span>
            <select style={inputStyle} value={loc} onChange={(e) => setLoc(e.target.value)}>
              <option value="">Select…</option>
              {KOTA_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          {purpose === "pg" && (
            <label>
              <span style={labelStyle}>PG / Hostel name</span>
              <input style={inputStyle} value={pgName} onChange={(e) => setPgName(e.target.value)} placeholder="e.g. Shree Balaji Boys Hostel" />
            </label>
          )}
          {needsBhk(ptype) && purpose !== "pg" && (
            <>
              <label>
                <span style={labelStyle}>BHK</span>
                <input type="number" min={0} style={inputStyle} value={bhk} onChange={(e) => setBhk(e.target.value)} />
              </label>
              <label>
                <span style={labelStyle}>Bathrooms</span>
                <input type="number" min={0} style={inputStyle} value={baths} onChange={(e) => setBaths(e.target.value)} />
              </label>
            </>
          )}
        </div>
      </div>

      {/* PG-only: gender + room types */}
      {purpose === "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Room types</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
            <label>
              <span style={labelStyle}>For</span>
              <select style={inputStyle} value={genderPreference} onChange={(e) => setGenderPreference(e.target.value)}>
                <option value="">Any</option>
                <option value="boys">Boys</option>
                <option value="girls">Girls</option>
                <option value="any">Co-ed / Any</option>
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
              <input type="checkbox" checked={mealsIncluded} onChange={(e) => setMealsIncluded(e.target.checked)} />
              <span style={{ fontSize: 13 }}>Meals included</span>
            </label>
          </div>

          {units.map((u, i) => (
            <div key={u.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 10, background: "var(--bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>Room type {i + 1}</span>
                {units.length > 1 && (
                  <span onClick={() => removeUnit(u.id)} style={{ fontSize: 12, color: "var(--color-danger)", cursor: "pointer", fontWeight: 700 }}>Remove</span>
                )}
              </div>
              <div style={grid}>
                <label>
                  <span style={labelStyle}>Label *</span>
                  <input style={inputStyle} value={u.label} onChange={(e) => updateUnit(u.id, { label: e.target.value })} placeholder="e.g. Single AC" />
                </label>
                <label>
                  <span style={labelStyle}>Price/month (₹) *</span>
                  <input type="number" style={inputStyle} value={u.price_per_month} onChange={(e) => updateUnit(u.id, { price_per_month: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Deposit (₹)</span>
                  <input type="number" style={inputStyle} value={u.deposit_amount} onChange={(e) => updateUnit(u.id, { deposit_amount: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Capacity</span>
                  <input type="number" min={1} style={inputStyle} value={u.capacity} onChange={(e) => updateUnit(u.id, { capacity: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Total beds</span>
                  <input type="number" min={1} style={inputStyle} value={u.total_count} onChange={(e) => updateUnit(u.id, { total_count: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Available now</span>
                  <input type="number" min={0} style={inputStyle} value={u.available_count} onChange={(e) => updateUnit(u.id, { available_count: e.target.value })} />
                </label>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 12.5 }}>
                {([["has_ac", "AC"], ["has_cooler", "Cooler"], ["attached_bath", "Attached bath"], ["meals_included", "Meals"]] as const).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={u[key]} onChange={(e) => updateUnit(u.id, { [key]: e.target.checked } as Partial<UnitRow>)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={addUnit} style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", background: "rgba(15,118,110,0.08)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
            + Add another room type
          </button>
        </div>
      )}

      {/* Pricing (non-PG — PG pricing lives in room types above) */}
      {purpose !== "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Pricing</div>
          <div style={grid}>
            <label>
              <span style={labelStyle}>{purpose === "sale" ? "Price (₹) *" : "Rent per month (₹) *"}</span>
              <input type="number" style={inputStyle} value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label>
              <span style={labelStyle}>Deposit (₹)</span>
              <input type="number" style={inputStyle} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </label>
            <label>
              <span style={labelStyle}>Sqft</span>
              <input type="number" style={inputStyle} value={sqft} onChange={(e) => setSqft(e.target.value)} />
            </label>
          </div>
        </div>
      )}

      {/* Property details */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Details</div>
        <div style={grid}>
          <label>
            <span style={labelStyle}>Furnishing</span>
            <select style={inputStyle} value={furnishing} onChange={(e) => setFurnishing(e.target.value)}>
              <option value="">—</option>
              <option value="furnished">Furnished</option>
              <option value="semi-furnished">Semi-furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
          </label>
          {needsFloor(ptype) && (
            <>
              <label>
                <span style={labelStyle}>Floor</span>
                <input type="number" style={inputStyle} value={floorNum} onChange={(e) => setFloorNum(e.target.value)} />
              </label>
              <label>
                <span style={labelStyle}>Total floors</span>
                <input type="number" style={inputStyle} value={totalFloors} onChange={(e) => setTotalFloors(e.target.value)} />
              </label>
            </>
          )}
          <label>
            <span style={labelStyle}>Nearest coaching hub</span>
            <select style={inputStyle} value={coachingHub} onChange={(e) => setCoachingHub(e.target.value)}>
              <option value="">—</option>
              {COACHING_HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>
          <label>
            <span style={labelStyle}>Available from</span>
            <input type="date" style={inputStyle} value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} />
          </label>
          <label>
            <span style={labelStyle}>Min stay (months)</span>
            <input type="number" style={inputStyle} value={minStay} onChange={(e) => setMinStay(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={parking} onChange={(e) => setParking(e.target.checked)} /> Parking
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={wifi} onChange={(e) => setWifi(e.target.checked)} /> WiFi
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={attachedBath} onChange={(e) => setAttachedBath(e.target.checked)} /> Attached bathroom
          </label>
        </div>

        {purpose !== "pg" && (
          <div style={{ marginTop: 14 }}>
            <span style={labelStyle}>Features</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FEATURES_LIST.map((f) => (
                <span
                  key={f}
                  onClick={() => toggleFeature(f)}
                  style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                    border: features.includes(f) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                    background: features.includes(f) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                    color: features.includes(f) ? "var(--color-primary)" : "var(--muted)",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {purpose === "rent" && (
          <div style={{ marginTop: 14 }}>
            <span style={labelStyle}>Available For (optional)</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TENANT_PREFERENCES.map((t) => (
                <span
                  key={t}
                  onClick={() => toggleTenantPref(t)}
                  style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                    border: tenantPreference.includes(t) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                    background: tenantPreference.includes(t) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                    color: tenantPreference.includes(t) ? "var(--color-primary)" : "var(--muted)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <span style={labelStyle}>Description</span>
          <textarea style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything the owner mentioned worth including…" />
        </div>

        <div style={{ marginTop: 14 }}>
          <button onClick={useGps} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)", background: "rgba(15,118,110,0.08)", border: "1.5px solid var(--color-primary)", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
            📍 Capture GPS (if you're at the property)
          </button>
          {gpsMsg && <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 10 }}>{gpsMsg}</span>}
        </div>
      </div>

      {/* Media */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Photos & videos (from WhatsApp)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
            📷 Add photos ({photos.length})
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
            🎥 Add videos ({videos.length})
            <input type="file" accept="video/*" multiple hidden onChange={(e) => onVideoFiles(e.target.files)} />
          </label>
        </div>
        {videoErr && <p style={{ color: "var(--color-danger)", fontSize: 12.5, marginBottom: 8 }}>{videoErr}</p>}
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {photos.map((f, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: "4px 10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                {f.name.length > 18 ? f.name.slice(0, 15) + "…" : f.name}
                <span onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800 }}>✕</span>
              </span>
            ))}
          </div>
        )}
        {videos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {videos.map((f, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: "4px 10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                {f.name.length > 18 ? f.name.slice(0, 15) + "…" : f.name}
                <span onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800 }}>✕</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {err && <p style={{ color: "var(--color-danger)", fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</p>}
      {uploadMsg && <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>{uploadMsg}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none", background: "var(--ok, #16a06a)",
          color: "#fff", fontSize: 15, fontWeight: 800, cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.7 : 1, marginBottom: 40,
        }}
      >
        {submitting ? (uploadMsg || "Publishing…") : "✓ Publish listing (live immediately)"}
      </button>
    </div>
  );
}
