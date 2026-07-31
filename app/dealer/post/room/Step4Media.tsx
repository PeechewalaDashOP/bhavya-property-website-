"use client";

import { useRef } from "react";
import { RoomForm, hasKitchen, roomTypeLabel } from "./types";
import { compressImages } from "@/lib/imageCompress";
import styles from "./styles.module.css";

export type RoomMediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  section: string; // building | room | kitchen | washroom | common_area | neighborhood
  isCover: boolean;
};

type SectionDef = { key: string; label: string; required: boolean };

const BASE_SECTIONS: SectionDef[] = [
  { key: "building", label: "Building Photos", required: true },
  { key: "room", label: "Room Photos", required: true },
  { key: "kitchen", label: "Kitchen Photos", required: false },
  { key: "washroom", label: "Washroom Photos", required: false },
  { key: "common_area", label: "Common Area Photos", required: false },
  { key: "neighborhood", label: "Nearby Area Photos", required: false },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Step4Media({
  form,
  media,
  setMedia,
  videos,
  videoNames,
  onAddVideos,
  onRemoveVideo,
  errors,
  compressingVideo,
  onEditStep,
}: {
  form: RoomForm;
  media: RoomMediaItem[];
  setMedia: (updater: (m: RoomMediaItem[]) => RoomMediaItem[]) => void;
  videos: File[];
  videoNames: string[];
  onAddVideos: (fl: FileList | null) => void;
  onRemoveVideo: (i: number) => void;
  errors: Record<string, string>;
  compressingVideo?: boolean;
  onEditStep: (step: number) => void;
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const videoRef = useRef<HTMLInputElement>(null);

  const sections = BASE_SECTIONS.filter((s) => s.key !== "kitchen" || hasKitchen(form));

  async function addPhotos(section: string, fl: FileList | null) {
    if (!fl) return;
    const files = await compressImages(Array.from(fl));
    setMedia((m) => {
      const isFirstEver = m.length === 0;
      return [
        ...m,
        ...files.map((file, i) => ({
          id: uid(),
          file,
          previewUrl: URL.createObjectURL(file),
          section,
          isCover: isFirstEver && i === 0,
        })),
      ];
    });
  }

  function removePhoto(id: string) {
    setMedia((m) => {
      const item = m.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      const next = m.filter((x) => x.id !== id);
      if (item?.isCover && next.length > 0 && !next.some((x) => x.isCover)) {
        next[0] = { ...next[0], isCover: true };
      }
      return next;
    });
  }

  function setCover(id: string) {
    setMedia((m) => m.map((x) => ({ ...x, isCover: x.id === id })));
  }

  function renderSection(s: SectionDef) {
    const items = media.filter((m) => m.section === s.key);
    const errKey = s.key === "building" ? "buildingPhotos" : s.key === "room" ? "roomPhotos" : "";
    return (
      <div key={s.key} className={styles.card}>
        <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{s.label}</span>
          {s.required && <span style={{ color: "var(--color-danger)", fontWeight: 800, fontSize: 11 }}>REQUIRED</span>}
        </div>
        {s.key === "building" && (
          <p className={styles.cardSub}>1 photo required — add a few more for a stronger listing.</p>
        )}
        <div
          className={`${styles.mediaZone} ${errKey && errors[errKey] ? styles.mediaZoneRequired : ""}`}
          onClick={() => fileInputRefs.current[s.key]?.click()}
        >
          <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
            {items.length === 0 ? `Add ${s.label.toLowerCase()}` : `${items.length} photo${items.length > 1 ? "s" : ""} — tap to add more`}
          </div>
        </div>
        {errKey && errors[errKey] && <div className={styles.errorMsg}>{errors[errKey]}</div>}
        <input
          ref={(el) => { fileInputRefs.current[s.key] = el; }}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { addPhotos(s.key, e.target.files); e.target.value = ""; }}
        />
        {items.length > 0 && (
          <div className={styles.mediaGrid}>
            {items.map((item) => (
              <div key={item.id} className={styles.mediaThumb}>
                <img src={item.previewUrl} alt="" />
                {item.isCover && <div className={styles.coverBadge}>★ Cover</div>}
                <button type="button" className={styles.mediaThumbRemove} onClick={() => removePhoto(item.id)}>×</button>
                {!item.isCover && (
                  <button type="button" className={styles.setCoverBtn} onClick={() => setCover(item.id)}>Set as Cover</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const cover = media.find((m) => m.isCover) ?? media[0];
  const orderedCoverPreview = cover ? [cover] : [];

  return (
    <>
      {sections.map(renderSection)}

      <div className={styles.card}>
        <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Video Tour</span>
          <span style={{ color: "var(--color-danger)", fontWeight: 800, fontSize: 11 }}>REQUIRED</span>
        </div>
        <div
          className={`${styles.mediaZone} ${errors.videos ? styles.mediaZoneRequired : ""}`}
          onClick={() => videoRef.current?.click()}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>🎬</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
            {videos.length === 0 ? "Add Video Tour" : `${videos.length} video${videos.length > 1 ? "s" : ""} selected — tap to add more`}
          </div>
        </div>
        {errors.videos && <div className={styles.errorMsg}>{errors.videos}</div>}
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { onAddVideos(e.target.files); e.target.value = ""; }}
        />
        {compressingVideo && (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Checking video size…
          </div>
        )}
        {videoNames.map((name, i) => (
          <div key={i} className={styles.videoRow}>
            <span style={{ fontSize: 20 }}>🎬</span>
            <span className={styles.videoRowName}>{name}</span>
            <button type="button" onClick={() => onRemoveVideo(i)} className={styles.videoRowRemove}>×</button>
          </div>
        ))}
      </div>

      {/* Review summary */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Review Your Listing</div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Property Basics</span>
            <button type="button" className={styles.reviewEditLink} onClick={() => onEditStep(1)}>Edit</button>
          </div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Name</span><span className={styles.reviewRowVal}>{form.propertyName || "—"}</span></div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Location</span><span className={styles.reviewRowVal}>{form.loc || "—"}</span></div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewRowLabel}>Room Types</span>
            <span className={styles.reviewRowVal}>{form.selectedCategories.map(roomTypeLabel).join(", ") || "—"}</span>
          </div>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Rooms</span>
            <button type="button" className={styles.reviewEditLink} onClick={() => onEditStep(2)}>Edit</button>
          </div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Variants</span><span className={styles.reviewRowVal}>{form.rooms.length}</span></div>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Facilities</span>
            <button type="button" className={styles.reviewEditLink} onClick={() => onEditStep(3)}>Edit</button>
          </div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Mess</span><span className={styles.reviewRowVal}>{form.messAvailable ? "Yes" : "No"}</span></div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Description</span><span className={styles.reviewRowVal}>{form.description ? `${form.description.slice(0, 40)}…` : "—"}</span></div>
        </div>

        <div className={styles.reviewSection} style={{ marginBottom: 0 }}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Photos &amp; Video</span>
          </div>
          {orderedCoverPreview.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {orderedCoverPreview.map((p) => (
                <div key={p.id} style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", background: "var(--line)" }}>
                  <img src={p.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Total Photos</span><span className={styles.reviewRowVal}>{media.length}</span></div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Videos</span><span className={styles.reviewRowVal}>{videos.length}</span></div>
        </div>
      </div>
    </>
  );
}
