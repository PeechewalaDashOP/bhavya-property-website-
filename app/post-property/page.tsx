"use client";

import { useRef, useState } from "react";
import { LoadingBar } from "@/components/LoadingBar";
import { KOTA_AREAS, PROPERTY_TYPES, COACHING_HUBS, FEATURES_LIST, PTYPE_ICONS } from "@/lib/constants";
import { compressImages } from "@/lib/imageCompress";
import { compressVideos, validateVideoSize } from "@/lib/videoCompress";
import { uploadFileWithRetry } from "@/lib/upload";
import styles from "./styles.module.css";

type Form = {
  type: "rent" | "sale";
  ptype: string;
  loc: string;
  bhk: number;
  baths: number;
  price: string;
  deposit: string;
  sqft: string;
  furnishing: string;
  gender: string;
  meals: boolean;
  availFrom: string;
  minStay: string;
  floorNum: string;
  totalFloors: string;
  parking: boolean;
  wifi: boolean;
  attachedBath: boolean;
  coachingHub: string;
  features: string[];
  description: string;
  ownerName: string;
  ownerPhone: string;
};

export default function PostPropertyPublicPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>({
    type: "rent", ptype: "Flat", loc: "", bhk: 1, baths: 1,
    price: "", deposit: "", sqft: "", furnishing: "", gender: "any",
    meals: false, availFrom: "", minStay: "", floorNum: "", totalFloors: "",
    parking: false, wifi: false, attachedBath: false, coachingHub: "", features: [], description: "",
    ownerName: "", ownerPhone: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoNames, setVideoNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [compressingVideo, setCompressingVideo] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitErr, setSubmitErr] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  // Owner phone verification — required before a dealer account (and the
  // listing itself) can be created, so anyone can't just type in any
  // phone number and claim it. Verified before uploads start, so a wrong
  // code never means "re-upload every photo and video."
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isRent = form.type === "rent";
  const needsBHK = !["Shop", "Plot"].includes(form.ptype);
  const needsGender = ["Hostel", "PG"].includes(form.ptype);
  const needsMeals = ["Hostel", "PG"].includes(form.ptype);

  async function addPhotos(fl: FileList | null) {
    if (!fl) return;
    const files = await compressImages(Array.from(fl));
    setPhotos((p) => [...p, ...files]);
    setPhotoUrls((u) => [...u, ...files.map((f) => URL.createObjectURL(f))]);
  }
  function removePhoto(i: number) {
    URL.revokeObjectURL(photoUrls[i]);
    setPhotos((p) => p.filter((_, j) => j !== i));
    setPhotoUrls((u) => u.filter((_, j) => j !== i));
  }
  async function addVideos(fl: FileList | null) {
    if (!fl) return;
    const candidates = Array.from(fl);
    const oversized = candidates.map(validateVideoSize).find(Boolean);
    if (oversized) { setErrors((e) => ({ ...e, videos: oversized })); return; }

    setErrors((e) => ({ ...e, videos: "" }));
    setCompressingVideo(true);
    const files = await compressVideos(candidates);
    setCompressingVideo(false);
    setVideos((v) => [...v, ...files]);
    setVideoNames((n) => [...n, ...files.map((f) => f.name)]);
  }
  function removeVideo(i: number) {
    setVideos((v) => v.filter((_, j) => j !== i));
    setVideoNames((n) => n.filter((_, j) => j !== i));
  }
  function toggleFeature(f: string) {
    set("features", form.features.includes(f) ? form.features.filter((x) => x !== f) : [...form.features, f]);
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!form.loc) e.loc = "Select your area";
    setErrors(e);
    return !Object.keys(e).length;
  }
  function validateStep2() {
    const e: Record<string, string> = {};
    if (!form.price || Number(form.price) <= 0) e.price = "Enter the price";
    setErrors(e);
    return !Object.keys(e).length;
  }
  function validateStep3() {
    if (videos.length === 0) {
      setErrors({ videos: "At least 1 video is required" });
      return false;
    }
    return true;
  }

  function startCooldown() {
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function sendOtp() {
    const e: Record<string, string> = {};
    if (!form.ownerName.trim()) e.ownerName = "Enter your name";
    if (!form.ownerPhone.trim() || !/^\d{10}$/.test(form.ownerPhone.trim())) {
      e.ownerPhone = "Enter a valid 10-digit phone number";
    }
    if (Object.keys(e).length) { setErrors(e); return; }

    setSendingOtp(true);
    setSubmitErr("");
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: form.ownerPhone.trim(), purpose: "owner_post" }),
    });
    const data = await res.json();
    setSendingOtp(false);
    if (!res.ok) { setSubmitErr(data.error ?? "Failed to send OTP. Please try again."); return; }
    setOtp("");
    setOtpSent(true);
    startCooldown();
  }

  async function verifyOtpAndSave() {
    const cleanedOtp = otp.replace(/\D/g, "");
    if (cleanedOtp.length !== 6) { setSubmitErr("Enter the 6-digit OTP"); return; }

    setVerifyingOtp(true);
    setSubmitErr("");
    const res = await fetch("/api/public/verify-owner-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: form.ownerPhone.trim(), otp: cleanedOtp }),
    });
    const data = await res.json();
    setVerifyingOtp(false);
    if (!res.ok) { setSubmitErr(data.error ?? "Incorrect OTP. Please try again."); return; }

    await uploadAndSave();
  }

  async function uploadAndSave() {
    setUploading(true);
    setUploadPct(0);
    setSubmitErr("");

    try {
      const allFiles = [
        ...photos.map((f) => ({ name: f.name, type: f.type, category: "photo" as const })),
        ...videos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
      ];

      setUploadMsg("Preparing upload…");
      const prepRes = await fetch("/api/public/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: allFiles }),
      });
      if (!prepRes.ok) {
        const d = await prepRes.json().catch(() => ({}));
        throw new Error(d.error || "Failed to prepare upload.");
      }
      const { files: uploadUrls } = await prepRes.json();

      const photoPaths: string[] = [];
      const videoPaths: string[] = [];
      const allFileObjs = [...photos, ...videos];

      const refreshSignedUrl = async (meta: (typeof allFiles)[number]) => {
        const r = await fetch("/api/public/prepare-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: [meta] }),
        });
        if (!r.ok) throw new Error("Could not retry upload — please try again.");
        const d = await r.json();
        return d.files[0].signedUrl as string;
      };

      for (let i = 0; i < uploadUrls.length; i++) {
        const { signedUrl, publicUrl } = uploadUrls[i];
        const isPhoto = i < photos.length;
        const num = isPhoto ? i + 1 : i - photos.length + 1;
        setUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${num}…`);
        await uploadFileWithRetry(
          signedUrl,
          allFileObjs[i],
          (p) => setUploadPct(((i + p) / uploadUrls.length) * 88),
          () => refreshSignedUrl(allFiles[i])
        );
        if (isPhoto) photoPaths.push(publicUrl);
        else videoPaths.push(publicUrl);
      }

      setUploadPct(92);
      setUploadMsg("Saving your listing…");

      const res = await fetch("/api/public/post-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: form.ownerName.trim(),
          ownerPhone: form.ownerPhone.trim(),
          type: form.type,
          ptype: form.ptype,
          loc: form.loc,
          bhk: needsBHK ? form.bhk : 0,
          baths: needsBHK ? form.baths : 0,
          price: Number(form.price) || 0,
          rent_per_month: isRent ? Number(form.price) || 0 : null,
          deposit_amount: isRent && form.deposit ? Number(form.deposit) : null,
          sqft: form.sqft ? Number(form.sqft) : null,
          furnishing_status: form.furnishing || null,
          meals_included: needsMeals ? form.meals : false,
          gender_preference: needsGender ? form.gender : null,
          available_from: isRent && form.availFrom ? form.availFrom : null,
          min_stay_months: isRent && form.minStay ? Number(form.minStay) : null,
          floor_number: form.floorNum ? Number(form.floorNum) : null,
          total_floors: form.totalFloors ? Number(form.totalFloors) : null,
          attached_bathroom: form.attachedBath,
          parking_available: form.parking,
          wifi_included: form.wifi,
          nearest_coaching_hub: isRent && form.coachingHub ? form.coachingHub : null,
          features: form.features,
          description: form.description,
          photoPaths,
          videoPaths,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save listing");
      }

      setUploadPct(100);
      setDone(true);
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setUploading(false);
    }
  }

  const STEP_LABELS = ["Property", "Pricing", "Photos", "Contact"];

  /* ── Success screen ─────────────────────────────────────────── */
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "var(--dark)", color: "#fff" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--color-primary)" }}>100</span></span>
          </div>
        </div>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 16px 0" }}>
          <div className={styles.success}>
            <div className={styles.successIcon}>🎉</div>
            <div className={styles.successTitle}>Listing Submitted!</div>
            <div className={styles.successSub}>
              Our team will review your property and get it live within 24 hours.
              We&apos;ll contact you on <strong>{form.ownerPhone}</strong> once it&apos;s approved.
            </div>
            <a
              href="/"
              style={{
                display: "block",
                width: "100%",
                padding: "15px",
                border: "none",
                borderRadius: 12,
                background: "var(--color-primary)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                textAlign: "center",
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(15,118,110,0.35)",
              }}
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main form ──────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={uploading} />

      {/* Sticky header */}
      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--color-primary)" }}>100</span></span>
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>List Your Property</span>
          </div>
          <a href="/" style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>Cancel</a>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 14px" }}>

        {/* Step progress */}
        <div className={styles.progress}>
          {[1, 2, 3, 4].map((s, i) => (
            <div key={s} className={styles.progressStep}>
              <div
                className={`${styles.progressDot} ${step > s ? styles.progressDotDone : step === s ? styles.progressDotActive : ""}`}
              >
                {step > s ? "✓" : s}
              </div>
              {i < 3 && (
                <div className={`${styles.progressLine} ${step > s ? styles.progressLineDone : ""}`} />
              )}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginBottom: 14, fontWeight: 700 }}>
          {STEP_LABELS[step - 1]}
        </div>

        {/* ═══════════ STEP 1 — Property Basics ═══════════ */}
        {step === 1 && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Listing Type</div>
              <div className={styles.typeToggle}>
                {(["rent", "sale"] as const).map((t) => (
                  <button
                    key={t}
                    className={`${styles.typeBtn} ${form.type === t ? styles.typeBtnActive : ""}`}
                    onClick={() => set("type", t)}
                  >
                    {t === "rent" ? "🔑 For Rent" : "🏷️ For Sale"}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Property Type</div>
              <div className={styles.ptypeGrid}>
                {PROPERTY_TYPES.map((pt) => (
                  <button
                    key={pt}
                    className={`${styles.ptypeCard} ${form.ptype === pt ? styles.ptypeCardActive : ""}`}
                    onClick={() => set("ptype", pt)}
                  >
                    <span style={{ fontSize: 26 }}>{PTYPE_ICONS[pt]}</span>
                    <span>{pt}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Location</div>
              <label className={styles.label}>Area in Kota</label>
              <select
                className={`${styles.select} ${errors.loc ? styles.inputError : ""}`}
                value={form.loc}
                onChange={(e) => { set("loc", e.target.value); setErrors({}); }}
              >
                <option value="">Select area…</option>
                {KOTA_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {errors.loc && <div className={styles.errorMsg}>⚠ {errors.loc}</div>}
            </div>

            {needsBHK && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Rooms</div>
                <label className={styles.label} style={{ marginBottom: 10 }}>BHK</label>
                <div className={styles.numBtns} style={{ marginBottom: 18 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} className={`${styles.numBtn} ${form.bhk === n ? styles.numBtnActive : ""}`} onClick={() => set("bhk", n)}>{n}</button>
                  ))}
                  <button className={`${styles.numBtn} ${form.bhk === 5 ? styles.numBtnActive : ""}`} style={{ width: "auto", padding: "0 14px" }} onClick={() => set("bhk", 5)}>4+</button>
                </div>
                <label className={styles.label} style={{ marginBottom: 10 }}>Bathrooms</label>
                <div className={styles.numBtns}>
                  {[1, 2, 3].map((n) => (
                    <button key={n} className={`${styles.numBtn} ${form.baths === n ? styles.numBtnActive : ""}`} onClick={() => set("baths", n)}>{n}</button>
                  ))}
                  <button className={`${styles.numBtn} ${form.baths === 4 ? styles.numBtnActive : ""}`} style={{ width: "auto", padding: "0 14px" }} onClick={() => set("baths", 4)}>3+</button>
                </div>
              </div>
            )}

            <div className={styles.navRow}>
              <button className={styles.btnNext} onClick={() => { if (validateStep1()) setStep(2); }}>
                Next: Pricing & Details →
              </button>
            </div>
          </>
        )}

        {/* ═══════════ STEP 2 — Pricing & Details ═══════════ */}
        {step === 2 && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{isRent ? "Pricing" : "Sale Price"}</div>
              {isRent ? (
                <>
                  <label className={styles.label}>Monthly Rent (₹)</label>
                  <input
                    type="number" inputMode="numeric" placeholder="e.g. 8000"
                    className={`${styles.input} ${errors.price ? styles.inputError : ""}`}
                    value={form.price}
                    onChange={(e) => { set("price", e.target.value); setErrors({}); }}
                    style={{ marginBottom: 12 }}
                  />
                  <label className={styles.label}>Security Deposit (₹)</label>
                  <input
                    type="number" inputMode="numeric" placeholder="e.g. 10000"
                    className={styles.input} value={form.deposit}
                    onChange={(e) => set("deposit", e.target.value)}
                  />
                </>
              ) : (
                <>
                  <label className={styles.label}>Sale Price (₹)</label>
                  <input
                    type="number" inputMode="numeric" placeholder="e.g. 4500000"
                    className={`${styles.input} ${errors.price ? styles.inputError : ""}`}
                    value={form.price}
                    onChange={(e) => { set("price", e.target.value); setErrors({}); }}
                  />
                </>
              )}
              {errors.price && <div className={styles.errorMsg}>⚠ {errors.price}</div>}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Property Details</div>
              <label className={styles.label}>Area (sq ft) — optional</label>
              <input
                type="number" inputMode="numeric" placeholder="e.g. 350"
                className={styles.input} value={form.sqft}
                onChange={(e) => set("sqft", e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <label className={styles.label}>Furnishing Status</label>
              <div className={styles.optBtns}>
                {[{ v: "furnished", l: "Furnished" }, { v: "semi-furnished", l: "Semi" }, { v: "unfurnished", l: "Unfurnished" }].map((o) => (
                  <button
                    key={o.v}
                    className={`${styles.optBtn} ${form.furnishing === o.v ? styles.optBtnActive : ""}`}
                    onClick={() => set("furnishing", form.furnishing === o.v ? "" : o.v)}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Floor Info</div>
              <div className={styles.inputRow}>
                <div>
                  <label className={styles.label}>Floor No.</label>
                  <input type="number" inputMode="numeric" placeholder="2" className={styles.input} value={form.floorNum} onChange={(e) => set("floorNum", e.target.value)} />
                </div>
                <div>
                  <label className={styles.label}>Total Floors</label>
                  <input type="number" inputMode="numeric" placeholder="5" className={styles.input} value={form.totalFloors} onChange={(e) => set("totalFloors", e.target.value)} />
                </div>
              </div>
            </div>

            {isRent && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Rental Details</div>
                <label className={styles.label}>Available From</label>
                <input type="date" className={styles.input} value={form.availFrom} onChange={(e) => set("availFrom", e.target.value)} style={{ marginBottom: 14 }} />
                <label className={styles.label}>Minimum Stay</label>
                <select className={styles.select} value={form.minStay} onChange={(e) => set("minStay", e.target.value)} style={{ marginBottom: 14 }}>
                  <option value="">No minimum</option>
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
                <label className={styles.label}>Nearest Coaching Hub</label>
                <select className={styles.select} value={form.coachingHub} onChange={(e) => set("coachingHub", e.target.value)} style={{ marginBottom: needsGender ? 14 : 0 }}>
                  <option value="">Select coaching…</option>
                  {COACHING_HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                {needsGender && (
                  <>
                    <label className={styles.label} style={{ marginTop: 14 }}>Gender Preference</label>
                    <div className={styles.optBtns} style={{ marginBottom: needsMeals ? 14 : 0 }}>
                      {[{ v: "boys", l: "Boys" }, { v: "girls", l: "Girls" }, { v: "any", l: "Any" }].map((o) => (
                        <button key={o.v} className={`${styles.optBtn} ${form.gender === o.v ? styles.optBtnActive : ""}`} onClick={() => set("gender", o.v)}>{o.l}</button>
                      ))}
                    </div>
                  </>
                )}
                {needsMeals && (
                  <div className={styles.toggleRow} style={{ paddingTop: 0 }}>
                    <span className={styles.toggleLabel}>Meals Included</span>
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={form.meals} onChange={(e) => set("meals", e.target.checked)} />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Amenities</div>
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>Parking Available</span>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={form.parking} onChange={(e) => set("parking", e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>WiFi Included</span>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={form.wifi} onChange={(e) => set("wifi", e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
              <div className={styles.toggleRow}>
                <span className={styles.toggleLabel}>Attached Bathroom</span>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={form.attachedBath} onChange={(e) => set("attachedBath", e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Features</div>
              <div className={styles.featureChips}>
                {FEATURES_LIST.map((f) => (
                  <button
                    key={f}
                    className={`${styles.chip} ${form.features.includes(f) ? styles.chipActive : ""}`}
                    onClick={() => toggleFeature(f)}
                  >
                    {form.features.includes(f) ? "✓ " : ""}{f}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Description</div>
              <label className={styles.label}>Tell us what makes this special</label>
              <textarea
                className={styles.textarea}
                placeholder="e.g. Well-maintained flat near coaching, 24×7 water, gated society…"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
              />
            </div>

            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => { setErrors({}); setStep(1); }}>← Back</button>
              <button className={styles.btnNext} onClick={() => { if (validateStep2()) setStep(3); }}>Next: Add Media →</button>
            </div>
          </>
        )}

        {/* ═══════════ STEP 3 — Photos & Video ═══════════ */}
        {step === 3 && !uploading && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Photos{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
                  — optional, multiple allowed
                </span>
              </div>
              <div className={styles.mediaZone} onClick={() => photoRef.current?.click()}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 3 }}>Add Photos</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Tap to choose · JPEG, PNG · Multiple OK</div>
              </div>
              <input ref={photoRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addPhotos(e.target.files)} />
              {photoUrls.length > 0 && (
                <div className={styles.mediaGrid}>
                  {photoUrls.map((url, i) => (
                    <div key={i} className={styles.mediaThumb}>
                      <img src={url} alt="" />
                      <button className={styles.mediaThumbRemove} onClick={() => removePhoto(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Video Tour</span>
                <span style={{ color: "var(--color-danger)", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>REQUIRED</span>
              </div>
              <div
                className={`${styles.mediaZone} ${errors.videos ? styles.mediaZoneRequired : ""}`}
                onClick={() => videoRef.current?.click()}
              >
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎬</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 3 }}>
                  {videos.length === 0 ? "Add Video Tour" : `${videos.length} video${videos.length > 1 ? "s" : ""} selected — tap to add more`}
                </div>
                <div style={{ fontSize: 13, color: errors.videos ? "var(--color-danger)" : "var(--muted)", fontWeight: errors.videos ? 700 : 400 }}>
                  {errors.videos || "MP4, MOV, WEBM · At least 1 required"}
                </div>
              </div>
              <input ref={videoRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={(e) => addVideos(e.target.files)} />
              {compressingVideo && (
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                  Compressing video to save data — this can take a minute for longer clips…
                </div>
              )}
              {videoNames.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {videoNames.map((name, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(15,118,110,0.04)", border: "1px solid rgba(15,118,110,0.18)", borderRadius: 10, padding: "10px 12px" }}>
                      <span style={{ fontSize: 20 }}>🎬</span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      <button onClick={() => removeVideo(i)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 6px" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => { setErrors({}); setStep(2); }}>← Back</button>
              <button className={styles.btnNext} onClick={() => { if (validateStep3()) setStep(4); }}>Next: Your Contact →</button>
            </div>
          </>
        )}

        {/* ═══════════ STEP 4 — Owner Contact ═══════════ */}
        {step === 4 && !uploading && !otpSent && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Your Contact Details</div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 16 }}>
                We&apos;ll contact you when your listing goes live. Potential tenants/buyers reach you through our platform.
              </p>
              <label className={styles.label}>Your Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                className={`${styles.input} ${errors.ownerName ? styles.inputError : ""}`}
                value={form.ownerName}
                onChange={(e) => { set("ownerName", e.target.value); setErrors((err) => ({ ...err, ownerName: "" })); }}
                style={{ marginBottom: 14 }}
              />
              {errors.ownerName && <div className={styles.errorMsg} style={{ marginTop: -10, marginBottom: 10 }}>⚠ {errors.ownerName}</div>}

              <label className={styles.label}>Mobile Number</label>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <span style={{ padding: "13px 12px", border: "1.5px solid var(--line)", borderRight: "none", borderRadius: "10px 0 0 10px", fontSize: 16, background: "var(--bg)", color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit number"
                  className={`${styles.input} ${errors.ownerPhone ? styles.inputError : ""}`}
                  style={{ borderRadius: "0 10px 10px 0", borderLeft: "none" }}
                  value={form.ownerPhone}
                  onChange={(e) => { set("ownerPhone", e.target.value.replace(/\D/g, "").slice(0, 10)); setErrors((err) => ({ ...err, ownerPhone: "" })); }}
                />
              </div>
              {errors.ownerPhone && <div className={styles.errorMsg}>⚠ {errors.ownerPhone}</div>}
            </div>

            <div className={styles.section} style={{ background: "rgba(15,118,110,0.04)", border: "1px solid rgba(15,118,110,0.15)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Your number stays private</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
                    Interested people contact you through Prop100. Your personal number is never shown publicly. We&apos;ll send a WhatsApp code to confirm it&apos;s really yours.
                  </div>
                </div>
              </div>
            </div>

            {submitErr && (
              <div style={{ background: "var(--color-danger-light)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 10, color: "var(--color-danger)", fontSize: 14, lineHeight: 1.4 }}>
                {submitErr}
              </div>
            )}

            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => { setErrors({}); setStep(3); }}>← Back</button>
              <button className={styles.btnNext} onClick={sendOtp} disabled={sendingOtp}>
                {sendingOtp ? "Sending…" : "Send OTP →"}
              </button>
            </div>
          </>
        )}

        {/* ═══════════ STEP 4b — Verify OTP ═══════════ */}
        {step === 4 && !uploading && otpSent && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Verify Your Phone</div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 16 }}>
                Code sent to <strong style={{ color: "var(--ink)" }}>+91 {form.ownerPhone}</strong> on WhatsApp. Valid for 10 minutes.
              </p>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                className={styles.input}
                style={{ letterSpacing: 8, fontSize: 22, textAlign: "center" }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
              />
            </div>

            {submitErr && (
              <div style={{ background: "var(--color-danger-light)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 10, color: "var(--color-danger)", fontSize: 14, lineHeight: 1.4 }}>
                {submitErr}
              </div>
            )}

            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => { setOtpSent(false); setSubmitErr(""); }}>← Change number</button>
              <button className={styles.btnNext} onClick={verifyOtpAndSave} disabled={verifyingOtp}>
                {verifyingOtp ? "Verifying…" : "Verify & Submit ✓"}
              </button>
            </div>
            <button
              onClick={sendOtp}
              disabled={sendingOtp || cooldown > 0}
              style={{ display: "block", width: "100%", marginTop: 10, color: "var(--muted)", fontSize: 13, padding: "8px 0", textAlign: "center" }}
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Didn't receive it? Resend OTP"}
            </button>
          </>
        )}

        {/* Upload progress overlay */}
        {uploading && (
          <div className={styles.section} style={{ marginTop: 8 }}>
            <div className={styles.uploadOverlay}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>⬆️</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>Uploading…</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 2 }}>{uploadMsg}</div>
              <div className={styles.uploadBarTrack}>
                <div className={styles.uploadBarFill} style={{ width: `${uploadPct}%` }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary)" }}>
                {Math.round(uploadPct)}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
