"use client";

import { useState } from "react";
import {
  RoomForm, RoomVariant, RoomCategoryKey, COOLING_OPTIONS, FURNITURE_OPTIONS,
  emptyRoomVariant, variantDisplayName, roomTypeLabel,
} from "./types";
import styles from "./styles.module.css";

export default function Step2RoomConfig({
  form,
  setForm,
  errors,
}: {
  form: RoomForm;
  setForm: (updater: (f: RoomForm) => RoomForm) => void;
  errors: Record<string, string>;
}) {
  // Accordion open/collapsed state — only meaningful in "multiple" mode.
  // Collapsed by default per spec, to reduce visual overload.
  const [openKeys, setOpenKeys] = useState<Set<RoomCategoryKey>>(new Set());

  function toggleOpen(key: RoomCategoryKey) {
    setOpenKeys((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function addVariant(key: RoomCategoryKey) {
    setForm((f) => ({ ...f, rooms: [...f.rooms, emptyRoomVariant(key)] }));
  }
  function removeVariant(id: string) {
    setForm((f) => ({ ...f, rooms: f.rooms.filter((r) => r.id !== id) }));
  }
  function updateVariant<K extends keyof RoomVariant>(id: string, k: K, v: RoomVariant[K]) {
    setForm((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === id ? { ...r, [k]: v } : r)) }));
  }
  function toggleFurniture(id: string, key: string) {
    setForm((f) => ({
      ...f,
      rooms: f.rooms.map((r) =>
        r.id === id
          ? { ...r, furniture: r.furniture.includes(key) ? r.furniture.filter((x) => x !== key) : [...r.furniture, key] }
          : r
      ),
    }));
  }

  function renderVariantCard(v: RoomVariant, positionIndex: number, showRemove: boolean) {
    return (
      <div key={v.id} className={styles.variantCard}>
        <div className={styles.variantHead}>
          <span className={styles.variantTitle}>{variantDisplayName(v, positionIndex)}</span>
          {showRemove && (
            <button type="button" className={styles.variantRemove} onClick={() => removeVariant(v.id)}>×</button>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Variant Name <span className={styles.labelOptional}>optional</span></label>
          <input
            className={styles.input}
            value={v.variantName}
            onChange={(e) => updateVariant(v.id, "variantName", e.target.value)}
            placeholder="e.g. AC Premium, Balcony Room"
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Total Rooms of this Variant</label>
            <input
              type="number"
              min={1}
              className={styles.input}
              value={v.totalRooms}
              onChange={(e) => updateVariant(v.id, "totalRooms", e.target.value)}
              placeholder="e.g. 4"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Monthly Rent (₹)</label>
            <input
              type="number"
              min={0}
              className={styles.input}
              value={v.rentPerMonth}
              onChange={(e) => updateVariant(v.id, "rentPerMonth", e.target.value)}
              placeholder="e.g. 7000"
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Security Deposit <span className={styles.labelOptional}>optional</span></label>
          <input
            type="number"
            min={0}
            className={styles.input}
            value={v.deposit}
            onChange={(e) => updateVariant(v.id, "deposit", e.target.value)}
            placeholder="e.g. 5000"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Cooling</label>
          <div className={styles.chipGrid}>
            {COOLING_OPTIONS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${styles.chip} ${v.coolingType === c.key ? styles.chipActive : ""}`}
                onClick={() => updateVariant(v.id, "coolingType", v.coolingType === c.key ? "" : c.key)}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Attached Bathroom</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={v.attachedBathroom} onChange={(e) => updateVariant(v.id, "attachedBathroom", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Kitchen</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={v.kitchen} onChange={(e) => updateVariant(v.id, "kitchen", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Balcony</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={v.balcony} onChange={(e) => updateVariant(v.id, "balcony", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        <div className={styles.toggleRow} style={{ marginBottom: 14 }}>
          <span className={styles.toggleLabel}>Furnished</span>
          <label className={styles.toggle}>
            <input type="checkbox" checked={v.furnished} onChange={(e) => updateVariant(v.id, "furnished", e.target.checked)} />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Furniture</label>
          <div className={styles.chipGrid}>
            {FURNITURE_OPTIONS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`${styles.chip} ${v.furniture.includes(f.key) ? styles.chipActive : ""}`}
                onClick={() => toggleFurniture(v.id, f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>Available From <span className={styles.labelOptional}>optional</span></label>
          <input
            type="date"
            className={styles.input}
            value={v.availableFrom}
            onChange={(e) => updateVariant(v.id, "availableFrom", e.target.value)}
          />
        </div>
      </div>
    );
  }

  function renderCategoryVariants(key: RoomCategoryKey) {
    const variants = form.rooms.filter((r) => r.key === key);
    return (
      <>
        {variants.map((v, i) => renderVariantCard(v, i, variants.length > 1))}
        <button type="button" className={styles.addVariantBtn} onClick={() => addVariant(key)}>
          + Add Another Variant
        </button>
      </>
    );
  }

  if (form.selectedCategories.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>No room type selected</div>
        <p className={styles.helpText}>Go back to Step 1 and pick at least one room type.</p>
      </div>
    );
  }

  // Single type chosen — one flat card group, no accordion wrapper.
  if (form.roomTypeSelection === "single" || form.selectedCategories.length === 1) {
    const key = form.selectedCategories[0];
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>{roomTypeLabel(key)}</div>
        {renderCategoryVariants(key)}
        {errors.rooms && <div className={styles.errorMsg}>{errors.rooms}</div>}
      </div>
    );
  }

  // Multiple types — one collapsed-by-default accordion per type.
  return (
    <>
      {form.selectedCategories.map((key) => {
        const isOpen = openKeys.has(key);
        const count = form.rooms.filter((r) => r.key === key).length;
        return (
          <div key={key} className={styles.accordion}>
            <button type="button" className={styles.accordionHeader} onClick={() => toggleOpen(key)}>
              <div>
                <div className={styles.accordionTitle}>{roomTypeLabel(key)}</div>
                <div className={styles.accordionSub}>{count} variant{count !== 1 ? "s" : ""}</div>
              </div>
              <span className={`${styles.accordionChevron} ${isOpen ? styles.accordionChevronOpen : ""}`}>▼</span>
            </button>
            {isOpen && <div className={styles.accordionBody}>{renderCategoryVariants(key)}</div>}
          </div>
        );
      })}
      {errors.rooms && <div className={styles.errorMsg}>{errors.rooms}</div>}
    </>
  );
}
