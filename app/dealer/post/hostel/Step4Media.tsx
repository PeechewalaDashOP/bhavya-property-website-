"use client";

import { useRef } from "react";
import {
  HostelForm, MEDIA_SECTIONS, PHOTO_TAGS, roomCategoryLabel,
} from "../types";
import styles from "../styles.module.css";

export type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  section: string;      // one of MEDIA_SECTIONS keys, or a room category key, or "video"
  tag: string;           // PHOTO_TAGS value
  isCover: boolean;
};

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
}: {
  form: HostelForm;
  media: MediaItem[];
  setMedia: (updater: (m: MediaItem[]) => MediaItem[]) => void;
  videos: File[];
  videoNames: string[];
  onAddVideos: (fl: FileList | null) => void;
  onRemoveVideo: (i: number) => void;
  errors: Record<string, string>;
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const videoRef = useRef<HTMLInputElement>(null);

  function addPhotosToSection(section: string, fl: FileList | null) {
    if (!fl) return;
    const files = Array.from(fl);
    setMedia((m) => [
      ...m,
      ...files.map((file) => ({
        id: uid(),
        file,
        previewUrl: URL.createObjectURL(file),
        section,
        tag: "room",
        isCover: false,
      })),
    ]);
  }

  function removeMedia(id: string) {
    setMedia((m) => {
      const item = m.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return m.filter((x) => x.id !== id);
    });
  }

  function setCover(id: string) {
    setMedia((m) => m.map((x) => ({ ...x, isCover: x.id === id })));
  }

  function setTag(id: string, tag: string) {
    setMedia((m) => m.map((x) => (x.id === id ? { ...x, tag } : x)));
  }

  const roomSections = form.roomCategories.map((key) => ({
    key,
    label: `${roomCategoryLabel(form.rooms.find((r) => r.key === key) ?? { key, customLabel: "", numRooms: "", rentPerBed: "", deposit: "", facilities: [] })} Room`,
    icon: "🛏️",
  }));

  const allSections = [...MEDIA_SECTIONS, ...roomSections];

  function renderSection(section: { key: string; label: string; icon: string }) {
    const items = media.filter((m) => m.section === section.key);
    return (
      <div key={section.key} className={styles.section}>
        <div className={styles.sectionTitle}>
          {section.icon} {section.label}
        </div>
        <div
          className={styles.mediaZone}
          onClick={() => fileInputRefs.current[section.key]?.click()}
        >
          <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
            {items.length === 0 ? `Add ${section.label} photos` : `${items.length} photo${items.length > 1 ? "s" : ""} — tap to add more`}
          </div>
        </div>
        <input
          ref={(el) => { fileInputRefs.current[section.key] = el; }}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => { addPhotosToSection(section.key, e.target.files); e.target.value = ""; }}
        />
        {items.length > 0 && (
          <div className={styles.mediaGridTagged}>
            {items.map((item) => (
              <div key={item.id} className={styles.mediaThumbTagged}>
                <div className={styles.mediaThumbImgWrap}>
                  <img src={item.previewUrl} alt="" />
                  {item.isCover && <div className={styles.coverBadge}>★ Cover</div>}
                  <button className={styles.mediaThumbRemove} onClick={() => removeMedia(item.id)}>×</button>
                  {!item.isCover && (
                    <button className={styles.setCoverBtn} onClick={() => setCover(item.id)}>
                      Set as Cover
                    </button>
                  )}
                </div>
                <select
                  className={styles.tagSelect}
                  value={item.tag}
                  onChange={(e) => setTag(item.id, e.target.value)}
                >
                  {PHOTO_TAGS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {allSections.map(renderSection)}

      {/* Video — required, same as standard flow */}
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
          onChange={(e) => { onAddVideos(e.target.files); e.target.value = ""; }}
        />
        {videoNames.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {videoNames.map((name, i) => (
              <div key={i} className={styles.videoRow}>
                <span style={{ fontSize: 20 }}>🎬</span>
                <span className={styles.videoRowName}>{name}</span>
                <button onClick={() => onRemoveVideo(i)} className={styles.videoRowRemove}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
