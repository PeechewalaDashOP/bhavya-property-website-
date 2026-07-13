"use client";

import {
  HostelForm, RoomConfig,
  ROOM_FACILITIES, HOUSE_RULES, TENANT_TYPES, CORE_SERVICES,
  NOTICE_PERIODS, GATE_TIMES,
  roomCategoryLabel, roomCategoryCapacity,
} from "../types";
import styles from "../styles.module.css";

export default function Step2Rooms({
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

  function setRoom<K extends keyof RoomConfig>(idx: number, k: K, v: RoomConfig[K]) {
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, i) => (i === idx ? { ...r, [k]: v } : r)),
    }));
    clearError("rooms");
  }

  function toggleFacility(idx: number, key: string) {
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r, i) =>
        i === idx
          ? {
              ...r,
              facilities: r.facilities.includes(key)
                ? r.facilities.filter((x) => x !== key)
                : [...r.facilities, key],
            }
          : r
      ),
    }));
  }

  /* Generic multi-select toggle for the rules block */
  function toggleIn(field: "tenantTypes" | "houseRules" | "services", key: string) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(key)
        ? f[field].filter((x) => x !== key)
        : [...f[field], key],
    }));
  }

  if (form.rooms.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🛏️</div>
        <div className={styles.emptyTitle}>No room types selected</div>
        <p className={styles.helpText}>
          Go back to Step 1 and pick at least one room type.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── One card per room category chosen in Step 1 ── */}
      {form.rooms.map((room, i) => {
        const cap = roomCategoryCapacity(room);
        const label = roomCategoryLabel(room);
        return (
          <div key={room.key} className={styles.roomCard}>
            <div className={styles.roomCardHead}>
              <span className={styles.roomCardTitle}>{label} Room</span>
              {room.key !== "other" && (
                <span className={styles.roomCardBadge}>
                  {cap} {cap === 1 ? "bed" : "beds"} / room
                </span>
              )}
            </div>

            {room.key === "other" && (
              <>
                <label className={styles.label}>What do you call this room type?</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Deluxe AC, Dormitory"
                  value={room.customLabel}
                  onChange={(e) => setRoom(i, "customLabel", e.target.value)}
                  style={{ marginBottom: 12 }}
                />
              </>
            )}

            <div className={styles.inputRow} style={{ marginBottom: 12 }}>
              <div>
                <label className={styles.label}>Number of rooms</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={styles.input}
                  placeholder="e.g. 6"
                  value={room.numRooms}
                  onChange={(e) => setRoom(i, "numRooms", e.target.value)}
                />
              </div>
              <div>
                <label className={styles.label}>Rent per bed (₹/mo)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className={`${styles.input} ${errors.rooms ? styles.inputError : ""}`}
                  placeholder="e.g. 7000"
                  value={room.rentPerBed}
                  onChange={(e) => setRoom(i, "rentPerBed", e.target.value)}
                />
              </div>
            </div>

            <label className={styles.label}>Security deposit (₹)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={styles.input}
              placeholder="e.g. 5000"
              value={room.deposit}
              onChange={(e) => setRoom(i, "deposit", e.target.value)}
              style={{ marginBottom: 14 }}
            />

            <label className={styles.label} style={{ marginBottom: 8 }}>
              What&apos;s inside this room?
            </label>
            <div className={styles.featureChips}>
              {ROOM_FACILITIES.map((f) => {
                const on = room.facilities.includes(f.key);
                return (
                  <button
                    key={f.key}
                    className={`${styles.chip} ${on ? styles.chipActive : ""}`}
                    onClick={() => toggleFacility(i, f.key)}
                    aria-pressed={on}
                  >
                    {on ? "✓ " : `${f.icon} `}{f.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {errors.rooms && (
        <div className={styles.errorMsg} style={{ marginBottom: 14 }}>⚠ {errors.rooms}</div>
      )}

      {/* ── Who can stay ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Who Can Stay</div>

        <label className={styles.label}>This {form.pgKind.toLowerCase()} is for</label>
        <div className={styles.optBtns} style={{ marginBottom: 16 }}>
          {([
            { v: "male", l: "👦 Boys" },
            { v: "female", l: "👧 Girls" },
            { v: "both", l: "👥 Both" },
          ] as const).map((o) => (
            <button
              key={o.v}
              className={`${styles.optBtn} ${form.targetGender === o.v ? styles.optBtnActive : ""}`}
              onClick={() => set("targetGender", o.v)}
            >
              {o.l}
            </button>
          ))}
        </div>

        <label className={styles.label} style={{ marginBottom: 8 }}>Tenant type</label>
        <div className={styles.featureChips}>
          {TENANT_TYPES.map((t) => {
            const on = form.tenantTypes.includes(t.key);
            return (
              <button
                key={t.key}
                className={`${styles.chip} ${on ? styles.chipActive : ""}`}
                onClick={() => toggleIn("tenantTypes", t.key)}
                aria-pressed={on}
              >
                {on ? "✓ " : ""}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── House rules ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>House Rules</div>
        <p className={styles.helpText} style={{ marginTop: -6, marginBottom: 12 }}>
          Being clear upfront saves you calls from the wrong tenants.
        </p>
        <div className={styles.checkList}>
          {HOUSE_RULES.map((r) => {
            const on = form.houseRules.includes(r.key);
            return (
              <button
                key={r.key}
                className={`${styles.checkRow} ${on ? styles.checkRowActive : ""}`}
                onClick={() => toggleIn("houseRules", r.key)}
                aria-pressed={on}
              >
                <span className={`${styles.checkBox} ${on ? styles.checkBoxOn : ""}`}>
                  {on ? "✓" : ""}
                </span>
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Timings & notice ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Timings &amp; Notice</div>

        <label className={styles.label}>Notice period before leaving</label>
        <select
          className={styles.select}
          value={form.noticePeriod}
          onChange={(e) => set("noticePeriod", e.target.value)}
          style={{ marginBottom: 6 }}
        >
          {NOTICE_PERIODS.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>

        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Gate closes at night</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.gateTimingEnabled}
              onChange={(e) => set("gateTimingEnabled", e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        {form.gateTimingEnabled && (
          <div className={styles.nestedBlock}>
            <label className={styles.label}>Gate closing time</label>
            <select
              className={styles.select}
              value={form.gateClosingTime}
              onChange={(e) => set("gateClosingTime", e.target.value)}
            >
              {GATE_TIMES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Services & food ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Services Included</div>
        <div className={styles.featureChips} style={{ marginBottom: 6 }}>
          {CORE_SERVICES.map((s) => {
            const on = form.services.includes(s.key);
            return (
              <button
                key={s.key}
                className={`${styles.chip} ${on ? styles.chipActive : ""}`}
                onClick={() => toggleIn("services", s.key)}
                aria-pressed={on}
              >
                {on ? "✓ " : `${s.icon} `}{s.label}
              </button>
            );
          })}
        </div>

        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>🍽️ Food / meals provided</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.foodProvided}
              onChange={(e) => set("foodProvided", e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>
    </>
  );
}
