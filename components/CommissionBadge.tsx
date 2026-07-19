"use client";

/* Buy-side commission trust UI — one file so the 0.25%/0.5% figures can't
   drift out of sync across the places they're shown. If the rate ever
   changes, edit the constants here only.

   CommissionBadge — small pill for the single-property detail page only
   (never on property cards in the listing grid — too repetitive there).

   CommissionCompareSlider — the "Why choose Prop100" premium comparison: a
   real drag-to-compare split panel (traditional broker vs. Prop100), driven
   by a native <input type="range"> laid over the whole card for free
   drag/touch/keyboard support — no custom pointer-event handling needed. */

import { useEffect, useRef, useState } from "react";

const BUYER_PCT = "0.25%";
const SELLER_PCT = "0.5%";

export function CommissionBadge() {
  return <span className="commissionBadge animated">Only {BUYER_PCT} brokerage</span>;
}

const CONS = [
  "Hidden fees & charges",
  "No listing verification",
  "Unverified photos",
  "No dedicated support",
];
const PROS = [
  "Zero hidden costs",
  "Every listing verified",
  "Real photos only",
  "WhatsApp support",
];

// A single stat line with a highlighter-marker sweep behind the text —
// the colored stroke animates in like a highlighter pen, once, the first
// time it scrolls into view. `on` triggers the sweep; `delay` staggers the
// two lines per side so they don't sweep in simultaneously.
function HlBar({ tone, on, delay, children }: { tone: "us" | "them"; on: boolean; delay: number; children: React.ReactNode }) {
  return (
    <div className={`compareTopBar compareTopBar${tone === "us" ? "Us" : "Them"}${on ? " on" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <span className="hlMark" style={{ transitionDelay: `${delay}ms` }} />
      <span className="hlText">{children}</span>
    </div>
  );
}

export function CommissionCompareSlider() {
  const [pct, setPct] = useState(50);
  const [invite, setInvite] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const seenRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // One-time nudge + highlighter sweep the first time this scrolls into
  // view — the sweep itself is gated in a prefers-reduced-motion media
  // query in CSS, so under reduced motion the marks just appear solid.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !seenRef.current) {
          seenRef.current = true;
          setRevealed(true);
          setInvite(true);
          setTimeout(() => setInvite(false), 1600);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="commissionStrip" ref={wrapRef}>
      <h2 className="compareHeadline">The Prop100 Difference</h2>
      <p className="compareSub">Same trust, a fraction of the brokerage</p>

      <div className="compareCard">
        {/* Base layer: Prop100 (teal), full width */}
        <div className="comparePanel comparePanelUs">
          <div className="compareContent">
            <div className="compareLabel compareLabelUs">prop100</div>
            <HlBar tone="us" on={revealed} delay={150}>Only {BUYER_PCT} buyer brokerage</HlBar>
            <HlBar tone="us" on={revealed} delay={400}>Only {SELLER_PCT} seller brokerage</HlBar>
            <ul className="compareList">
              {PROS.map((t) => <li key={t}><span className="tick">✓</span>{t}</li>)}
            </ul>
          </div>
        </div>

        {/* Overlay: Traditional broker (red), clipped to the handle position */}
        <div
          className="comparePanel comparePanelThem"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        >
          <div className="compareContent">
            <div className="compareLabel">TRADITIONAL BROKER</div>
            <HlBar tone="them" on={revealed} delay={150}>1% buyer brokerage</HlBar>
            <HlBar tone="them" on={revealed} delay={400}>1% seller brokerage</HlBar>
            <ul className="compareList">
              {CONS.map((t) => <li key={t}><span className="cross">✗</span>{t}</li>)}
            </ul>
          </div>
        </div>

        {/* Handle */}
        <div className={`compareHandleLine${invite ? " invite" : ""}`} style={{ left: `${pct}%` }}>
          <div className="compareHandleGrip">↔</div>
        </div>

        <input
          type="range"
          min={4}
          max={96}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="compareRange"
          aria-label="Drag to compare a traditional broker with Prop100"
        />

        <div className="compareDragHint">← Drag to Compare →</div>
      </div>
    </section>
  );
}
