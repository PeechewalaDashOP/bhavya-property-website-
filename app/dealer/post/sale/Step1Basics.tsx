"use client";

import { useState } from "react";
import {
  SaleForm, SALE_PROPERTY_TYPES, PLOT_TYPES, PROPERTY_AGE_OPTIONS, AVAILABILITY_OPTIONS,
  needsBhk, needsFloorInfo, needsHouseFloors, needsPlotType, needsShopFields,
  needsOfficeFields, needsWarehouseFields,
} from "./types";
import styles from "./styles.module.css";

const BHK_OPTIONS = [1, 2, 3, 4, 5];
const BHK_LABEL = (v: number) => (v === 5 ? "4+" : String(v));
const BATH_OPTIONS = [1, 2, 3, 4];
const BATH_LABEL = (v: number) => (v === 4 ? "3+" : String(v));
const BALCONY_OPTIONS = [0, 1, 2, 3];
const BALCONY_LABEL = (v: number) => (v === 3 ? "3+" : String(v));

export default function Step1Basics({
  form,
  setForm,
  localities,
  errors,
  clearError,
}: {
  form: SaleForm;
  setForm: (updater: (f: SaleForm) => SaleForm) => void;
  localities: { name: string; slug: string }[];
  errors: Record<string, string>;
  clearError: (k: string) => void;
}) {
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  function set<K extends keyof SaleForm>(k: K, v: SaleForm[K]) {
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

  const isHouse = form.ptype === "House";

  return (
    <>
      {/* Property type */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>What are you selling?</div>
        <div className={styles.cardSub}>Pick the type that best matches your property.</div>
        <div className={styles.typeGrid}>
          {SALE_PROPERTY_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.typeCard} ${form.ptype === t.key ? styles.typeCardActive : ""}`}
              onClick={() => set("ptype", t.key)}
            >
              <span className={styles.typeIcon}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Location</div>
        <div className={styles.field}>
          <label className={styles.label}>Area</label>
          <select
            className={`${styles.select} ${errors.loc ? styles.inputError : ""}`}
            value={form.loc}
            onChange={(e) => set("loc", e.target.value)}
          >
            <option value="">Select…</option>
            {localities.map((l) => (
              <option key={l.slug} value={l.name}>{l.name}</option>
            ))}
          </select>
          {errors.loc && <div className={styles.errorMsg}>{errors.loc}</div>}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Landmark <span className={styles.labelOptional}>optional</span></label>
          <input
            className={styles.input}
            value={form.landmark}
            onChange={(e) => set("landmark", e.target.value)}
            placeholder="e.g. Near Allen Sankalp"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Society / Colony Name <span className={styles.labelOptional}>optional</span></label>
          <input
            className={styles.input}
            value={form.societyName}
            onChange={(e) => set("societyName", e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Street Address <span className={styles.labelOptional}>optional</span></label>
          <input
            className={styles.input}
            value={form.streetAddress}
            onChange={(e) => set("streetAddress", e.target.value)}
          />
        </div>
        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>Google Map Pin <span className={styles.labelOptional}>optional</span></label>
          <button type="button" className={styles.btnBack} style={{ width: "100%" }} onClick={captureGps} disabled={gpsLoading}>
            {gpsLoading ? "Getting location…" : form.lat != null ? "📍 Location captured — tap to update" : "📍 Use my current location"}
          </button>
          {gpsError && <div className={styles.errorMsg}>{gpsError}</div>}
        </div>
      </div>

      {/* Dynamic configuration */}
      {needsBhk(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>{isHouse ? "Bedrooms & Floors" : "Configuration"}</div>
          <div className={styles.field}>
            <label className={styles.label}>{isHouse ? "Bedrooms" : "BHK"}</label>
            <div className={styles.stepperRow}>
              {BHK_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.stepperBtn} ${form.bhk === v ? styles.stepperBtnActive : ""}`}
                  onClick={() => set("bhk", v)}
                >
                  {BHK_LABEL(v)}
                </button>
              ))}
            </div>
            {errors.bhk && <div className={styles.errorMsg}>{errors.bhk}</div>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Bathrooms</label>
            <div className={styles.stepperRow}>
              {BATH_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.stepperBtn} ${form.baths === v ? styles.stepperBtnActive : ""}`}
                  onClick={() => set("baths", v)}
                >
                  {BATH_LABEL(v)}
                </button>
              ))}
            </div>
            {errors.baths && <div className={styles.errorMsg}>{errors.baths}</div>}
          </div>
          <div className={styles.field} style={{ marginBottom: needsHouseFloors(form.ptype) ? 16 : 0 }}>
            <label className={styles.label}>Balcony</label>
            <div className={styles.stepperRow}>
              {BALCONY_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.stepperBtn} ${form.balconies === v ? styles.stepperBtnActive : ""}`}
                  onClick={() => set("balconies", v)}
                >
                  {BALCONY_LABEL(v)}
                </button>
              ))}
            </div>
          </div>
          {needsHouseFloors(form.ptype) && (
            <div className={styles.field} style={{ marginBottom: 0 }}>
              <label className={styles.label}>Floors</label>
              <input
                type="number"
                min={1}
                className={styles.input}
                value={form.houseFloors}
                onChange={(e) => set("houseFloors", e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
          )}
        </div>
      )}

      {needsFloorInfo(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Floor</div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Floor Number</label>
              <input type="number" className={styles.input} value={form.floorNum} onChange={(e) => set("floorNum", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Total Floors</label>
              <input type="number" className={styles.input} value={form.totalFloors} onChange={(e) => set("totalFloors", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {needsPlotType(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Plot Type</div>
          <div className={styles.chipGrid}>
            {PLOT_TYPES.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`${styles.chip} ${form.plotType === p.key ? styles.chipActive : ""}`}
                onClick={() => set("plotType", p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {errors.plotType && <div className={styles.errorMsg}>{errors.plotType}</div>}
        </div>
      )}

      {needsShopFields(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Shop Details</div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Washroom</span>
            <label className={styles.toggle}>
              <input type="checkbox" checked={form.shopWashroom} onChange={(e) => set("shopWashroom", e.target.checked)} />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      )}

      {needsOfficeFields(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Office Details</div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Cabins</label>
              <input type="number" min={0} className={styles.input} value={form.cabins} onChange={(e) => set("cabins", e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Meeting Rooms</label>
              <input type="number" min={0} className={styles.input} value={form.meetingRooms} onChange={(e) => set("meetingRooms", e.target.value)} />
            </div>
          </div>
          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label className={styles.label}>Washrooms</label>
            <input type="number" min={0} className={styles.input} value={form.officeWashrooms} onChange={(e) => set("officeWashrooms", e.target.value)} />
          </div>
        </div>
      )}

      {needsWarehouseFields(form.ptype) && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Warehouse Details</div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Covered Area (sq.ft)</label>
              <input
                type="number"
                min={0}
                className={`${styles.input} ${errors.coveredArea ? styles.inputError : ""}`}
                value={form.coveredArea}
                onChange={(e) => set("coveredArea", e.target.value)}
              />
              {errors.coveredArea && <div className={styles.errorMsg}>{errors.coveredArea}</div>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Open Area (sq.ft) <span className={styles.labelOptional}>optional</span></label>
              <input type="number" min={0} className={styles.input} value={form.openArea} onChange={(e) => set("openArea", e.target.value)} />
            </div>
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Truck Access</span>
            <label className={styles.toggle}>
              <input type="checkbox" checked={form.truckAccess} onChange={(e) => set("truckAccess", e.target.checked)} />
              <span className={styles.toggleSlider} />
            </label>
          </div>
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Loading Dock</span>
            <label className={styles.toggle}>
              <input type="checkbox" checked={form.loadingDock} onChange={(e) => set("loadingDock", e.target.checked)} />
              <span className={styles.toggleSlider} />
            </label>
          </div>
        </div>
      )}

      {/* Additional fields */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Additional Details</div>
        <div className={styles.field}>
          <label className={styles.label}>Property Age</label>
          <div className={styles.chipGrid}>
            {PROPERTY_AGE_OPTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`${styles.chip} ${form.propertyAge === a.key ? styles.chipActive : ""}`}
                onClick={() => set("propertyAge", a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field} style={{ marginBottom: form.availabilityStatus === "under_construction" ? 16 : 0 }}>
          <label className={styles.label}>Availability</label>
          <div className={styles.chipGrid}>
            {AVAILABILITY_OPTIONS.map((a) => (
              <button
                key={a.key}
                type="button"
                className={`${styles.chip} ${form.availabilityStatus === a.key ? styles.chipActive : ""}`}
                onClick={() => set("availabilityStatus", a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        {form.availabilityStatus === "under_construction" && (
          <div className={styles.field} style={{ marginBottom: 0 }}>
            <label className={styles.label}>Possession Date</label>
            <input
              type="date"
              className={`${styles.input} ${errors.possessionDate ? styles.inputError : ""}`}
              value={form.possessionDate}
              onChange={(e) => set("possessionDate", e.target.value)}
            />
            {errors.possessionDate && <div className={styles.errorMsg}>{errors.possessionDate}</div>}
          </div>
        )}
      </div>
    </>
  );
}
