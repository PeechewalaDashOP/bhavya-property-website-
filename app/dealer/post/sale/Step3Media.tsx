"use client";

import { useRef } from "react";
import { compressImages } from "@/lib/imageCompress";
import styles from "./styles.module.css";

export type SaleMediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  isCover: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const MAX_PHOTOS = 50;

export default function Step3Media({
  photos,
  setPhotos,
  videos,
  videoNames,
  onAddVideos,
  onRemoveVideo,
  errors,
  compressingVideo,
}: {
  photos: SaleMediaItem[];
  setPhotos: (updater: (m: SaleMediaItem[]) => SaleMediaItem[]) => void;
  videos: File[];
  videoNames: string[];
  onAddVideos: (fl: FileList | null) => void;
  onRemoveVideo: (i: number) => void;
  errors: Record<string, string>;
  compressingVideo?: boolean;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function addPhotos(fl: FileList | null) {
    if (!fl) return;
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    const files = await compressImages(Array.from(fl).slice(0, remaining));
    setPhotos((m) => {
      const isFirstBatch = m.length === 0;
      return [
        ...m,
        ...files.map((file, i) => ({
          id: uid(),
          file,
          previewUrl: URL.createObjectURL(file),
          isCover: isFirstBatch && i === 0,
        })),
      ];
    });
  }

  function removePhoto(id: string) {
    setPhotos((m) => {
      const item = m.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      const next = m.filter((x) => x.id !== id);
      // If the removed photo was the cover, promote the new first photo.
      if (item?.isCover && next.length > 0 && !next.some((x) => x.isCover)) {
        next[0] = { ...next[0], isCover: true };
      }
      return next;
    });
  }

  function setCover(id: string) {
    setPhotos((m) => m.map((x) => ({ ...x, isCover: x.id === id })));
  }

  function move(id: string, dir: -1 | 1) {
    setPhotos((m) => {
      const idx = m.findIndex((x) => x.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= m.length) return m;
      const next = [...m];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Photos</div>
        <div className={styles.cardSub}>At least 1 required — 5 or more recommended. Up to 50 photos.</div>
        <div
          className={`${styles.mediaZone} ${errors.photos ? styles.mediaZoneRequired : ""}`}
          onClick={() => photoInputRef.current?.click()}
        >
          <div style={{ fontSize: 30, marginBottom: 6 }}>📷</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
            {photos.length === 0 ? "Add photos" : `${photos.length} photo${photos.length > 1 ? "s" : ""} — tap to add more`}
          </div>
          {errors.photos && <div className={styles.errorMsg}>{errors.photos}</div>}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }}
        />
        {photos.length > 0 && (
          <div className={styles.mediaGrid}>
            {photos.map((item, i) => (
              <div key={item.id} className={styles.mediaThumb}>
                <img src={item.previewUrl} alt="" />
                {item.isCover && <div className={styles.coverBadge}>★ Cover</div>}
                <button type="button" className={styles.mediaThumbRemove} onClick={() => removePhoto(item.id)}>×</button>
                {!item.isCover && (
                  <button type="button" className={styles.setCoverBtn} onClick={() => setCover(item.id)}>
                    Set as Cover
                  </button>
                )}
                <div className={styles.mediaThumbActions}>
                  <button type="button" className={styles.mediaMoveBtn} disabled={i === 0} onClick={() => move(item.id, -1)}>↑</button>
                  <button type="button" className={styles.mediaMoveBtn} disabled={i === photos.length - 1} onClick={() => move(item.id, 1)}>↓</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Video Tour</span>
          <span style={{ color: "var(--color-danger)", fontWeight: 800, fontSize: 11 }}>REQUIRED</span>
        </div>
        <div className={styles.cardSub}>At least 1 required, up to 3. MP4, MOV, or WEBM.</div>
        <div
          className={`${styles.mediaZone} ${errors.videos ? styles.mediaZoneRequired : ""}`}
          onClick={() => videoInputRef.current?.click()}
        >
          <div style={{ fontSize: 32, marginBottom: 6 }}>🎬</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
            {videos.length === 0 ? "Add video tour" : `${videos.length} video${videos.length > 1 ? "s" : ""} selected — tap to add more`}
          </div>
          {errors.videos && <div className={styles.errorMsg}>{errors.videos}</div>}
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
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
    </>
  );
}
