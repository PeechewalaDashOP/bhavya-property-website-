"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Purpose, PURPOSES, HostelForm, StandardForm,
  emptyHostelForm, emptyStandardForm,
} from "./types";
import HostelFlow from "./hostel/HostelFlow";
import StandardFlow from "./standard/StandardFlow";
import styles from "./styles.module.css";

export default function PostPropertyPage() {
  const router = useRouter();
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [hostelForm, setHostelForm] = useState<HostelForm>(emptyHostelForm());
  const [standardForm, setStandardForm] = useState<StandardForm>(emptyStandardForm("rent"));
  const [localities, setLocalities] = useState<{ name: string; slug: string }[]>([]);

  useEffect(() => {
    fetch("/api/search-localities?q=&all=1")
      .then((r) => r.json())
      .then((data: { name: string; slug: string }[]) => {
        if (Array.isArray(data)) setLocalities(data);
      })
      .catch(() => {});
  }, []);

  function choosePurpose(p: Purpose) {
    setPurpose(p);
    if (p === "rent" || p === "sale") {
      setStandardForm(emptyStandardForm(p));
    } else {
      setHostelForm(emptyHostelForm());
    }
  }

  function backToSelector() {
    setPurpose(null);
  }

  function goToDashboard() {
    router.replace("/dealer");
  }

  /* ── Purpose selector (Step 0) ── */
  if (purpose === null) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "var(--dark)", color: "#fff" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
              <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>Post Property</span>
            </div>
            <button onClick={() => router.back()} style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 14px" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>
              What are you listing?
            </div>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              Choose the option that best fits your property.
            </p>
          </div>

          <div className={styles.purposeGrid}>
            {PURPOSES.map((p) => (
              <button
                key={p.key}
                className={styles.purposeCard}
                onClick={() => choosePurpose(p.key)}
              >
                <span className={styles.purposeIcon}>{p.icon}</span>
                <span className={styles.purposeLabel}>{p.label}</span>
                <span className={styles.purposeSub}>{p.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── PG / Hostel dedicated 4-step flow ── */
  if (purpose === "pg") {
    return (
      <HostelFlow
        form={hostelForm}
        setForm={setHostelForm}
        localities={localities}
        onCancel={backToSelector}
        onDone={goToDashboard}
      />
    );
  }

  /* ── Standard rent / sale flow ── */
  return (
    <StandardFlow
      form={standardForm}
      setForm={setStandardForm}
      localities={localities}
      onCancel={backToSelector}
      onDone={goToDashboard}
    />
  );
}
