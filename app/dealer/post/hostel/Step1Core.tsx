"use client";

import { COACHING_HUBS } from "@/lib/constants";
import {
  HostelForm, PgKind, RoomCategoryKey, UserType,
  ROOM_CATEGORIES, USER_TYPES, emptyRoomConfig,
} from "../types";
import styles from "../styles.module.css";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(CURRENT_YEAR - i));

export default function Step1Core({
  form,
  setForm,
  localities,
  errors,
  clearError,
}: {
  form: HostelForm;
  setForm: (updater: (f: HostelForm) => HostelForm) => void;
  localities: { name: string; slug: string }[];
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  function set<K extends keyof HostelForm>(k: K, v: HostelForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k as string);
  }

  /* Toggling a room category keeps its Step-2 config in sync.
     Adding = append an empty config. Removing = drop its config
     (so we never carry rent data for a category the user deselected). */
  function toggleCategory(key: RoomCategoryKey) {
    setForm((f) => {
      const on = f.roomCategories.includes(key);
      if (on) {
        return {
          ...f,
          roomCategories: f.roomCategories.filter((k) => k !== key),
          rooms: f.rooms.filter((r) => r.key !== key),
        };
      }
      return {
        ...f,
        roomCategories: [...f.roomCategories, key],
        rooms: [...f.rooms, emptyRoomConfig(key)],
      };
    });
    clearError("roomCategories");
  }

  return (
    <>
      {/* ── PG or Hostel ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Is this a Hostel or a PG?</div>
        <div className={styles.typeToggle}>
          {(["Hostel", "PG"] as PgKind[]).map((k) => (
            <button
              key={k}
              className={`${styles.typeBtn} ${form.pgKind === k ? styles.typeBtnActive : ""}`}
              onClick={() => set("pgKind", k)}
            >
              {k === "Hostel" ? "🏨 Hostel" : "🛏️ PG"}
            </button>
          ))}
        </div>
        <p className={styles.helpText}>
          {form.pgKind === "Hostel"
            ? "A dedicated building with many rooms, usually for students."
            : "Paying guest — rooms in a home, usually with meals."}
        </p>
      </div>

      {/* ── Name ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{form.pgKind} Name</div>
        <input
          type="text"
          className={`${styles.input} ${errors.pgName ? styles.inputError : ""}`}
          placeholder={form.pgKind === "Hostel" ? "e.g. Shree Krishna Boys Hostel" : "e.g. Gupta PG"}
          value={form.pgName}
          onChange={(e) => set("pgName", e.target.value)}
          maxLength={80}
        />
        {errors.pgName && <div className={styles.errorMsg}>⚠ {errors.pgName}</div>}
      </div>

      {/* ── You are ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>You are the</div>
        <div className={styles.optBtns}>
          {USER_TYPES.map((u) => (
            <button
              key={u.key}
              className={`${styles.optBtn} ${form.userType === u.key ? styles.optBtnActive : ""}`}
              onClick={() => set("userType", u.key as UserType)}
            >
              {u.label}
            </button>
          ))}
        </div>
        <div className={styles.warnBox}>
          ⚠️ You can&apos;t change your ownership status later.
        </div>
      </div>

      {/* ── Location ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Location</div>

        <label className={styles.label}>Area in Kota</label>
        <select
          className={`${styles.select} ${errors.loc ? styles.inputError : ""}`}
          value={form.loc}
          onChange={(e) => set("loc", e.target.value)}
          style={{ marginBottom: 14 }}
        >
          <option value="">Select area…</option>
          {localities.length > 0
            ? localities.map((l) => <option key={l.slug} value={l.name}>{l.name}</option>)
            : <option disabled>Loading areas…</option>}
        </select>
        {errors.loc && <div className={styles.errorMsg} style={{ marginTop: -8, marginBottom: 10 }}>⚠ {errors.loc}</div>}

        <label className={styles.label}>Full Address</label>
        <textarea
          className={`${styles.textarea} ${errors.address ? styles.inputError : ""}`}
          placeholder="House / building no., street, near which landmark…"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          rows={3}
          style={{ marginBottom: 14 }}
        />
        {errors.address && <div className={styles.errorMsg} style={{ marginTop: -8, marginBottom: 10 }}>⚠ {errors.address}</div>}

        <div className={styles.inputRow} style={{ marginBottom: 14 }}>
          <div>
            <label className={styles.label}>Pincode</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              className={styles.input}
              placeholder="324001"
              value={form.pincode}
              onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label className={styles.label}>Landmark</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Near Allen gate"
              value={form.landmark}
              onChange={(e) => set("landmark", e.target.value)}
            />
          </div>
        </div>

        <label className={styles.label}>Nearest Coaching</label>
        <select
          className={styles.select}
          value={form.coachingHub}
          onChange={(e) => set("coachingHub", e.target.value)}
        >
          <option value="">Select coaching…</option>
          {COACHING_HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* ── Operational details ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Operational Details</div>
        <div className={styles.inputRow}>
          <div>
            <label className={styles.label}>Running since</label>
            <select
              className={styles.select}
              value={form.operationalSince}
              onChange={(e) => set("operationalSince", e.target.value)}
            >
              <option value="">Select year…</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.label}>Present on floor</label>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. 1st, 2nd"
              value={form.presentOnFloor}
              onChange={(e) => set("presentOnFloor", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Room categories ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Room Types Available</div>
        <p className={styles.helpText} style={{ marginTop: -6, marginBottom: 12 }}>
          Pick every room type you have. You&apos;ll set the rent for each on the next step.
        </p>
        <div className={styles.featureChips}>
          {ROOM_CATEGORIES.map((c) => {
            const on = form.roomCategories.includes(c.key);
            return (
              <button
                key={c.key}
                className={`${styles.chip} ${on ? styles.chipActive : ""}`}
                onClick={() => toggleCategory(c.key)}
                aria-pressed={on}
              >
                {on ? "✓ " : ""}{c.label}
                {c.key !== "other" && (
                  <span className={styles.chipSub}>
                    {c.capacity} {c.capacity === 1 ? "bed" : "beds"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {errors.roomCategories && <div className={styles.errorMsg}>⚠ {errors.roomCategories}</div>}
      </div>
    </>
  );
}
