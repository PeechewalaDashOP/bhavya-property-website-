"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { KOTA_AREAS, COACHING_HUBS, FEATURES_LIST, TENANT_PREFERENCES } from "@/lib/constants";
import { compressImages } from "@/lib/imageCompress";
import { compressVideos, validateVideoSize } from "@/lib/videoCompress";
import { uploadFileWithRetry } from "@/lib/upload";
import {
  ROOM_CATEGORIES, USER_TYPES, ROOM_FACILITIES, COOLING_TYPES, HOUSE_RULES,
  TENANT_TYPES, CORE_SERVICES, COMMON_AMENITIES, PARKING_TYPES, ELECTRICITY_OPTIONS,
  NOTICE_PERIODS, GATE_TIMES, USP_CATEGORIES,
  type RoomCategoryKey, type UserType, type CoolingType, type ElectricityBilling,
} from "@/app/dealer/post/types";
import {
  buildPhotoLabelOptions, resolvePhotoLabelOption,
  PHOTO_LABEL_CUSTOM_VALUE, PHOTO_LABEL_NONE_VALUE,
} from "@/app/admin/photoTagOptions";

// Tagged, orderable photo — mirrors app/dealer/post/hostel/Step4Media.tsx's
// MediaItem so admin-uploaded PG/Hostel photos get the same section/tag/cover
// metadata (and the same room-variant photo-jump on the public listing page).
type PgMediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  section: string;
  tag: string;
  isCover: boolean;
};

function pgMediaId() {
  return Math.random().toString(36).slice(2, 10);
}

type Purpose = "rent" | "sale" | "pg";

const RENT_PTYPES = ["Room", "Flat", "House", "Shop", "Office", "Showroom", "Warehouse-Godown"];
const SALE_PTYPES = ["Flat", "House", "Shop", "Plot", "Office", "Showroom", "Warehouse-Godown"];

const CURRENT_YEAR = new Date().getFullYear();
const OPERATIONAL_YEARS = Array.from({ length: 30 }, (_, i) => String(CURRENT_YEAR - i));

// boys/girls/any (top-level gender_preference column) <-> male/female/both
// (hostel_meta.target_gender, same vocabulary the dealer wizard writes) —
// two different columns want two different vocabularies for the same choice.
const GENDER_PREF_TO_TARGET: Record<string, "male" | "female" | "both"> = {
  boys: "male", girls: "female", any: "both",
};

function needsBhk(ptype: string) {
  return !["Shop", "Plot", "Office", "Showroom", "Warehouse-Godown"].includes(ptype);
}
function needsFloor(ptype: string) {
  return ptype !== "Plot";
}

type UnitRow = {
  id: string;
  category: RoomCategoryKey;
  customLabel: string;
  label: string;
  capacity: string;
  price_per_month: string;
  deposit_amount: string;
  total_count: string;
  available_count: string;
  coolingType: CoolingType;
  facilities: string[];
  meals_included: boolean;
  description: string;
};

function emptyUnit(): UnitRow {
  return {
    id: Math.random().toString(36).slice(2, 9),
    category: "single", customLabel: "",
    label: "", capacity: "1", price_per_month: "", deposit_amount: "",
    total_count: "1", available_count: "",
    coolingType: "none", facilities: [], meals_included: false,
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
  const [customCoachingHub, setCustomCoachingHub] = useState("");
  const [availFrom, setAvailFrom] = useState("");
  const [minStay, setMinStay] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [tenantPreference, setTenantPreference] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsMsg, setGpsMsg] = useState("");

  // PG/Hostel-only — mirrors app/dealer/post/hostel/HostelFlow.tsx field-for-field
  // so admin cold-call entries carry the same detail as owner self-submissions.
  const [pgName, setPgName] = useState("");
  const [genderPreference, setGenderPreference] = useState("");
  const [mealsIncluded, setMealsIncluded] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>([emptyUnit()]);
  const [userType, setUserType] = useState<UserType>("owner");
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [landmark, setLandmark] = useState("");
  const [operationalSince, setOperationalSince] = useState("");
  const [presentOnFloor, setPresentOnFloor] = useState("");
  const [tenantTypes, setTenantTypes] = useState<string[]>([]);
  const [houseRules, setHouseRules] = useState<string[]>([]);
  const [noticePeriod, setNoticePeriod] = useState("30");
  const [gateTimingEnabled, setGateTimingEnabled] = useState(false);
  const [gateClosingTime, setGateClosingTime] = useState("22:00");
  const [services, setServices] = useState<string[]>([]);
  const [electricity, setElectricity] = useState<"" | ElectricityBilling>("");
  const [commonAmenities, setCommonAmenities] = useState<string[]>([]);
  const [parkingEnabled, setParkingEnabled] = useState(false);
  const [parkingTypes, setParkingTypes] = useState<string[]>([]);
  const [uspCategory, setUspCategory] = useState("");
  const [uspText, setUspText] = useState("");

  // Media — non-PG purposes use the plain `photos` bulk list; PG/Hostel uses
  // `pgMedia`, which carries per-photo tag/section/cover + manual ordering.
  const [photos, setPhotos] = useState<File[]>([]);
  const [pgMedia, setPgMedia] = useState<PgMediaItem[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [videoErr, setVideoErr] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: number; slug: string; title: string } | null>(null);

  const ptypeOptions = purpose === "pg" ? ["Hostel", "PG"] : purpose === "rent" ? RENT_PTYPES : SALE_PTYPES;

  // One merged "what does this photo show" dropdown per photo — the fixed
  // non-room options plus one entry per room category currently in use, so a
  // photo can be tied to a specific room type (drives the room-variant
  // photo-jump on the public listing page).
  const usedCategories = Array.from(new Set(units.map((u) => u.category)));
  const photoLabelOptions = buildPhotoLabelOptions(usedCategories);

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
  function toggleIn(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  }

  function updateUnit(id: string, patch: Partial<UnitRow>) {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }
  function setUnitCategory(id: string, category: RoomCategoryKey) {
    const cat = ROOM_CATEGORIES.find((c) => c.key === category);
    setUnits((prev) => prev.map((u) => (u.id === id
      ? { ...u, category, capacity: String(cat?.capacity ?? 1), label: u.label || (category === "other" ? "" : `${cat?.label ?? ""} Room`) }
      : u)));
  }
  function toggleUnitFacility(id: string, key: string) {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, facilities: u.facilities.includes(key) ? u.facilities.filter((x) => x !== key) : [...u.facilities, key] } : u)));
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

  function addPgPhotos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).map((file) => ({
      id: pgMediaId(), file, previewUrl: URL.createObjectURL(file),
      section: "", tag: "", isCover: false,
    }));
    setPgMedia((prev) => [...prev, ...arr]);
  }
  function removePgMedia(id: string) {
    setPgMedia((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }
  function setPgCover(id: string) {
    setPgMedia((prev) => prev.map((x) => ({ ...x, isCover: x.id === id })));
  }
  // One dropdown drives both tag+section together (see photoTagOptions.ts);
  // choosing "Custom…" just clears both so the text box starts blank.
  function setPgLabelOption(id: string, value: string) {
    if (value === PHOTO_LABEL_CUSTOM_VALUE) {
      setPgMedia((prev) => prev.map((x) => (x.id === id ? { ...x, tag: "", section: "" } : x)));
      return;
    }
    const opt = photoLabelOptions.find((o) => o.value === value);
    if (!opt) return;
    setPgMedia((prev) => prev.map((x) => (x.id === id ? { ...x, tag: opt.tag, section: opt.section } : x)));
  }
  function setPgCustomLabel(id: string, text: string) {
    setPgMedia((prev) => prev.map((x) => (x.id === id ? { ...x, tag: "", section: text } : x)));
  }
  function movePgMedia(id: string, dir: -1 | 1) {
    setPgMedia((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function reset() {
    setOwnerName(""); setOwnerPhone(""); setOwnerWhatsapp(true);
    setPurposeAndDefaultPtype("pg");
    setLoc(""); setBhk("1"); setBaths("1"); setPrice(""); setDeposit(""); setSqft("");
    setFurnishing(""); setFloorNum(""); setTotalFloors(""); setParking(false); setWifi(false);
    setAttachedBath(false); setCoachingHub(""); setCustomCoachingHub(""); setAvailFrom(""); setMinStay("");
    setFeatures([]); setTenantPreference([]); setDescription(""); setIsVerified(false); setLat(null); setLng(null); setGpsMsg("");
    setPgName(""); setGenderPreference(""); setMealsIncluded(false); setUnits([emptyUnit()]);
    setUserType("owner"); setAddress(""); setPincode(""); setLandmark("");
    setOperationalSince(""); setPresentOnFloor(""); setTenantTypes([]); setHouseRules([]);
    setNoticePeriod("30"); setGateTimingEnabled(false); setGateClosingTime("22:00");
    setServices([]); setElectricity(""); setCommonAmenities([]); setParkingEnabled(false);
    setParkingTypes([]); setUspCategory(""); setUspText("");
    pgMedia.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    setPgMedia([]);
    setPhotos([]); setVideos([]); setVideoErr(""); setDone(null); setErr("");
  }

  async function submit() {
    setErr("");
    const isPg = purpose === "pg";
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
      let photoTagMap: Record<string, string> = {};
      let photoSectionMap: Record<string, string> = {};

      const photoFiles = isPg ? pgMedia.map((m) => m.file) : photos;

      if (photoFiles.length > 0 || videos.length > 0) {
        setUploadMsg("Compressing media…");
        const [compPhotos, compVideos] = await Promise.all([compressImages(photoFiles), compressVideos(videos)]);

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

        let coverUrl = "";
        for (let i = 0; i < uploadUrls.length; i++) {
          const { signedUrl, publicUrl } = uploadUrls[i];
          const isPhoto = i < compPhotos.length;
          const num = isPhoto ? i + 1 : i - compPhotos.length + 1;
          setUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${num}…`);
          await uploadFileWithRetry(signedUrl, allFileObjs[i], () => {}, () => refreshSignedUrl(allFiles[i]));
          if (isPhoto) {
            photoPaths.push(publicUrl);
            if (isPg && publicUrl) {
              const item = pgMedia[i];
              photoTagMap[publicUrl] = item.tag;
              photoSectionMap[publicUrl] = item.section;
              if (item.isCover) coverUrl = publicUrl;
            }
          } else {
            videoPaths.push(publicUrl);
          }
        }
        photoPaths = photoPaths.filter(Boolean);
        videoPaths = videoPaths.filter(Boolean);
        // Cover photo always leads — same convention as HostelFlow.tsx, so the
        // listing card / gallery opens on the photo the admin picked as cover.
        if (isPg && coverUrl) {
          photoPaths = [coverUrl, ...photoPaths.filter((p) => p !== coverUrl)];
        }
      }

      setUploadMsg("Publishing listing…");

      const pgUnits = units.filter((u) => u.label && Number(u.price_per_month) > 0);
      // Same derivations HostelFlow.tsx makes from its per-room facilities/cooling
      // picks — keeps the top-level columns consistent whichever form wrote them.
      const pgAttachedBath = pgUnits.some((u) => u.facilities.includes("washroom"));
      const pgWifi = commonAmenities.includes("wifi");
      const pgRoomCategories = Array.from(new Set(pgUnits.map((u) => u.category)));

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
        attached_bathroom: isPg ? pgAttachedBath : attachedBath,
        parking_available: isPg ? parkingEnabled : parking,
        wifi_included: isPg ? pgWifi : wifi,
        nearest_coaching_hub: coachingHub || null,
        features: isPg ? commonAmenities : features,
        tenant_preference: purpose === "rent" ? tenantPreference : [],
        description,
        photoPaths,
        videoPaths,
        units: isPg
          ? pgUnits.map((u, i) => {
              const totalCount = Number(u.total_count) || 1;
              // Blank = admin didn't specify how many are already taken — assume
              // the whole room type is available rather than silently defaulting
              // to 1 (which showed a false "⚡ Only 1 left" scarcity badge).
              const availCount = u.available_count.trim() ? Number(u.available_count) : totalCount;
              return {
                label: u.label,
                capacity: Number(u.capacity) || 1,
                price_per_month: Number(u.price_per_month),
                deposit_amount: u.deposit_amount ? Number(u.deposit_amount) : null,
                total_count: totalCount,
                available_count: Math.min(availCount, totalCount),
                has_ac: u.coolingType === "ac",
                has_cooler: u.coolingType === "cooler",
                attached_bath: u.facilities.includes("washroom"),
                meals_included: u.meals_included,
                description: u.description || null,
                sort_order: i,
                attributes: { occupancy: u.category, cooling: u.coolingType, facilities: u.facilities },
              };
            })
          : [],
        hostel_meta: isPg
          ? {
              pg_name: pgName.trim() || undefined,
              user_type: userType,
              address: address.trim(),
              pincode: pincode || null,
              landmark: landmark.trim() || null,
              operational_since: operationalSince || null,
              present_on_floor: presentOnFloor.trim() || null,
              room_categories: pgRoomCategories,
              target_gender: GENDER_PREF_TO_TARGET[genderPreference] ?? "both",
              tenant_types: tenantTypes,
              house_rules: houseRules,
              notice_period: noticePeriod,
              gate_timing_enabled: gateTimingEnabled,
              gate_closing_time: gateTimingEnabled ? gateClosingTime : null,
              services,
              food_provided: mealsIncluded,
              electricity: electricity || null,
              common_amenities: commonAmenities,
              parking_enabled: parkingEnabled,
              parking_types: parkingTypes,
              usp_category: uspCategory || null,
              usp_text: uspText.trim() || null,
              photo_tags: photoTagMap,
              photo_sections: photoSectionMap,
              custom_coaching_hub: coachingHub === "Other" ? customCoachingHub.trim() || null : null,
            }
          : undefined,
        lat, lng,
        is_verified: isVerified,
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

      {/* Trust badge — shows a "✓ Verified by Prop100" badge on the listing card and detail page */}
      <div style={sectionStyle}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>✓ Mark as Verified by Prop100</span>
        </label>
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
          Shows a highlighted "Verified" badge on this listing's card and its individual page — use this only once you've confirmed the property in person or on the call.
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

      {/* PG-only: who's submitting + full address + operational details */}
      {purpose === "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Owner is the</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {USER_TYPES.map((u) => (
              <button
                key={u.key}
                onClick={() => setUserType(u.key)}
                style={{
                  flex: 1, padding: "9px 8px", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  border: userType === u.key ? "1.5px solid var(--color-primary)" : "1.5px solid var(--line)",
                  background: userType === u.key ? "rgba(15,118,110,0.08)" : "var(--surface)",
                  color: userType === u.key ? "var(--color-primary)" : "var(--ink)",
                }}
              >
                {u.label}
              </button>
            ))}
          </div>

          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={labelStyle}>Full address</span>
            <textarea style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House / building no., street, near which landmark…" />
          </label>
          <div style={grid}>
            <label>
              <span style={labelStyle}>Pincode</span>
              <input style={inputStyle} value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="324001" inputMode="numeric" />
            </label>
            <label>
              <span style={labelStyle}>Landmark</span>
              <input style={inputStyle} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Near Allen gate" />
            </label>
            <label>
              <span style={labelStyle}>Running since</span>
              <select style={inputStyle} value={operationalSince} onChange={(e) => setOperationalSince(e.target.value)}>
                <option value="">Select year…</option>
                {OPERATIONAL_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label>
              <span style={labelStyle}>Present on floor</span>
              <input style={inputStyle} value={presentOnFloor} onChange={(e) => setPresentOnFloor(e.target.value)} placeholder="e.g. 1st, 2nd" />
            </label>
          </div>
        </div>
      )}

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
                  <span style={labelStyle}>Category</span>
                  <select style={inputStyle} value={u.category} onChange={(e) => setUnitCategory(u.id, e.target.value as RoomCategoryKey)}>
                    {ROOM_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </label>
                {u.category === "other" && (
                  <label>
                    <span style={labelStyle}>Custom category name</span>
                    <input style={inputStyle} value={u.customLabel} onChange={(e) => updateUnit(u.id, { customLabel: e.target.value })} placeholder="e.g. Dormitory" />
                  </label>
                )}
                <label>
                  <span style={labelStyle}>Label *</span>
                  <input style={inputStyle} value={u.label} onChange={(e) => updateUnit(u.id, { label: e.target.value })} placeholder="e.g. Single AC" />
                </label>
                <label>
                  <span style={labelStyle}>Price/month (₹) *</span>
                  <input type="number" style={inputStyle} value={u.price_per_month} onChange={(e) => updateUnit(u.id, { price_per_month: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Security Deposit (₹)</span>
                  <input type="number" style={inputStyle} value={u.deposit_amount} onChange={(e) => updateUnit(u.id, { deposit_amount: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Capacity</span>
                  <input type="number" min={1} style={inputStyle} value={u.capacity} onChange={(e) => updateUnit(u.id, { capacity: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Total rooms</span>
                  <input type="number" min={1} style={inputStyle} value={u.total_count} onChange={(e) => updateUnit(u.id, { total_count: e.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>Available now</span>
                  <input type="number" min={0} style={inputStyle} value={u.available_count} onChange={(e) => updateUnit(u.id, { available_count: e.target.value })} placeholder="Blank = all available" />
                </label>
              </div>

              <div style={{ marginTop: 10 }}>
                <span style={labelStyle}>Cooling</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {COOLING_TYPES.map((c) => (
                    <span
                      key={c.key}
                      onClick={() => updateUnit(u.id, { coolingType: c.key })}
                      style={{
                        fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                        border: u.coolingType === c.key ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                        background: u.coolingType === c.key ? "rgba(15,118,110,0.08)" : "var(--surface)",
                        color: u.coolingType === c.key ? "var(--color-primary)" : "var(--muted)",
                      }}
                    >
                      {c.icon} {c.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <span style={labelStyle}>What&apos;s inside this room?</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ROOM_FACILITIES.map((f) => (
                    <span
                      key={f.key}
                      onClick={() => toggleUnitFacility(u.id, f.key)}
                      style={{
                        fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                        border: u.facilities.includes(f.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                        background: u.facilities.includes(f.key) ? "rgba(15,118,110,0.08)" : "var(--surface)",
                        color: u.facilities.includes(f.key) ? "var(--color-primary)" : "var(--muted)",
                      }}
                    >
                      {f.icon} {f.label}
                    </span>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginTop: 10, fontSize: 12.5 }}>
                <input type="checkbox" checked={u.meals_included} onChange={(e) => updateUnit(u.id, { meals_included: e.target.checked })} />
                Meals included in this rent
              </label>
            </div>
          ))}
          <button onClick={addUnit} style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", background: "rgba(15,118,110,0.08)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
            + Add another room type
          </button>
        </div>
      )}

      {/* PG-only: who can stay + house rules */}
      {purpose === "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Who Can Stay</div>
          <span style={labelStyle}>Tenant type</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {TENANT_TYPES.map((t) => (
              <span
                key={t.key}
                onClick={() => toggleIn(tenantTypes, setTenantTypes, t.key)}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                  border: tenantTypes.includes(t.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                  background: tenantTypes.includes(t.key) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                  color: tenantTypes.includes(t.key) ? "var(--color-primary)" : "var(--muted)",
                }}
              >
                {t.label}
              </span>
            ))}
          </div>

          <span style={labelStyle}>House rules</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {HOUSE_RULES.map((r) => (
              <span
                key={r.key}
                onClick={() => toggleIn(houseRules, setHouseRules, r.key)}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                  border: houseRules.includes(r.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                  background: houseRules.includes(r.key) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                  color: houseRules.includes(r.key) ? "var(--color-primary)" : "var(--muted)",
                }}
              >
                {r.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PG-only: timings, notice, services, electricity */}
      {purpose === "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Timings, Services &amp; Electricity</div>
          <div style={grid}>
            <label>
              <span style={labelStyle}>Notice period before leaving</span>
              <select style={inputStyle} value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)}>
                {NOTICE_PERIODS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </label>
            <label>
              <span style={labelStyle}>Electricity bill</span>
              <select style={inputStyle} value={electricity} onChange={(e) => setElectricity(e.target.value as "" | ElectricityBilling)}>
                <option value="">—</option>
                {ELECTRICITY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.icon} {o.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <input type="checkbox" checked={gateTimingEnabled} onChange={(e) => setGateTimingEnabled(e.target.checked)} />
            <span style={{ fontSize: 13 }}>Gate closes at night</span>
          </div>
          {gateTimingEnabled && (
            <div style={{ marginTop: 8, maxWidth: 220 }}>
              <span style={labelStyle}>Gate closing time</span>
              <select
                style={inputStyle}
                value={GATE_TIMES.some((t) => t.value === gateClosingTime) ? gateClosingTime : "custom"}
                onChange={(e) => setGateClosingTime(e.target.value === "custom" ? "" : e.target.value)}
              >
                {GATE_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                <option value="custom">Custom…</option>
              </select>
              {!GATE_TIMES.some((t) => t.value === gateClosingTime) && (
                <input type="time" style={{ ...inputStyle, marginTop: 6 }} value={gateClosingTime} onChange={(e) => setGateClosingTime(e.target.value)} />
              )}
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <span style={labelStyle}>Services included</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CORE_SERVICES.map((s) => (
                <span
                  key={s.key}
                  onClick={() => toggleIn(services, setServices, s.key)}
                  style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                    border: services.includes(s.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                    background: services.includes(s.key) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                    color: services.includes(s.key) ? "var(--color-primary)" : "var(--muted)",
                  }}
                >
                  {s.icon} {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PG-only: common amenities + parking */}
      {purpose === "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Common Area Amenities</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
            {COMMON_AMENITIES.map((a) => (
              <label key={a.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" checked={commonAmenities.includes(a.key)} onChange={() => toggleIn(commonAmenities, setCommonAmenities, a.key)} />
                {a.icon} {a.label}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <input type="checkbox" checked={parkingEnabled} onChange={(e) => setParkingEnabled(e.target.checked)} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Parking available</span>
          </div>
          {parkingEnabled && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PARKING_TYPES.map((p) => (
                <span
                  key={p.key}
                  onClick={() => toggleIn(parkingTypes, setParkingTypes, p.key)}
                  style={{
                    fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                    border: parkingTypes.includes(p.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                    background: parkingTypes.includes(p.key) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                    color: parkingTypes.includes(p.key) ? "var(--color-primary)" : "var(--muted)",
                  }}
                >
                  {p.icon} {p.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PG-only: USP */}
      {purpose === "pg" && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>What Makes This Special?</div>
          <div style={grid}>
            <label>
              <span style={labelStyle}>Strongest selling point</span>
              <select style={inputStyle} value={uspCategory} onChange={(e) => setUspCategory(e.target.value)}>
                <option value="">Select category…</option>
                {USP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            {uspCategory && (
              <label>
                <span style={labelStyle}>Details</span>
                <input style={inputStyle} value={uspText} onChange={(e) => setUspText(e.target.value)} placeholder="e.g. Fresh home-cooked meals daily" maxLength={100} />
              </label>
            )}
          </div>
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
            {purpose === "pg" && coachingHub === "Other" && (
              <input
                style={{ ...inputStyle, marginTop: 6 }}
                value={customCoachingHub}
                onChange={(e) => setCustomCoachingHub(e.target.value)}
                placeholder="Type the actual coaching name"
              />
            )}
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
        {purpose !== "pg" && (
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
        )}

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

        {purpose === "pg" ? (
          <>
            <label style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "10px 16px", cursor: "pointer", marginBottom: 12 }}>
              📷 Add photos ({pgMedia.length})
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPgPhotos(e.target.files); e.target.value = ""; }} />
            </label>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -6, marginBottom: 10 }}>
              Tag what each photo shows and pick a cover. Use ↑/↓ to set the order they show in on the listing.
            </p>
            {pgMedia.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {pgMedia.map((m, i) => {
                  const optionValue = resolvePhotoLabelOption(photoLabelOptions, m.tag, m.section);
                  const isCustom = optionValue === PHOTO_LABEL_CUSTOM_VALUE;
                  return (
                  <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, padding: 8, background: "var(--bg)" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img src={m.previewUrl} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                      {m.isCover && (
                        <span style={{ position: "absolute", top: -6, left: -6, fontSize: 10, fontWeight: 800, background: "var(--color-primary)", color: "#fff", borderRadius: 10, padding: "2px 6px" }}>★ Cover</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <select style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12 }} value={optionValue} onChange={(e) => setPgLabelOption(m.id, e.target.value)}>
                          {photoLabelOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {isCustom && (
                          <input
                            style={{ ...inputStyle, width: 160, padding: "5px 8px", fontSize: 12 }}
                            value={m.section}
                            onChange={(e) => setPgCustomLabel(m.id, e.target.value)}
                            placeholder="Type a tag…"
                          />
                        )}
                      </div>
                      {!m.isCover && (
                        <span onClick={() => setPgCover(m.id)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-primary)", cursor: "pointer", width: "fit-content" }}>
                          Set as cover
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button onClick={() => movePgMedia(m.id, -1)} disabled={i === 0} style={{ fontSize: 12, padding: "2px 8px", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.35 : 1, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface)" }}>↑</button>
                      <button onClick={() => movePgMedia(m.id, 1)} disabled={i === pgMedia.length - 1} style={{ fontSize: 12, padding: "2px 8px", cursor: i === pgMedia.length - 1 ? "default" : "pointer", opacity: i === pgMedia.length - 1 ? 0.35 : 1, border: "1px solid var(--line)", borderRadius: 6, background: "var(--surface)" }}>↓</button>
                    </div>
                    <span onClick={() => removePgMedia(m.id)} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800, padding: "0 4px" }}>✕</span>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
              📷 Add photos ({photos.length})
              <input type="file" accept="image/*" multiple hidden onChange={(e) => setPhotos((prev) => [...prev, ...Array.from(e.target.files ?? [])])} />
            </label>
          </div>
        )}

        <label style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "10px 16px", cursor: "pointer", display: "inline-block" }}>
          🎥 Add videos ({videos.length})
          <input type="file" accept="video/*" multiple hidden onChange={(e) => onVideoFiles(e.target.files)} />
        </label>
        {videoErr && <p style={{ color: "var(--color-danger)", fontSize: 12.5, marginTop: 8 }}>{videoErr}</p>}
        {purpose !== "pg" && photos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {photos.map((f, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: "4px 10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                {f.name.length > 18 ? f.name.slice(0, 15) + "…" : f.name}
                <span onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800 }}>✕</span>
              </span>
            ))}
          </div>
        )}
        {videos.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
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
