"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingBar } from "@/components/LoadingBar";
import {
  HostelForm, roomCategoryLabel, roomCategoryCapacity,
} from "../types";
import { validateHostelStep1, validateHostelStep2, validateHostelStep3 } from "./validate";
import Step1Core from "./Step1Core";
import Step2Rooms from "./Step2Rooms";
import Step3Amenities from "./Step3Amenities";
import Step4Media, { MediaItem } from "./Step4Media";
import styles from "../styles.module.css";

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

const STEP_LABELS = ["Core Details", "Rooms & Rules", "Amenities", "Media & Review"];

export default function HostelFlow({
  form,
  setForm,
  localities,
  onCancel,
  onDone,
}: {
  form: HostelForm;
  setForm: (updater: (f: HostelForm) => HostelForm) => void;
  localities: { name: string; slug: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [videoNames, setVideoNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState(false);

  const mediaRef = useRef<MediaItem[]>([]);
  mediaRef.current = media;

  // Autosave to a resumable draft — text/selection fields only (photos and
  // videos are File objects, not persisted; re-added if the draft is resumed).
  useEffect(() => {
    if (uploading || done) return;
    const t = setTimeout(() => {
      fetch("/api/dealer/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "pg", form_data: form }),
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [form, uploading, done]);

  function clearError(k: string) {
    setErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  }

  function addVideos(fl: FileList | null) {
    if (!fl) return;
    const files = Array.from(fl);
    setVideos((v) => [...v, ...files]);
    setVideoNames((n) => [...n, ...files.map((f) => f.name)]);
    clearError("videos");
  }
  function removeVideo(i: number) {
    setVideos((v) => v.filter((_, j) => j !== i));
    setVideoNames((n) => n.filter((_, j) => j !== i));
  }

  function goNext() {
    let e: Record<string, string> = {};
    if (step === 1) e = validateHostelStep1(form);
    else if (step === 2) e = validateHostelStep2(form);
    else if (step === 3) e = validateHostelStep3(form);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, 4));
  }
  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
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
      const photoItems = mediaRef.current;
      const allFiles = [
        ...photoItems.map((m) => ({ name: m.file.name, type: m.file.type, category: "photo" as const })),
        ...videos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
      ];

      setUploadMsg("Preparing upload...");
      const prepRes = await fetch("/api/dealer/property/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: allFiles }),
      });
      if (!prepRes.ok) {
        const d = await prepRes.json().catch(() => ({}));
        throw new Error(d.error || "Failed to prepare upload. Check Supabase storage setup.");
      }
      const { files: uploadUrls } = await prepRes.json();

      const photoPaths: string[] = [];
      const videoPaths: string[] = [];
      const photoTagMap: Record<string, string> = {};
      const photoSectionMap: Record<string, string> = {};
      let coverUrl = "";
      const allFileObjs = [...photoItems.map((m) => m.file), ...videos];

      for (let i = 0; i < uploadUrls.length; i++) {
        const { signedUrl, publicUrl } = uploadUrls[i];
        const isPhoto = i < photoItems.length;
        const num = isPhoto ? i + 1 : i - photoItems.length + 1;
        setUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${num}…`);
        await uploadFile(signedUrl, allFileObjs[i], (p) => {
          setUploadPct(((i + p) / uploadUrls.length) * 88);
        });
        if (isPhoto) {
          photoPaths.push(publicUrl);
          const item = photoItems[i];
          photoTagMap[publicUrl] = item.tag;
          photoSectionMap[publicUrl] = item.section;
          if (item.isCover) coverUrl = publicUrl;
        } else {
          videoPaths.push(publicUrl);
        }
      }

      setUploadPct(92);
      setUploadMsg("Saving property…");

      // Cheapest room drives the headline price/deposit shown on cards & SEO.
      const validRooms = form.rooms.filter((r) => Number(r.rentPerBed) > 0 && Number(r.numRooms) > 0);
      const cheapest = validRooms.reduce(
        (a, b) => (Number(a.rentPerBed) <= Number(b.rentPerBed) ? a : b),
        validRooms[0]
      );

      const genderMap: Record<string, string> = { male: "boys", female: "girls", both: "any" };

      const coolingSuffix: Record<string, string> = { ac: " — AC", cooler: " — Cooler", none: "" };
      const units = validRooms.map((r, i) => ({
        label: `${roomCategoryLabel(r)} Room${coolingSuffix[r.coolingType] ?? ""}`,
        capacity: roomCategoryCapacity(r),
        price_per_month: Number(r.rentPerBed),
        deposit_amount: r.deposit ? Number(r.deposit) : null,
        total_count: Number(r.numRooms),
        available_count: Number(r.numRooms),
        has_ac: r.coolingType === "ac",
        has_cooler: r.coolingType === "cooler",
        attached_bath: r.facilities.includes("washroom"),
        meals_included: Boolean(r.messIncluded),
        sort_order: i,
        attributes: {
          occupancy: r.key,
          cooling: r.coolingType,
          facilities: r.facilities,
        },
      }));

      const ownerPhoneDigits = form.ownerPhone.replace(/\D/g, "");

      const featureLabels = form.commonAmenities.length > 0 ? form.commonAmenities : [];

      const res = await fetch("/api/dealer/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rent",
          ptype: form.pgKind,
          loc: form.loc,
          bhk: 0,
          baths: 0,
          price: Number(cheapest?.rentPerBed) || 0,
          rent_per_month: Number(cheapest?.rentPerBed) || 0,
          deposit_amount: cheapest?.deposit ? Number(cheapest.deposit) : null,
          sqft: null,
          furnishing_status: null,
          meals_included: form.foodProvided,
          gender_preference: genderMap[form.targetGender] ?? "any",
          available_from: form.availFrom || null,
          min_stay_months: form.minStay ? Number(form.minStay) : null,
          floor_number: /^\d+$/.test(form.presentOnFloor.trim()) ? Number(form.presentOnFloor.trim()) : null,
          total_floors: null,
          attached_bathroom: units.some((u) => u.attached_bath),
          parking_available: form.parkingEnabled,
          wifi_included: form.commonAmenities.includes("wifi"),
          nearest_coaching_hub: form.coachingHub || null,
          features: featureLabels,
          description: form.description,
          lat: form.lat,
          lng: form.lng,
          // Leads route to the owner's number: server find-or-creates a dealer
          // row for this phone and attaches the listing to it (not to the
          // logged-in collector). Omitted = current behaviour.
          owner: ownerPhoneDigits.length === 10
            ? { name: form.ownerName.trim(), phone: ownerPhoneDigits, whatsapp: form.ownerHasWhatsapp }
            : null,
          photoPaths: coverUrl ? [coverUrl, ...photoPaths.filter((p) => p !== coverUrl)] : photoPaths,
          videoPaths,
          units,
          hostel_meta: {
            pg_name: form.pgName.trim(),
            user_type: form.userType,
            address: form.address.trim(),
            pincode: form.pincode || null,
            landmark: form.landmark.trim() || null,
            operational_since: form.operationalSince || null,
            present_on_floor: form.presentOnFloor.trim() || null,
            room_categories: form.roomCategories,
            target_gender: form.targetGender,
            tenant_types: form.tenantTypes,
            house_rules: form.houseRules,
            notice_period: form.noticePeriod,
            gate_timing_enabled: form.gateTimingEnabled,
            gate_closing_time: form.gateTimingEnabled ? form.gateClosingTime : null,
            services: form.services,
            food_provided: form.foodProvided,
            electricity: form.electricity || null,
            common_amenities: form.commonAmenities,
            parking_enabled: form.parkingEnabled,
            parking_types: form.parkingTypes,
            usp_category: form.uspCategory || null,
            usp_text: form.uspText.trim() || null,
            photo_tags: photoTagMap,
            photo_sections: photoSectionMap,
          },
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
            <div className={styles.successTitle}>{form.pgKind} Submitted!</div>
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
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>Post {form.pgKind}</span>
          </div>
          <button onClick={onCancel} style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>Cancel</button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 14px" }}>
        {/* Step progress — 4 steps */}
        <div className={styles.progress}>
          {[1, 2, 3, 4].map((s, i) => (
            <div key={s} className={styles.progressStep}>
              <div className={`${styles.progressDot} ${step > s ? styles.progressDotDone : step === s ? styles.progressDotActive : ""}`}>
                {step > s ? "✓" : s}
              </div>
              {i < 3 && <div className={`${styles.progressLine} ${step > s ? styles.progressLineDone : ""}`} />}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", marginBottom: 14, fontWeight: 700 }}>
          {STEP_LABELS[step - 1]}
        </div>

        {step === 1 && (
          <>
            <Step1Core form={form} setForm={setForm} localities={localities} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnNext} onClick={goNext}>Next: Rooms &amp; Rules →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Step2Rooms form={form} setForm={setForm} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={goNext}>Next: Amenities →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Step3Amenities form={form} setForm={setForm} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={goNext}>Next: Media &amp; Review →</button>
            </div>
          </>
        )}

        {step === 4 && !uploading && (
          <>
            <Step4Media
              form={form}
              media={media}
              setMedia={setMedia}
              videos={videos}
              videoNames={videoNames}
              onAddVideos={addVideos}
              onRemoveVideo={removeVideo}
              errors={errors}
            />
            {submitErr && (
              <div style={{ background: "var(--color-danger-light)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 10, color: "var(--color-danger)", fontSize: 14, lineHeight: 1.4 }}>
                {submitErr}
              </div>
            )}
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={handleSubmit}>Submit {form.pgKind} ✓</button>
            </div>
          </>
        )}

        {uploading && (
          <div className={styles.section} style={{ marginTop: 8 }}>
            <div className={styles.uploadOverlay}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>⬆️</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>Uploading…</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 2 }}>{uploadMsg}</div>
              <div className={styles.uploadBarTrack}>
                <div className={styles.uploadBarFill} style={{ width: `${uploadPct}%` }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary)" }}>{Math.round(uploadPct)}%</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
