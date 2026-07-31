"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingBar } from "@/components/LoadingBar";
import { RoomForm, roomTypeLabel, roomTypeCapacity } from "./types";
import { validateRoomStep1, validateRoomStep2, validateRoomStep3 } from "./validate";
import Step1Basics from "./Step1Basics";
import Step2RoomConfig from "./Step2RoomConfig";
import Step3Facilities from "./Step3Facilities";
import Step4Media, { RoomMediaItem } from "./Step4Media";
import { compressVideos, validateVideoSize } from "@/lib/videoCompress";
import { uploadFileWithRetry } from "@/lib/upload";
import styles from "./styles.module.css";

const STEP_LABELS = ["Property Basics", "Room Configuration & Pricing", "Facilities & Rules", "Photos & Publish"];

export default function RoomFlow({
  form,
  setForm,
  localities,
  onCancel,
  onDone,
}: {
  form: RoomForm;
  setForm: (updater: (f: RoomForm) => RoomForm) => void;
  localities: { name: string; slug: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<RoomMediaItem[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [videoNames, setVideoNames] = useState<string[]>([]);
  const [compressingVideo, setCompressingVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const mediaRef = useRef<RoomMediaItem[]>([]);
  mediaRef.current = media;

  // Autosave — reuses the exact property_drafts mechanism as Rent/Sale/PG.
  // purpose is "rent" (this is fundamentally a rent listing), distinguished
  // from a plain Flat/House rent draft on resume by form_data.ptype
  // (set implicitly to "Room" server-side at submit — see PostPropertyClient
  // resumeDraft(), which checks the form itself, not a ptype field here,
  // since RoomForm has no ptype field of its own — it's always "Room").
  useEffect(() => {
    if (uploading || done) return;
    const t = setTimeout(() => {
      fetch("/api/dealer/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "rent", form_data: { ...form, __roomFlow: true } }),
      })
        .then(() => { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2000); })
        .catch(() => {});
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

  async function addVideos(fl: FileList | null) {
    if (!fl) return;
    const candidates = Array.from(fl);
    const oversized = candidates.map(validateVideoSize).find(Boolean);
    if (oversized) { setErrors((e) => ({ ...e, videos: oversized })); return; }

    clearError("videos");
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

  function goNext() {
    let e: Record<string, string> = {};
    if (step === 1) e = validateRoomStep1(form);
    else if (step === 2) e = validateRoomStep2(form);
    else if (step === 3) e = validateRoomStep3(form);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, 4));
  }
  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  }
  function editStep(s: number) {
    setErrors({});
    setStep(s);
  }

  async function handleSubmit() {
    const e: Record<string, string> = {};
    const buildingCount = mediaRef.current.filter((m) => m.section === "building").length;
    const roomCount = mediaRef.current.filter((m) => m.section === "room").length;
    if (buildingCount === 0) e.buildingPhotos = "At least 1 building photo is required";
    if (roomCount === 0) e.roomPhotos = "At least 1 room photo is required";
    if (videos.length === 0) e.videos = "At least 1 video is required";
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setUploading(true);
    setUploadPct(0);
    setSubmitErr("");

    try {
      const photoItems = mediaRef.current;
      const allFiles = [
        ...photoItems.map((m) => ({ name: m.file.name, type: m.file.type, category: "photo" as const })),
        ...videos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
      ];

      setUploadMsg("Preparing upload…");
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

      const refreshSignedUrl = async (meta: (typeof allFiles)[number]) => {
        const r = await fetch("/api/dealer/property/prepare-upload", {
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
        const isPhoto = i < photoItems.length;
        const num = isPhoto ? i + 1 : i - photoItems.length + 1;
        setUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${num}…`);
        await uploadFileWithRetry(
          signedUrl,
          allFileObjs[i],
          (p) => setUploadPct(((i + p) / uploadUrls.length) * 88),
          () => refreshSignedUrl(allFiles[i])
        );
        if (isPhoto) {
          photoPaths.push(publicUrl);
          const item = photoItems[i];
          // Reuses the exact (tag, section) vocabulary PropertyDetail.tsx's
          // gallery category tabs already understand (photoBucket()) — no
          // display-layer changes needed for these to bucket correctly.
          if (item.section === "room") photoTagMap[publicUrl] = "room";
          else if (item.section === "washroom") photoTagMap[publicUrl] = "toilet";
          else photoSectionMap[publicUrl] = item.section;
          if (item.isCover) coverUrl = publicUrl;
        } else {
          videoPaths.push(publicUrl);
        }
      }

      setUploadPct(92);
      setUploadMsg("Saving property…");

      const genderMap: Record<string, string> = { male: "boys", female: "girls", both: "any" };
      const validRooms = form.rooms.filter((r) => Number(r.rentPerMonth) > 0 && Number(r.totalRooms) > 0);
      const cheapest = validRooms.reduce(
        (a, b) => (Number(a.rentPerMonth) <= Number(b.rentPerMonth) ? a : b),
        validRooms[0]
      );

      const units = validRooms.map((r, i) => ({
        label: r.variantName.trim() ? `${roomTypeLabel(r.key)} — ${r.variantName.trim()}` : roomTypeLabel(r.key),
        capacity: roomTypeCapacity(r.key),
        price_per_month: Number(r.rentPerMonth),
        deposit_amount: r.deposit ? Number(r.deposit) : null,
        total_count: Number(r.totalRooms),
        available_count: Number(r.totalRooms),
        has_ac: r.coolingType === "ac",
        has_cooler: r.coolingType === "cooler",
        attached_bath: r.attachedBathroom,
        meals_included: form.messAvailable,
        sort_order: i,
        attributes: {
          occupancy: r.key,
          cooling: r.coolingType || "none",
          facilities: r.furniture,
          kitchen: r.kitchen,
          balcony: r.balcony,
          furnished: r.furnished,
          variant_name: r.variantName.trim() || null,
        },
      }));

      const ownerPhoneDigits = form.ownerPhone.replace(/\D/g, "");
      const servicesList = [
        ...(form.laundry ? ["laundry"] : []),
        ...(form.housekeeping ? ["cleaning"] : []),
      ];
      const commonAmenitiesList = [
        ...(form.roWater ? ["ro"] : []),
        ...(form.cctv ? ["cctv"] : []),
      ];
      const parkingTypesMapped = form.parkingTypes.map((p) => (p === "bike_cycle" ? "two_wheeler" : "car"));

      const res = await fetch("/api/dealer/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "rent",
          ptype: "Room",
          loc: form.loc,
          bhk: 0,
          baths: 0,
          price: Number(cheapest?.rentPerMonth) || 0,
          rent_per_month: Number(cheapest?.rentPerMonth) || 0,
          deposit_amount: cheapest?.deposit ? Number(cheapest.deposit) : null,
          sqft: null,
          furnishing_status: null,
          meals_included: form.messAvailable,
          gender_preference: genderMap[form.targetGender] ?? "any",
          available_from: null,
          min_stay_months: null,
          floor_number: null,
          total_floors: null,
          attached_bathroom: units.some((u) => u.attached_bath),
          parking_available: form.parkingTypes.length > 0,
          wifi_included: false,
          nearest_coaching_hub: form.coachingHub || null,
          features: [],
          description: form.description,
          lat: form.lat,
          lng: form.lng,
          owner: ownerPhoneDigits.length === 10
            ? { name: form.ownerName.trim(), phone: ownerPhoneDigits, whatsapp: form.ownerHasWhatsapp }
            : null,
          photoPaths: coverUrl ? [coverUrl, ...photoPaths.filter((p) => p !== coverUrl)] : photoPaths,
          videoPaths,
          units,
          hostel_meta: {
            pg_name: form.propertyName.trim(),
            user_type: form.userType,
            address: form.address.trim(),
            pincode: form.pincode || null,
            landmark: form.landmark.trim() || null,
            operational_since: form.operationalSince || null,
            room_categories: form.selectedCategories,
            target_gender: form.targetGender,
            tenant_types: form.tenantTypes,
            house_rules: form.houseRules,
            gate_timing_enabled: !form.gateAlwaysOpen,
            gate_closing_time: !form.gateAlwaysOpen ? form.gateClosingTime : null,
            services: servicesList,
            food_provided: form.messAvailable,
            mess_meals: form.messMeals,
            mess_type: form.messType || null,
            electricity: form.electricity || null,
            common_amenities: commonAmenitiesList,
            parking_enabled: form.parkingTypes.length > 0,
            parking_types: parkingTypesMapped,
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
      <div className={styles.page}>
        <div className={styles.topbar}>
          <div className={styles.topbarInner}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
          </div>
        </div>
        <div className={styles.shell} style={{ paddingTop: 16 }}>
          <div className={styles.success}>
            <div className={styles.successIcon}>🎉</div>
            <div className={styles.successTitle}>Listing Submitted!</div>
            <div className={styles.successSub}>
              Bhavya will review your listing and approve it shortly.
              You&apos;ll start getting enquiries once it&apos;s live on the site.
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
    <div className={styles.page}>
      <LoadingBar loading={uploading} />
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>Post Room (PG)</span>
          </div>
          <button onClick={onCancel} style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>

      <div className={styles.shell}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${(step / 4) * 100}%` }} />
        </div>
        <div className={styles.progressMeta}>
          <span className={styles.progressStepLabel}>{STEP_LABELS[step - 1]}</span>
          <span className={styles.progressCount}>
            Step {step} of 4
            <span className={`${styles.draftSaved} ${draftSaved ? styles.draftSavedVisible : ""}`} style={{ marginLeft: 10 }}>
              ✓ Draft Saved
            </span>
          </span>
        </div>

        {step === 1 && !uploading && (
          <>
            <Step1Basics form={form} setForm={setForm} localities={localities} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnNext} onClick={goNext}>Next: Room Configuration →</button>
            </div>
          </>
        )}

        {step === 2 && !uploading && (
          <>
            <Step2RoomConfig form={form} setForm={setForm} errors={errors} />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={goNext}>Next: Facilities &amp; Rules →</button>
            </div>
          </>
        )}

        {step === 3 && !uploading && (
          <>
            <Step3Facilities form={form} setForm={setForm} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={goNext}>Next: Photos &amp; Publish →</button>
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
              compressingVideo={compressingVideo}
              onEditStep={editStep}
            />
            {submitErr && (
              <div style={{ background: "var(--color-danger-light)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 14, padding: "12px 16px", marginTop: 12, marginBottom: 10, color: "var(--color-danger)", fontSize: 14, lineHeight: 1.4 }}>
                {submitErr}
              </div>
            )}
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={handleSubmit}>Publish Listing ✓</button>
            </div>
          </>
        )}

        {uploading && (
          <div className={styles.card}>
            <div className={styles.uploadOverlay}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>⬆️</div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>Publishing…</div>
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
