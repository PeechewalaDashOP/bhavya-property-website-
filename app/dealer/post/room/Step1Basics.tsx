"use client";

import { useState } from "react";
import { COACHING_HUBS } from "@/lib/constants";
import {
  RoomForm, ROOM_TYPE_OPTIONS, ROOM_USER_TYPES, PREFERRED_TENANTS, RoomUserType,
  setSingleCategory, toggleMultipleCategory,
} from "./types";
import styles from "./styles.module.css";

export default function Step1Basics({
  form,
  setForm,
  localities,
  errors,
  clearError,
}: {
  form: RoomForm;
  setForm: (updater: (f: RoomForm) => RoomForm) => void;
  localities: { name: string; slug: string }[];
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  function set<K extends keyof RoomForm>(k: K, v: RoomForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k as string);
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsError("GPS not supported on this device.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        clearError("gps");
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) setGpsError("Location access denied — allow location in browser settings and tap again.");
        else setGpsError("Could not get location. Move near a window / outside and tap again.");
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  }

  function toggleTenant(key: string) {
    setForm((f) => ({
      ...f,
      tenantTypes: f.tenantTypes.includes(key) ? f.tenantTypes.filter((t) => t !== key) : [...f.tenantTypes, key],
    }));
  }

  return (
    <>
      {/* Property type */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>What type of room are you listing?</div>
        <div className={styles.cardSub}>Pick one, or "Multiple Room Types" if you have more than one kind.</div>
        <div className={styles.chipGrid}>
          {ROOM_TYPE_OPTIONS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.chip} ${form.roomTypeSelection === "single" && form.selectedCategories[0] === t.key ? styles.chipActive : ""}`}
              onClick={() => setForm((f) => setSingleCategory(f, t.key))}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.chip} ${form.roomTypeSelection === "multiple" ? styles.chipActive : ""}`}
            onClick={() => setForm((f) => ({ ...f, roomTypeSelection: "multiple" }))}
          >
            Multiple Room Types
          </button>
        </div>
        {form.roomTypeSelection === "multiple" && (
          <div style={{ marginTop: 14 }}>
            <div className={styles.label}>Which room types are available?</div>
            <div className={styles.chipGrid}>
              {ROOM_TYPE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`${styles.chip} ${form.selectedCategories.includes(t.key) ? styles.chipActive : ""}`}
                  onClick={() => setForm((f) => toggleMultipleCategory(f, t.key))}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {errors.roomType && <div className={styles.errorMsg}>{errors.roomType}</div>}
      </div>

      {/* Property name + You Are */}
      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>Property Name</label>
          <input
            className={`${styles.input} ${errors.propertyName ? styles.inputError : ""}`}
            value={form.propertyName}
            onChange={(e) => set("propertyName", e.target.value)}
            placeholder="e.g. Sunrise Girls Rooms"
            maxLength={80}
          />
          {errors.propertyName && <div className={styles.errorMsg}>{errors.propertyName}</div>}
        </div>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>You Are</label>
          <div className={styles.chipGrid}>
            {ROOM_USER_TYPES.map((u) => (
              <button
                key={u.key}
                type="button"
                className={`${styles.chip} ${form.userType === u.key ? styles.chipActive : ""}`}
                onClick={() => set("userType", u.key as RoomUserType)}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Location */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Location</div>
        <div className={styles.field}>
          <label className={styles.label}>Exact Location (GPS)</label>
          <button
            type="button"
            onClick={captureGps}
            disabled={gpsLoading}
            className={styles.btnBack}
            style={{ width: "100%" }}
          >
            {gpsLoading
              ? "Getting location…"
              : form.lat != null
                ? `📍 Location captured — tap to retake`
                : "📍 Capture location — tap while standing at the property"}
          </button>
          {gpsError && <div className={styles.errorMsg}>{gpsError}</div>}
          {errors.gps && !gpsError && <div className={styles.errorMsg}>{errors.gps}</div>}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Area</label>
          <select
            className={`${styles.select} ${errors.loc ? styles.inputError : ""}`}
            value={form.loc}
            onChange={(e) => set("loc", e.target.value)}
          >
            <option value="">Select area…</option>
            {localities.map((l) => (
              <option key={l.slug} value={l.name}>{l.name}</option>
            ))}
          </select>
          {errors.loc && <div className={styles.errorMsg}>{errors.loc}</div>}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Full Address</label>
          <textarea
            className={`${styles.textarea} ${errors.address ? styles.inputError : ""}`}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="House / building no., street…"
            rows={3}
          />
          {errors.address && <div className={styles.errorMsg}>{errors.address}</div>}
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Landmark <span className={styles.labelOptional}>optional</span></label>
            <input className={styles.input} value={form.landmark} onChange={(e) => set("landmark", e.target.value)} placeholder="Near Allen gate" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Pincode <span className={styles.labelOptional}>optional</span></label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={6}
              className={styles.input}
              value={form.pincode}
              onChange={(e) => set("pincode", e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>Nearby Coaching <span className={styles.labelOptional}>optional</span></label>
          <select className={styles.select} value={form.coachingHub} onChange={(e) => set("coachingHub", e.target.value)}>
            <option value="">Select coaching…</option>
            {COACHING_HUBS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      </div>

      {/* Who can stay + tenants */}
      <div className={styles.card}>
        <div className={styles.field}>
          <label className={styles.label}>Who Can Stay</label>
          <div className={styles.chipGrid}>
            {(["male", "female", "both"] as const).map((g) => (
              <button
                key={g}
                type="button"
                className={`${styles.chip} ${form.targetGender === g ? styles.chipActive : ""}`}
                onClick={() => set("targetGender", g)}
              >
                {g === "male" ? "Boys" : g === "female" ? "Girls" : "Both"}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>Preferred Tenants</label>
          <div className={styles.chipGrid}>
            {PREFERRED_TENANTS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.chip} ${form.tenantTypes.includes(t.key) ? styles.chipActive : ""}`}
                onClick={() => toggleTenant(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Running since */}
      <div className={styles.card} style={{ marginBottom: 0 }}>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>Running Since <span className={styles.labelOptional}>optional</span></label>
          <input
            type="number"
            className={styles.input}
            value={form.operationalSince}
            onChange={(e) => set("operationalSince", e.target.value)}
            placeholder="e.g. 2019"
          />
        </div>
      </div>
    </>
  );
}
