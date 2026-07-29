"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingBar } from "@/components/LoadingBar";
import { SaleForm } from "./types";
import { validateSaleStep1, validateSaleStep2, validateSaleStep4 } from "./validate";
import Step1Basics from "./Step1Basics";
import Step2Specifications from "./Step2Specifications";
import Step3Media, { SaleMediaItem } from "./Step3Media";
import Step4Publish, { SaleDocument } from "./Step4Publish";
import { compressVideos, validateVideoSize } from "@/lib/videoCompress";
import { uploadFileWithRetry } from "@/lib/upload";
import styles from "./styles.module.css";

const STEP_LABELS = ["Property Basics", "Specifications", "Photos & Video", "Owner Details & Publish"];

export default function SaleFlow({
  form,
  setForm,
  localities,
  sellerPhone,
  onChangeNumber,
  onCancel,
  onDone,
}: {
  form: SaleForm;
  setForm: (updater: (f: SaleForm) => SaleForm) => void;
  localities: { name: string; slug: string }[];
  sellerPhone: string;
  onChangeNumber: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<SaleMediaItem[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [videoNames, setVideoNames] = useState<string[]>([]);
  const [documents, setDocuments] = useState<SaleDocument[]>([]);
  const [compressingVideo, setCompressingVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState(false);

  const photosRef = useRef<SaleMediaItem[]>([]);
  photosRef.current = photos;

  // Autosave — text/selection fields only (photos/videos/documents are File
  // objects, never persisted; re-added if the draft is resumed). Reuses the
  // exact same property_drafts mechanism as Rent/PG — zero backend changes.
  useEffect(() => {
    if (uploading || done) return;
    const t = setTimeout(() => {
      fetch("/api/dealer/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "sale", form_data: form }),
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

  async function addVideos(fl: FileList | null) {
    if (!fl) return;
    const candidates = Array.from(fl).slice(0, Math.max(0, 3 - videos.length));
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
    if (step === 1) {
      e = validateSaleStep1(form);
    } else if (step === 2) {
      e = validateSaleStep2(form);
    } else if (step === 3) {
      if (photos.length === 0) e.photos = "At least 1 photo is required";
      if (videos.length === 0) e.videos = "At least 1 video is required";
    }
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
    const e = validateSaleStep4(form);
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    setUploading(true);
    setUploadPct(0);
    setSubmitErr("");

    try {
      const photoItems = photosRef.current;
      const allFiles = [
        ...photoItems.map((m) => ({ name: m.file.name, type: m.file.type, category: "photo" as const })),
        ...videos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
        ...documents.map((d) => ({ name: d.file.name, type: d.file.type, category: "document" as const })),
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
      const documentResults: { doc_type: string; url: string }[] = [];
      let coverUrl = "";
      const allFileObjs = [...photoItems.map((m) => m.file), ...videos, ...documents.map((d) => d.file)];

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
        const isVideo = !isPhoto && i < photoItems.length + videos.length;
        const label = isPhoto ? "photo" : isVideo ? "video" : "document";
        setUploadMsg(`Uploading ${label}…`);
        await uploadFileWithRetry(
          signedUrl,
          allFileObjs[i],
          (p) => setUploadPct(((i + p) / uploadUrls.length) * 88),
          () => refreshSignedUrl(allFiles[i])
        );
        if (isPhoto) {
          photoPaths.push(publicUrl);
          if (photoItems[i].isCover) coverUrl = publicUrl;
        } else if (isVideo) {
          videoPaths.push(publicUrl);
        } else {
          const docIdx = i - photoItems.length - videos.length;
          documentResults.push({ doc_type: documents[docIdx].docType, url: publicUrl });
        }
      }

      setUploadPct(92);
      setUploadMsg("Saving property…");

      const res = await fetch("/api/dealer/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sale",
          ptype: form.ptype,
          loc: form.loc,
          bhk: form.bhk,
          baths: form.baths,
          price: Number(form.price) || 0,
          sqft: form.areaUnit === "sqft" && form.areaValue ? Number(form.areaValue) : null,
          furnishing_status: form.furnishing || null,
          floor_number: form.floorNum ? Number(form.floorNum) : null,
          total_floors: form.totalFloors ? Number(form.totalFloors) : null,
          parking_available: form.parkingType !== "none",
          description: form.description,
          lat: form.lat,
          lng: form.lng,
          photoPaths: coverUrl ? [coverUrl, ...photoPaths.filter((p) => p !== coverUrl)] : photoPaths,
          videoPaths,
          saleDetails: {
            landmark: form.landmark.trim() || null,
            societyName: form.societyName.trim() || null,
            streetAddress: form.streetAddress.trim() || null,
            balconies: form.balconies,
            houseFloors: form.houseFloors || null,
            plotType: form.plotType || null,
            cabins: form.cabins || null,
            meetingRooms: form.meetingRooms || null,
            officeWashrooms: form.officeWashrooms || null,
            shopWashroom: form.shopWashroom,
            coveredArea: form.coveredArea || null,
            openArea: form.openArea || null,
            truckAccess: form.truckAccess,
            loadingDock: form.loadingDock,
            propertyAge: form.propertyAge || null,
            availabilityStatus: form.availabilityStatus || null,
            possessionDate: form.possessionDate || null,
            priceNegotiable: form.priceNegotiable,
            areaValue: form.areaValue || null,
            areaUnit: form.areaUnit || null,
            floorSpecial: form.floorSpecial || null,
            facing: form.facing || null,
            ownershipType: form.ownershipType || null,
            parkingType: form.parkingType,
            posterRole: form.ownerRole,
            documents: documentResults,
          },
          amenityKeys: form.amenityKeys,
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
              You&apos;ll start getting buyer enquiries once it&apos;s live on the site.
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
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>Post Property — For Sale</span>
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
          <span className={styles.progressCount}>Step {step} of 4</span>
        </div>

        {step === 1 && !uploading && (
          <>
            <Step1Basics form={form} setForm={setForm} localities={localities} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnNext} onClick={goNext}>Next: Specifications →</button>
            </div>
          </>
        )}

        {step === 2 && !uploading && (
          <>
            <Step2Specifications form={form} setForm={setForm} errors={errors} clearError={clearError} />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={goNext}>Next: Photos &amp; Video →</button>
            </div>
          </>
        )}

        {step === 3 && !uploading && (
          <>
            <Step3Media
              photos={photos}
              setPhotos={setPhotos}
              videos={videos}
              videoNames={videoNames}
              onAddVideos={addVideos}
              onRemoveVideo={removeVideo}
              errors={errors}
              compressingVideo={compressingVideo}
            />
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={goNext}>Next: Owner Details →</button>
            </div>
          </>
        )}

        {step === 4 && !uploading && (
          <>
            <Step4Publish
              form={form}
              setForm={setForm}
              sellerPhone={sellerPhone}
              onChangeNumber={onChangeNumber}
              documents={documents}
              setDocuments={setDocuments}
              photos={photos}
              videoCount={videos.length}
              errors={errors}
              clearError={clearError}
              onEditStep={editStep}
            />
            {submitErr && (
              <div style={{ background: "var(--color-danger-light)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 14, padding: "12px 16px", marginTop: 12, marginBottom: 10, color: "var(--color-danger)", fontSize: 14, lineHeight: 1.4 }}>
                {submitErr}
              </div>
            )}
            <div className={styles.navRow}>
              <button className={styles.btnBack} onClick={goBack}>← Back</button>
              <button className={styles.btnNext} onClick={handleSubmit}>Publish Property ✓</button>
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
