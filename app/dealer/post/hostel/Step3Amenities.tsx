"use client";

import { useMemo } from "react";
import {
  HostelForm,
  COMMON_AMENITIES, PARKING_TYPES, USP_CATEGORIES,
  ROOM_FACILITIES, HOUSE_RULES,
  roomCategoryLabel,
} from "../types";
import styles from "../styles.module.css";

const MIN_DESC_LEN = 100;

/* Template-based "AI" description generator — reads straight from
   form state, zero external API calls, zero cost. */
function buildSamples(f: HostelForm): [string, string] {
  const kind = f.pgKind;
  const name = f.pgName.trim() || `Our ${kind}`;
  const loc = f.loc || "Kota";
  const gender = f.targetGender === "male" ? "boys" : f.targetGender === "female" ? "girls" : "boys and girls";
  const coaching = f.coachingHub ? ` near ${f.coachingHub}` : "";
  const roomLabels = f.rooms.map(roomCategoryLabel).join(", ") || "single and sharing";
  const amenityLabels = f.commonAmenities
    .map((k) => COMMON_AMENITIES.find((a) => a.key === k)?.label)
    .filter(Boolean)
    .slice(0, 4);
  const facilityLabels = Array.from(
    new Set(f.rooms.flatMap((r) => r.facilities))
  )
    .map((k) => ROOM_FACILITIES.find((x) => x.key === k)?.label)
    .filter(Boolean)
    .slice(0, 4);
  const ruleLabels = f.houseRules
    .map((k) => HOUSE_RULES.find((r) => r.key === k)?.label)
    .filter(Boolean);

  const sample1 =
    `${name} is a well-maintained ${kind.toLowerCase()} for ${gender}${coaching} in ${loc}, Kota. ` +
    `We offer ${roomLabels} room options` +
    (facilityLabels.length ? ` with ${facilityLabels.join(", ").toLowerCase()}.` : ".") +
    (f.foodProvided ? " Home-style meals are provided daily." : "") +
    (amenityLabels.length ? ` Residents also get access to ${amenityLabels.join(", ").toLowerCase()}.` : "") +
    ` Contact us to schedule a visit.`;

  const sample2 =
    `Looking for a safe and comfortable ${kind.toLowerCase()} in ${loc}? ${name} offers ${roomLabels} rooms` +
    coaching + `, ideal for ${gender}.` +
    (ruleLabels.length ? ` We maintain a disciplined environment — ${ruleLabels.join(", ").toLowerCase()}.` : "") +
    (f.services.length ? ` Services include ${f.services.join(", ")}.` : "") +
    ` Book a visit today and experience the difference.`;

  return [sample1, sample2];
}

export default function Step3Amenities({
  form,
  setForm,
  errors,
  clearError,
}: {
  form: HostelForm;
  setForm: (updater: (f: HostelForm) => HostelForm) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  function set<K extends keyof HostelForm>(k: K, v: HostelForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k as string);
  }

  function toggleAmenity(key: string) {
    setForm((f) => ({
      ...f,
      commonAmenities: f.commonAmenities.includes(key)
        ? f.commonAmenities.filter((x) => x !== key)
        : [...f.commonAmenities, key],
    }));
  }

  function toggleParkingType(key: string) {
    setForm((f) => ({
      ...f,
      parkingTypes: f.parkingTypes.includes(key)
        ? f.parkingTypes.filter((x) => x !== key)
        : [...f.parkingTypes, key],
    }));
  }

  const samples = useMemo(() => buildSamples(form), [form]);
  const descLen = form.description.trim().length;
  const descOk = descLen >= MIN_DESC_LEN;

  return (
    <>
      {/* ── Common amenities ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Common Area Amenities</div>
        <div className={styles.amenityCheckGrid}>
          {COMMON_AMENITIES.map((a) => {
            const on = form.commonAmenities.includes(a.key);
            return (
              <button
                key={a.key}
                className={`${styles.amenityCheck} ${on ? styles.amenityCheckActive : ""}`}
                onClick={() => toggleAmenity(a.key)}
                aria-pressed={on}
              >
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Parking ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Parking</div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Parking available</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.parkingEnabled}
              onChange={(e) => set("parkingEnabled", e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        {form.parkingEnabled && (
          <div className={styles.nestedBlock}>
            <div className={styles.featureChips}>
              {PARKING_TYPES.map((p) => {
                const on = form.parkingTypes.includes(p.key);
                return (
                  <button
                    key={p.key}
                    className={`${styles.chip} ${on ? styles.chipActive : ""}`}
                    onClick={() => toggleParkingType(p.key)}
                    aria-pressed={on}
                  >
                    {on ? "✓ " : `${p.icon} `}{p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── USP ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>What Makes You Special?</div>
        <label className={styles.label}>Pick your strongest selling point</label>
        <select
          className={styles.select}
          value={form.uspCategory}
          onChange={(e) => set("uspCategory", e.target.value)}
          style={{ marginBottom: 12 }}
        >
          <option value="">Select category…</option>
          {USP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {form.uspCategory && (
          <input
            type="text"
            className={styles.input}
            placeholder={`e.g. "${form.uspCategory === "Food" ? "Fresh home-cooked meals daily" : form.uspCategory === "Locality" ? "2 min walk to Allen" : "Tell us more"}"`}
            value={form.uspText}
            onChange={(e) => set("uspText", e.target.value)}
            maxLength={100}
          />
        )}
      </div>

      {/* ── Description ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Description</div>
        <label className={styles.label}>
          Tell tenants what makes this {form.pgKind.toLowerCase()} special
        </label>
        <textarea
          className={`${styles.textarea} ${errors.description ? styles.inputError : ""}`}
          placeholder="Describe the rooms, food, rules, and nearby coaching…"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={5}
        />
        <div className={styles.charCounter} style={{ color: descOk ? "var(--color-success)" : "var(--muted)" }}>
          {descLen} / {MIN_DESC_LEN} characters minimum {descOk && "✓"}
        </div>
        {errors.description && <div className={styles.errorMsg}>⚠ {errors.description}</div>}

        {/* AI-style sample previews */}
        <div className={styles.aiCardsWrap}>
          <div className={styles.aiCardsLabel}>✨ Need help? Use a sample:</div>
          {samples.map((s, i) => (
            <div key={i} className={styles.aiCard}>
              <div className={styles.aiCardTag}>Sample {i + 1}</div>
              <p className={styles.aiCardText}>{s}</p>
              <button
                className={styles.aiCardBtn}
                onClick={() => set("description", s)}
              >
                Edit &amp; Use →
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
