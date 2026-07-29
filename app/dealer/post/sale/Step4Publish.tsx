"use client";

import { useRef, useState } from "react";
import { SaleForm, OWNER_ROLES, CONTACT_TIME_OPTIONS, DOCUMENT_TYPES } from "./types";
import { SaleMediaItem } from "./Step3Media";
import styles from "./styles.module.css";

export type SaleDocument = { id: string; docType: string; file: File };

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Step4Publish({
  form,
  setForm,
  sellerPhone,
  onChangeNumber,
  documents,
  setDocuments,
  photos,
  videoCount,
  errors,
  clearError,
  onEditStep,
}: {
  form: SaleForm;
  setForm: (updater: (f: SaleForm) => SaleForm) => void;
  sellerPhone: string;
  onChangeNumber: () => void;
  documents: SaleDocument[];
  setDocuments: (updater: (d: SaleDocument[]) => SaleDocument[]) => void;
  photos: SaleMediaItem[];
  videoCount: number;
  errors: Record<string, string>;
  clearError: (k: string) => void;
  onEditStep: (step: number) => void;
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);

  function set<K extends keyof SaleForm>(k: K, v: SaleForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    clearError(k as string);
  }

  function docFor(docType: string): SaleDocument | undefined {
    return documents.find((d) => d.docType === docType);
  }

  function triggerUpload(docType: string) {
    setPendingDocType(docType);
    fileInputRefs.current[docType]?.click();
  }

  function onFileChosen(docType: string, fl: FileList | null) {
    if (!fl || fl.length === 0) return;
    const file = fl[0];
    setDocuments((d) => [...d.filter((x) => x.docType !== docType), { id: uid(), docType, file }]);
    setPendingDocType(null);
  }

  function removeDocument(docType: string) {
    setDocuments((d) => d.filter((x) => x.docType !== docType));
  }

  const cover = photos.find((p) => p.isCover) ?? photos[0];
  const orderedPhotos = cover ? [cover, ...photos.filter((p) => p.id !== cover.id)] : photos;

  return (
    <>
      {/* Ownership + Seller details */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Owner Details</div>
        <div className={styles.field}>
          <label className={styles.label}>You are the</label>
          <div className={styles.chipGrid}>
            {OWNER_ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`${styles.chip} ${form.ownerRole === r.key ? styles.chipActive : ""}`}
                onClick={() => set("ownerRole", r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Seller Name</label>
          <input
            className={`${styles.input} ${errors.sellerName ? styles.inputError : ""}`}
            value={form.sellerName}
            onChange={(e) => set("sellerName", e.target.value)}
          />
          {errors.sellerName && <div className={styles.errorMsg}>{errors.sellerName}</div>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Phone Number</label>
          <div className={styles.verifiedRow}>
            <span className={styles.verifiedPhone}>
              +91 {sellerPhone}
              <span className={styles.verifiedBadge}>✓ Verified</span>
            </span>
            <button type="button" className={styles.changeNumberLink} onClick={onChangeNumber}>
              Change number
            </button>
          </div>
        </div>

        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>WhatsApp same as phone</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.whatsappSameAsPhone}
              onChange={(e) => set("whatsappSameAsPhone", e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
        {!form.whatsappSameAsPhone && (
          <div className={styles.field} style={{ marginTop: 10 }}>
            <label className={styles.label}>WhatsApp Number</label>
            <input
              type="tel"
              inputMode="numeric"
              className={`${styles.input} ${errors.whatsappNumber ? styles.inputError : ""}`}
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              placeholder="10-digit number"
            />
            {errors.whatsappNumber && <div className={styles.errorMsg}>{errors.whatsappNumber}</div>}
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Email <span className={styles.labelOptional}>optional</span></label>
          <input type="email" className={styles.input} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>

        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>Preferred Contact Time</label>
          <div className={styles.chipGrid}>
            {CONTACT_TIME_OPTIONS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`${styles.chip} ${form.preferredContactTime === c.key ? styles.chipActive : ""}`}
                onClick={() => set("preferredContactTime", c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents — upload only, not verified at this stage */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Property Documents</div>
        <div className={styles.cardSub}>Optional — upload only, verification isn&apos;t part of this step.</div>
        {DOCUMENT_TYPES.map((d) => {
          const doc = docFor(d.key);
          return (
            <div key={d.key} className={styles.docRow}>
              <div>
                <div className={styles.docLabel}>{d.label}</div>
                {doc && <div className={styles.docStatus}>{doc.file.name}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className={styles.docUploadBtn} onClick={() => triggerUpload(d.key)}>
                  {doc ? "Replace" : "Upload"}
                </button>
                {doc && (
                  <button type="button" className={styles.docUploadBtn} onClick={() => removeDocument(d.key)}>
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={(el) => { fileInputRefs.current[d.key] = el; }}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => { onFileChosen(d.key, e.target.files); e.target.value = ""; }}
              />
            </div>
          );
        })}
      </div>

      {/* Review summary */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Review Your Listing</div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Property Basics</span>
            <button type="button" className={styles.reviewEditLink} onClick={() => onEditStep(1)}>Edit</button>
          </div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Type</span><span className={styles.reviewRowVal}>{form.ptype}</span></div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Location</span><span className={styles.reviewRowVal}>{form.loc || "—"}</span></div>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Specifications</span>
            <button type="button" className={styles.reviewEditLink} onClick={() => onEditStep(2)}>Edit</button>
          </div>
          <div className={styles.reviewRow}>
            <span className={styles.reviewRowLabel}>Price</span>
            <span className={styles.reviewRowVal}>
              {form.price ? `₹${Number(form.price).toLocaleString("en-IN")}` : "—"}{form.priceNegotiable ? " (Negotiable)" : ""}
            </span>
          </div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Area</span><span className={styles.reviewRowVal}>{form.areaValue ? `${form.areaValue} ${form.areaUnit}` : "—"}</span></div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Amenities</span><span className={styles.reviewRowVal}>{form.amenityKeys.length} selected</span></div>
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Description</span><span className={styles.reviewRowVal}>{form.description ? `${form.description.slice(0, 40)}…` : "—"}</span></div>
        </div>

        <div className={styles.reviewSection} style={{ marginBottom: 0 }}>
          <div className={styles.reviewSectionHead}>
            <span className={styles.reviewSectionTitle}>Photos &amp; Video</span>
            <button type="button" className={styles.reviewEditLink} onClick={() => onEditStep(3)}>Edit</button>
          </div>
          {orderedPhotos.length > 0 && (
            <div className={styles.reviewThumbRow}>
              {orderedPhotos.map((p) => (
                <div key={p.id} className={styles.reviewThumb}><img src={p.previewUrl} alt="" /></div>
              ))}
            </div>
          )}
          <div className={styles.reviewRow}><span className={styles.reviewRowLabel}>Videos</span><span className={styles.reviewRowVal}>{videoCount}</span></div>
        </div>
      </div>

      {/* Declaration */}
      <label className={styles.declarationRow}>
        <input
          type="checkbox"
          checked={form.declarationChecked}
          onChange={(e) => set("declarationChecked", e.target.checked)}
        />
        <span className={styles.declarationText}>I confirm that the information provided is accurate.</span>
      </label>
      {errors.declaration && <div className={styles.errorMsg} style={{ marginTop: 6 }}>{errors.declaration}</div>}
    </>
  );
}
