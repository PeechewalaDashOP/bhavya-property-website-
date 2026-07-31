"use client";

import {
  RoomForm, MESS_MEAL_OPTIONS, MESS_TYPE_OPTIONS, ELECTRICITY_OPTIONS,
  PARKING_OPTIONS, HOUSE_RULES, GATE_TIMES,
} from "./types";
import styles from "./styles.module.css";

const MIN_DESC_LEN = 100;

function buildSample(form: RoomForm): string {
  const genderText = form.targetGender === "male" ? "boys" : form.targetGender === "female" ? "girls" : "everyone";
  const messText = form.messAvailable ? "Meals are provided" : "No mess included — cook your own or order in";
  const coachingText = form.coachingHub ? ` Close to ${form.coachingHub}.` : "";
  return (
    `${form.propertyName || "This property"} offers comfortable rooms for ${genderText} in ${form.loc || "Kota"}.` +
    `${coachingText} ${messText}. Well-maintained, safe, and ideal for students and working professionals looking for a hassle-free stay.`
  );
}

export default function Step3Facilities({
  form,
  setForm,
  errors,
  clearError,
}: {
  form: RoomForm;
  setForm: (updater: (f: RoomForm) => RoomForm) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  function set<K extends keyof RoomForm>(k: K, v: RoomForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k as string);
  }

  function toggleMessMeal(key: string) {
    setForm((f) => ({
      ...f,
      messMeals: f.messMeals.includes(key) ? f.messMeals.filter((m) => m !== key) : [...f.messMeals, key],
    }));
  }
  function toggleParking(key: string) {
    setForm((f) => ({
      ...f,
      parkingTypes: f.parkingTypes.includes(key) ? f.parkingTypes.filter((p) => p !== key) : [...f.parkingTypes, key],
    }));
  }
  function toggleRule(key: string) {
    setForm((f) => ({
      ...f,
      houseRules: f.houseRules.includes(key) ? f.houseRules.filter((r) => r !== key) : [...f.houseRules, key],
    }));
  }

  const descLen = form.description.trim().length;
  const descOk = descLen >= MIN_DESC_LEN;

  return (
    <>
      {/* Food */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Food</div>
        <div className={styles.toggleRow} style={{ marginBottom: form.messAvailable ? 14 : 0 }}>
          <span className={styles.toggleLabel}>Mess Available</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.messAvailable} onChange={(e) => set("messAvailable", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        {form.messAvailable && (
          <>
            <div className={styles.field}>
              <label className={styles.label}>Meals</label>
              <div className={styles.chipGrid}>
                {MESS_MEAL_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`${styles.chip} ${form.messMeals.includes(m.key) ? styles.chipActive : ""}`}
                    onClick={() => toggleMessMeal(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.field} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Food Type</label>
              <div className={styles.chipGrid}>
                {MESS_TYPE_OPTIONS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`${styles.chip} ${form.messType === t.key ? styles.chipActive : ""}`}
                    onClick={() => set("messType", form.messType === t.key ? "" : t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Electricity */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Electricity</div>
        <div className={styles.chipGrid}>
          {ELECTRICITY_OPTIONS.filter((o) => o.key).map((o) => (
            <button
              key={o.key}
              type="button"
              className={`${styles.chip} ${form.electricity === o.key ? styles.chipActive : ""}`}
              onClick={() => set("electricity", o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {errors.electricity && <div className={styles.errorMsg}>{errors.electricity}</div>}
      </div>

      {/* Parking */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Parking</div>
        <div className={styles.chipGrid}>
          {PARKING_OPTIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`${styles.chip} ${form.parkingTypes.includes(p.key) ? styles.chipActive : ""}`}
              onClick={() => toggleParking(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Other facilities — no WiFi, deliberately (not meaningful for this
          category in Kota per Bhavya) */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Other Facilities</div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Laundry</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.laundry} onChange={(e) => set("laundry", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Housekeeping</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.housekeeping} onChange={(e) => set("housekeeping", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>RO Water</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.roWater} onChange={(e) => set("roWater", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>CCTV</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.cctv} onChange={(e) => set("cctv", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      {/* Gate timing */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Gate Timing</div>
        <div className={styles.chipGrid}>
          <button
            type="button"
            className={`${styles.chip} ${form.gateAlwaysOpen ? styles.chipActive : ""}`}
            onClick={() => set("gateAlwaysOpen", true)}
          >
            Always Open
          </button>
          <button
            type="button"
            className={`${styles.chip} ${!form.gateAlwaysOpen ? styles.chipActive : ""}`}
            onClick={() => set("gateAlwaysOpen", false)}
          >
            Closing Time
          </button>
        </div>
        {!form.gateAlwaysOpen && (
          <div className={styles.field} style={{ marginTop: 14, marginBottom: 0 }}>
            <label className={styles.label}>Gate Closes At</label>
            <select className={styles.select} value={form.gateClosingTime} onChange={(e) => set("gateClosingTime", e.target.value)}>
              {GATE_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* House rules */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>House Rules</div>
        <div className={styles.chipGrid}>
          {HOUSE_RULES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`${styles.chip} ${form.houseRules.includes(r.key) ? styles.chipActive : ""}`}
              onClick={() => toggleRule(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className={styles.card} style={{ marginBottom: 0 }}>
        <div className={styles.cardTitle}>Description</div>
        <textarea
          className={`${styles.textarea} ${errors.description ? styles.inputError : ""}`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe the rooms, food, rules, and nearby coaching…"
          rows={5}
        />
        <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: descOk ? "#16a34a" : "var(--muted)" }}>
          {descLen} / {MIN_DESC_LEN} characters minimum {descOk ? "✓" : ""}
        </div>
        {errors.description && <div className={styles.errorMsg}>{errors.description}</div>}

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Need help? Use a sample:</div>
          <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
            <p style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.6, margin: "0 0 10px" }}>{buildSample(form)}</p>
            <button
              type="button"
              onClick={() => set("description", buildSample(form))}
              style={{ border: "none", background: "none", color: "var(--color-primary)", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              Edit &amp; Use →
            </button>
          </div>
          <button type="button" className={styles.btnBack} style={{ width: "100%", marginTop: 10 }} disabled title="Coming soon">
            ✨ Generate Description — Coming Soon
          </button>
        </div>
      </div>
    </>
  );
}
