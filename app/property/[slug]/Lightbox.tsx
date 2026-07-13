"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./styles.module.css";

export type LightboxItem = { url: string; type: "photo" | "video"; caption?: string | null };

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.75;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_THRESHOLD = 50;
const DOUBLE_TAP_MS = 300;

function distance(touches: React.TouchList): number {
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

// Amazon/Flipkart-style full-screen media viewer: pinch/double-tap/wheel to
// zoom, drag to pan while zoomed, swipe (or arrow buttons) to move between
// photos and videos in one unified list.
export default function Lightbox({
  items,
  startIndex,
  onClose,
}: {
  items: LightboxItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const pinchState = useRef<{ startDist: number; startZoom: number } | null>(null);
  const swipeState = useRef<{ startX: number; startY: number } | null>(null);
  const lastTapRef = useRef(0);

  const item = items[index];

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  useEffect(resetZoom, [index]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  function go(dir: number) {
    setIndex((i) => (i + dir + items.length) % items.length);
  }

  function zoomBy(delta: number) {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }

  function toggleDoubleTapZoom() {
    setZoom((z) => (z > 1 ? 1 : DOUBLE_TAP_ZOOM));
    setPan({ x: 0, y: 0 });
  }

  function onTouchStart(e: React.TouchEvent) {
    if (item.type !== "photo") return;
    if (e.touches.length === 2) {
      pinchState.current = { startDist: distance(e.touches), startZoom: zoom };
      dragState.current = null;
      swipeState.current = null;
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      toggleDoubleTapZoom();
      return;
    }
    lastTapRef.current = now;
    if (zoom > 1) {
      dragState.current = { startX: t.clientX, startY: t.clientY, panX: pan.x, panY: pan.y };
    } else {
      swipeState.current = { startX: t.clientX, startY: t.clientY };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (item.type !== "photo") return;
    if (e.touches.length === 2 && pinchState.current) {
      const d = distance(e.touches);
      const scale = d / pinchState.current.startDist;
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchState.current.startZoom * scale)));
      return;
    }
    if (e.touches.length === 1 && dragState.current) {
      const t = e.touches[0];
      setPan({
        x: dragState.current.panX + (t.clientX - dragState.current.startX),
        y: dragState.current.panY + (t.clientY - dragState.current.startY),
      });
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    pinchState.current = null;
    dragState.current = null;
    if (swipeState.current && zoom <= 1 && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - swipeState.current.startX;
      const dy = t.clientY - swipeState.current.startY;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }
    swipeState.current = null;
  }

  function onWheel(e: React.WheelEvent) {
    if (item.type !== "photo") return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
  }

  return (
    <div
      className={styles.lightboxOverlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.lightboxTop}>
        <button className={styles.lightboxClose} onClick={onClose} aria-label="Close">×</button>
        <div className={styles.lightboxCounter}>{index + 1} / {items.length}</div>
      </div>

      <div
        className={styles.lightboxStage}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {items.length > 1 && (
          <button
            className={`${styles.lightboxNav} ${styles.lightboxNavLeft}`}
            onClick={() => go(-1)}
            aria-label="Previous"
          >
            ‹
          </button>
        )}

        {item.type === "photo" ? (
          <img
            className={styles.lightboxImg}
            src={item.url}
            alt={item.caption ?? ""}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            draggable={false}
            onDoubleClick={toggleDoubleTapZoom}
          />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video key={item.url} className={styles.lightboxVideo} src={item.url} controls playsInline autoPlay />
        )}

        {items.length > 1 && (
          <button
            className={`${styles.lightboxNav} ${styles.lightboxNavRight}`}
            onClick={() => go(1)}
            aria-label="Next"
          >
            ›
          </button>
        )}
      </div>

      {item.caption && <div className={styles.lightboxCaption}>{item.caption}</div>}

      {item.type === "photo" && (
        <div className={styles.lightboxZoomControls}>
          <button onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in">+</button>
          <button onClick={() => zoomBy(-ZOOM_STEP)} aria-label="Zoom out">−</button>
          <button onClick={resetZoom} aria-label="Reset zoom">↺</button>
        </div>
      )}
    </div>
  );
}
