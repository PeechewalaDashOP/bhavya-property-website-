"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingBar } from "@/components/LoadingBar";
import { COACHING_HUBS, FEATURES_LIST, PTYPE_ICONS } from "@/lib/constants";
import {
  StandardForm, RENT_PTYPES, SALE_PTYPES, needsBhk, needsFloor,
} from "../types";
import { compressImages } from "@/lib/imageCompress";
import styles from "../styles.module.css";

type Unit = {
  label: string;
  capacity: number;
  price_per_month: string;
  deposit_amount: string;
  total_count: number;
  available_count: number;
  has_ac: boolean;
  has_cooler: boolean;
  attached_bath: boolean;
  meals_included: boolean;
};

function emptyUnit(): Unit {
  return { label: "", capacity: 1, price_per_month: "", deposit_amount: "", total_count: 1, available_count: 1, has_ac: false, has_cooler: false, attached_bath: false, meals_included: false };
}

function uploadFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener("load", () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
    );
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

export default function StandardFlow({
  form,
  setForm,
  localities,
  onCancel,
  onDone,
}: {
  form: StandardForm;
  setForm: (updater: (f: StandardForm) => StandardForm) => void;
  localities: { name: string; slug: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoNames, setVideoNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitErr, setSubmitErr] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const photoUrlsRef = useRef<string[]>([]);
  photoUrlsRef.current = photoUrls;

  // Autosave to a resumable draft — text/selection fields only (photos and
  // videos are File objects, not persisted; re-added if the draft is resumed).
  useEffect(() => {
    if (uploading || done) return;
    const token = localStorage.getItem("prop100_dealer_token");
    if (!token) return;
    const t = setTimeout(() => {
      fetch("/api/dealer/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose: form.purpose, form_data: form }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [form, uploading, done]);

  function set<K extends keyof StandardForm>(k: K, v: StandardForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isRent = form.purpose === "rent";
  const ptypeOptions = isRent ? RENT_PTYPES : SALE_PTYPES;
  const showBhk = needsBhk(form.ptype);
  const showFloor = needsFloor(form.ptype);
  const supportsUnits = isRent && ["Room", "Flat", "House"].includes(form.ptype);

  function addUnit() { setUnits((u) => [...u, emptyUnit()]); }
  function removeUnit(i: number) { setUnits((u) => u.filter((_, j) => j !== i)); }
  function setUnit<K extends keyof Unit>(i: number, k: K, v: Unit[K]) {
    setUnits((u) => u.map((unit, j) => j === i ? { ...unit, [k]: v } : unit));
  }

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
  function addVideos(fl: FileList | null) {
    if (!fl) return;
    const files = Array.from(fl);
    setVideos((v) => [...v, ...files]);
    setVideoNames((n) => [...n, ...files.map((f) => f.name)]);
    setErrors((e) => ({ ...e, videos: "" }));
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

  async function handleSubmit() {
    if (videos.length === 0) {
      setErrors({ videos: "At least 1 video is required — tap the video zone above" });
      return;
    }
    setUploading(true);
    setUploadPct(0);
    setSubmitErr("");

    try {
      const token = localStorage.getItem("prop100_dealer_token");
      if (!token) throw new Error("Session expired — please go back and re-enter your details.");

      const allFiles = [
        ...photos.map((f) => ({ name: f.name, type: f.type, category: "photo" as const })),
        ...videos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
      ];

      setUploadMsg("Preparing upload...");
      const prepRes = await fetch("/api/dealer/property/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ files: allFiles }),
      });
      if (!prepRes.ok) {
        const d = await prepRes.json().catch(() => ({}));
        throw new Error(d.error || "Failed to prepare upload. Check Supabase storage setup.");
      }
      const { files: uploadUrls } = await prepRes.json();

      const photoPaths: string[] = [];
      const videoPaths: string[] = [];
      const allFileObjs = [...photos, ...videos];

      for (let i = 0; i < uploadUrls.length; i++) {
        const { signedUrl, publicUrl } = uploadUrls[i];
        const isPhoto = i < photos.length;
        const num = isPhoto ? i + 1 : i - photos.length + 1;
        setUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${num}…`);
        await uploadFile(signedUrl, allFileObjs[i], (p) => {
          setUploadPct(((i + p) / uploadUrls.length) * 88);
        });
        if (isPhoto) photoPaths.push(publicUrl);
        else videoPaths.push(publicUrl);
      }

      setUploadPct(92);
      setUploadMsg("Saving property…");

      const res = await fetch("/api/dealer/property", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: form.purpose,
          ptype: form.ptype,
          loc: form.loc,
          bhk: showBhk ? form.bhk : 0,
          baths: showBhk ? form.baths : 0,
          price: Number(form.price) || 0,
          rent_per_month: isRent ? Number(form.price) || 0 : null,
          deposit_amount: isRent && form.deposit ? Number(form.deposit) : null,
          sqft: form.sqft ? Number(form.sqft) : null,
          furnishing_status: form.furnishing || null,
          meals_included: false,
          gender_preference: null,
          available_from: isRent && form.availFrom ? form.availFrom : null,
          min_stay_months: isRent && form.minStay ? Number(form.minStay) : null,
          floor_number: showFloor && form.floorNum ? Number(form.floorNum) : null,
          total_floors: showFloor && form.totalFloors ? Number(form.totalFloors) : null,
          attached_bathroom: form.attachedBath,
          parking_available: form.parking,
          wifi_included: form.wifi,
          nearest_coaching_hub: isRent && form.coachingHub ? form.coachingHub : null,
          features: form.features,
          description: form.description,
          photoPaths,
          videoPaths,
          units: units.filter((u) => u.label.trim() && Number(u.price_per_month) > 0).map((u, i) => ({
            ...u,
            price_per_month: Number(u.price_per_month),
            deposit_amount: u.deposit_amount ? Number(u.deposit_amount) : null,
            sort_order: i,
          })),
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save property");
      }

      setUploadPct(100);
      setDone(true);
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "var(--dark)", color: "#fff" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
          </div>
        </div>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 16px 0" }}>
          <div className={styles.success}>
            <div className={styles.successIcon}>🎉</div>
            <div className={styles.successTitle}>Property Submitted!</div>
            <div className={styles.successSub}>
              Bhavya will review your listing and approve it shortly.
              You&apos;ll start getting leads once it&apos;s live on the site.
            </div>
            <button onClick={onDone} className={styles.btnNext} style={{ width: "100%" }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={uploading} />

      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>Post Property</span>
          </div>
          <button onClick={onCancel} style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>Cancel</button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 14px" }}>
        <div className={styles.progress}>
          {[1, 2, 3].map((s, i) => (
            <div key={s} className={styles.progressStep}>
              <div className={`${styles.progressDot} ${step > s ? styles.progressDotDone : step === s ? styles.progressDotActive : ""}`}>
                {step > s ? "✓" : s}
              </div>
              {i < 2 && <div className={`${styles.progressLine} ${step > s ? styles.progressLineDone : ""}`} />}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginBottom: 14, fontWeight: 700 }}>
          {step === 1 ? "Property Basics" : step === 2 ? "Pricing & Details" : "Photos & Video"}
        </div>

        {/* ═══════════ STEP 1 ═══════════ */}
        {step === 1 && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Property Type</div>
              <div className={styles.ptypeGrid}>
                {ptypeOptions.map((pt) => (
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
                {localities.length > 0
                  ? localities.map((l) => <option key={l.slug} value={l.name}>{l.name}</option>)
                  : <option disabled>Loading areas…</option>}
              </select>
              {errors.loc && <div className={styles.errorMsg}>⚠ {errors.loc}</div>}
            </div>

            {showBhk && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Rooms</div>
                <label className={styles.label} style={{ marginBottom: 10 }}>BHK</label>
                <div className={styles.numBtns} style={{ marginBottom: 18 }}>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} className={`${styles.numBtn} ${form.bhk === n ? styles.numBtnActive : ""}`} onClick={() => set("bhk", n)}>
                      {n}
                    </button>
                  ))}
                  <button
                    className={`${styles.numBtn} ${form.bhk === 5 ? styles.numBtnActive : ""}`}
                    style={{ width: "auto", padding: "0 14px" }}
                    onClick={() => set("bhk", 5)}
                  >
                    4+
                  </button>
                </div>
                <label className={styles.label} style={{ marginBottom: 10 }}>Bathrooms</label>
                <div className={styles.numBtns}>
                  {[1, 2, 3].map((n) => (
                    <button key={n} className={`${styles.numBtn} ${form.baths === n ? styles.numBtnActive : ""}`} onClick={() => set("baths", n)}>
                      {n}
                    </button>
                  ))}
                  <button
                    className={`${styles.numBtn} ${form.baths === 4 ? styles.numBtnActive : ""}`}
                    style={{ width: "auto", padding: "0 14px" }}
                    onClick={() => set("baths", 4)}
                  >
                    3+
                  </button>
                </div>
              </div>
            )}

            <div className={styles.navRow}>
              <button className={styles.btnNext} onClick={() => { if (validateStep1()) setStep(2); }}>
                Next: Pricing &amp; Details →
              </button>
            </div>
          </>
        )}

        {/* ═══════════ STEP 2 ═══════════ */}
        {step === 2 && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{isRent ? "Pricing" : "Sale Price"}</div>
              {isRent ? (
                <>
                  <label className={styles.label}>Monthly Rent (₹)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 8000"
                    className={`${styles.input} ${errors.price ? styles.inputError : ""}`}
                    value={form.price}
                    onChange={(e) => { set("price", e.target.value); setErrors({}); }}
                    style={{ marginBottom: 12 }}
                  />
                  <label className={styles.label}>Security Deposit (₹)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 10000"
                    className={styles.input}
                    value={form.deposit}
                    onChange={(e) => set("deposit", e.target.value)}
                  />
                </>
              ) : (
                <>
                  <label className={styles.label}>Sale Price (₹)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 4500000"
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
                type="number"
                inputMode="numeric"
                placeholder="e.g. 350"
                className={styles.input}
                value={form.sqft}
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

            {showFloor && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Floor Info</div>
                <div className={styles.inputRow}>
                  <div>
                    <label className={styles.label}>Floor No.</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="2"
                      className={styles.input}
                      value={form.floorNum}
                      onChange={(e) => set("floorNum", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Total Floors</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="5"
                      className={styles.input}
                      value={form.totalFloors}
                      onChange={(e) => set("totalFloors", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {isRent && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Rental Details</div>
                <label className={styles.label}>Available From</label>
                <input
                  type="date"
                  className={styles.input}
                  value={form.availFrom}
                  onChange={(e) => set("availFrom", e.target.value)}
                  style={{ marginBottom: 14 }}
                />
                <label className={styles.label}>Minimum Stay</label>
                <select
                  className={styles.select}
                  value={form.minStay}
                  onChange={(e) => set("minStay", e.target.value)}
                  style={{ marginBottom: 14 }}
                >
                  <option value="">No minimum</option>
                  <option value="1">1 month</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </select>
                <label className={styles.label}>Nearest Coaching Hub</label>
                <select
                  className={styles.select}
                  value={form.coachingHub}
                  onChange={(e) => set("coachingHub", e.target.value)}
                >
                  <option value="">Select coaching…</option>
                  {COACHING_HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
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

            {supportsUnits && (
              <div className={styles.section}>
                <div className={styles.sectionTitle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>Room / Unit Types</span>
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 12 }}>optional</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
                  Add different room types (e.g. Single AC, Double Cooler, 2BHK Portion). Customers can enquire about specific types.
                </p>
                {units.map((u, i) => (
                  <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "14px", marginBottom: 12, background: "var(--bg)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Room Type {i + 1}</span>
                      <button onClick={() => removeUnit(i)} style={{ color: "var(--red)", fontSize: 18, lineHeight: 1, padding: "0 4px" }}>×</button>
                    </div>
                    <label className={styles.label}>Label (e.g. Single AC, Double Cooler)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Single with AC"
                      value={u.label}
                      onChange={(e) => setUnit(i, "label", e.target.value)}
                      style={{ marginBottom: 10 }}
                    />
                    <div className={styles.inputRow}>
                      <div>
                        <label className={styles.label}>Monthly Rent (₹)</label>
                        <input type="number" inputMode="numeric" className={styles.input} placeholder="8000" value={u.price_per_month} onChange={(e) => setUnit(i, "price_per_month", e.target.value)} />
                      </div>
                      <div>
                        <label className={styles.label}>Deposit (₹)</label>
                        <input type="number" inputMode="numeric" className={styles.input} placeholder="10000" value={u.deposit_amount} onChange={(e) => setUnit(i, "deposit_amount", e.target.value)} />
                      </div>
                    </div>
                    <div className={styles.inputRow} style={{ marginTop: 10 }}>
                      <div>
                        <label className={styles.label}>Persons/room</label>
                        <div className={styles.numBtns}>
                          {[1, 2, 3].map((n) => (
                            <button key={n} className={`${styles.numBtn} ${u.capacity === n ? styles.numBtnActive : ""}`} onClick={() => setUnit(i, "capacity", n)}>{n}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={styles.label}>Total rooms</label>
                        <div className={styles.numBtns}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} className={`${styles.numBtn} ${u.total_count === n ? styles.numBtnActive : ""}`} onClick={() => { setUnit(i, "total_count", n); setUnit(i, "available_count", Math.min(u.available_count, n)); }}>{n}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                      {[
                        { k: "has_ac" as const, label: "AC" },
                        { k: "has_cooler" as const, label: "Cooler" },
                        { k: "attached_bath" as const, label: "Attached Bath" },
                        { k: "meals_included" as const, label: "Meals Incl." },
                      ].map(({ k, label }) => (
                        <button
                          key={k}
                          className={`${styles.chip} ${u[k] ? styles.chipActive : ""}`}
                          onClick={() => setUnit(i, k, !u[k])}
                        >
                          {u[k] ? "✓ " : ""}{label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={addUnit}
                  style={{
                    width: "100%", border: "1.5px dashed var(--line)", borderRadius: 10, padding: "13px",
                    fontSize: 14, fontWeight: 700, color: "var(--color-primary)", background: "rgba(15,118,110,0.04)",
                    cursor: "pointer",
                  }}
                >
                  + Add Room Type
                </button>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.sectionTitle}>Description</div>
              <label className={styles.label}>Tell buyers what makes this special</label>
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
              <button className={styles.btnNext} onClick={() => { if (validateStep2()) setStep(3); }}>
                Next: Add Media →
              </button>
            </div>
          </>
        )}

        {/* ═══════════ STEP 3 ═══════════ */}
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
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => addPhotos(e.target.files)}
              />
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
                <span style={{ color: "var(--red)", fontWeight: 800, fontSize: 11 }}>REQUIRED</span>
              </div>
              <div
                className={`${styles.mediaZone} ${errors.videos ? styles.mediaZoneRequired : ""}`}
                onClick={() => videoRef.current?.click()}
              >
                <div style={{ fontSize: 32, marginBottom: 6 }}>🎬</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)", marginBottom: 3 }}>
                  {videos.length === 0 ? "Add Video Tour" : `${videos.length} video${videos.length > 1 ? "s" : ""} selected — tap to add more`}
                </div>
                <div style={{ fontSize: 13, color: errors.videos ? "var(--red)" : "var(--muted)", fontWeight: errors.videos ? 700 : 400 }}>
                  {errors.videos || "MP4, MOV, WEBM · At least 1 required"}
                </div>
              </div>
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => addVideos(e.target.files)}
              />
              {videoNames.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {videoNames.map((name, i) => (
                    <div key={i} className={styles.videoRow}>
                      <span style={{ fontSize: 20 }}>🎬</span>
                      <span className={styles.videoRowName}>{name}</span>
                      <button onClick={() => removeVideo(i)} className={styles.videoRowRemove}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitErr && (
              <div style={{ background: "var(--color-danger-light)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 10, color: "var(--color-danger)", fontSize: 14, lineHeight: 1.4 }}>
                {submitErr}
              </div>
            )}

            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={() => { setErrors({}); setStep(2); }}>← Back</button>
              <button className={styles.btnNext} onClick={handleSubmit}>
                Submit Property ✓
              </button>
            </div>
          </>
        )}

        {uploading && (
          <div className={styles.section} style={{ marginTop: 8 }}>
            <div className={styles.uploadOverlay}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>⬆️</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>
                Uploading…
              </div>
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
