"use client";

import { useEffect, useState } from "react";
import {
  SaleForm, AREA_UNITS, FURNISHING_OPTIONS, FLOOR_SPECIAL_OPTIONS,
  FACING_OPTIONS, OWNERSHIP_TYPES, PARKING_TYPES, needsFurnishing, needsFloorInfo,
} from "./types";
import styles from "./styles.module.css";

type AmenityOption = { id: number; key: string; label: string; icon: string | null };

export default function Step2Specifications({
  form,
  setForm,
  errors,
  clearError,
}: {
  form: SaleForm;
  setForm: (updater: (f: SaleForm) => SaleForm) => void;
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [amenities, setAmenities] = useState<AmenityOption[]>([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(true);

  function set<K extends keyof SaleForm>(k: K, v: SaleForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k as string);
  }

  // Amenities are entirely data-driven — fetched fresh whenever the
  // property type changes, never hardcoded here. See
  // docs/sale-architecture.md §8.
  useEffect(() => {
    let cancelled = false;
    setAmenitiesLoading(true);
    fetch(`/api/amenities?ptype=${encodeURIComponent(form.ptype)}`)
      .then((r) => r.json())
      .then((data: AmenityOption[]) => {
        if (!cancelled && Array.isArray(data)) setAmenities(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAmenitiesLoading(false); });
    return () => { cancelled = true; };
  }, [form.ptype]);

  function toggleAmenity(key: string) {
    setForm((f) => ({
      ...f,
      amenityKeys: f.amenityKeys.includes(key)
        ? f.amenityKeys.filter((k) => k !== key)
        : [...f.amenityKeys, key],
    }));
  }

  return (
    <>
      {/* Price */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Sale Price</div>
        <div className={styles.field}>
          <label className={styles.label}>Price (₹)</label>
          <input
            type="number"
            min={0}
            className={`${styles.input} ${errors.price ? styles.inputError : ""}`}
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="e.g. 4500000"
          />
          {errors.price && <div className={styles.errorMsg}>{errors.price}</div>}
        </div>
        <div className={styles.toggleRow} style={{ marginBottom: 0 }}>
          <span className={styles.toggleLabel}>Negotiable</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={form.priceNegotiable} onChange={(e) => set("priceNegotiable", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      {/* Area */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Area</div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Area</label>
            <input
              type="number"
              min={0}
              className={`${styles.input} ${errors.areaValue ? styles.inputError : ""}`}
              value={form.areaValue}
              onChange={(e) => set("areaValue", e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Unit</label>
            <select className={styles.select} value={form.areaUnit} onChange={(e) => set("areaUnit", e.target.value)}>
              {AREA_UNITS.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </div>
        {errors.areaValue && <div className={styles.errorMsg}>{errors.areaValue}</div>}
      </div>

      {/* Furnishing */}
      {needsFurnishing(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Furnishing</div>
          <div className={styles.chipGrid}>
            {FURNISHING_OPTIONS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${styles.chip} ${form.furnishing === f.key ? styles.chipActive : ""}`}
                onClick={() => set("furnishing", f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floor special options */}
      {needsFloorInfo(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Floor Information</div>
          <div className={styles.chipGrid}>
            {FLOOR_SPECIAL_OPTIONS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${styles.chip} ${form.floorSpecial === f.key ? styles.chipActive : ""}`}
                onClick={() => set("floorSpecial", form.floorSpecial === f.key ? "" : f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Facing / Ownership / Parking */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Facing</div>
        <div className={styles.chipGrid}>
          {FACING_OPTIONS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`${styles.chip} ${form.facing === f.key ? styles.chipActive : ""}`}
              onClick={() => set("facing", form.facing === f.key ? "" : f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Ownership Type</div>
        <div className={styles.chipGrid}>
          {OWNERSHIP_TYPES.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`${styles.chip} ${form.ownershipType === o.key ? styles.chipActive : ""}`}
              onClick={() => set("ownershipType", form.ownershipType === o.key ? "" : o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Parking</div>
        <div className={styles.chipGrid}>
          {PARKING_TYPES.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`${styles.chip} ${form.parkingType === p.key ? styles.chipActive : ""}`}
              onClick={() => set("parkingType", p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amenities — dynamic, fetched by property type */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Amenities</div>
        <div className={styles.cardSub}>Shown based on your property type — select what applies.</div>
        {amenitiesLoading ? (
          <div className={styles.chipsLoading}>Loading amenities…</div>
        ) : amenities.length === 0 ? (
          <div className={styles.chipsLoading}>No amenities configured for this property type yet.</div>
        ) : (
          <div className={styles.chipGrid}>
            {amenities.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`${styles.chip} ${form.amenityKeys.includes(a.key) ? styles.chipActive : ""}`}
                onClick={() => toggleAmenity(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Description</div>
        <textarea
          className={`${styles.textarea} ${errors.description ? styles.inputError : ""}`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Explain what makes this property unique."
          rows={5}
        />
        {errors.description && <div className={styles.errorMsg}>{errors.description}</div>}
        <button type="button" className={styles.docUploadBtn} style={{ marginTop: 10 }} disabled title="Coming soon">
          ✨ Generate Description
        </button>
      </div>
    </>
  );
}
