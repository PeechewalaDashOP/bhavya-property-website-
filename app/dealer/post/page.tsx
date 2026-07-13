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

type Draft = { purpose: Purpose; form_data: Record<string, unknown>; updated_at: string };

const PURPOSE_LABEL: Record<Purpose, string> = { pg: "PG / Hostel", rent: "Rent", sale: "Sale" };

export default function PostPropertyPage() {
  const router = useRouter();
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [hostelForm, setHostelForm] = useState<HostelForm>(emptyHostelForm());
  const [standardForm, setStandardForm] = useState<StandardForm>(emptyStandardForm("rent"));
  const [localities, setLocalities] = useState<{ name: string; slug: string }[]>([]);

  // Identity — name + WhatsApp only, no OTP (temporary, same tradeoff as the
  // phone-only dealer login until the WhatsApp Business API is approved).
  const [hasToken, setHasToken] = useState<boolean | null>(null); // null = still checking
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [identifyErr, setIdentifyErr] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [pendingPurpose, setPendingPurpose] = useState<Purpose | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("prop100_dealer_token"));
  }, []);

  useEffect(() => {
    fetch("/api/search-localities?q=&all=1")
      .then((r) => r.json())
      .then((data: { name: string; slug: string }[]) => {
        if (Array.isArray(data)) setLocalities(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasToken) { setDraftChecked(true); return; }
    const token = localStorage.getItem("prop100_dealer_token");
    if (!token) { setDraftChecked(true); return; }
    fetch("/api/dealer/draft", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Draft | null) => setDraft(d))
      .catch(() => {})
      .finally(() => setDraftChecked(true));
  }, [hasToken]);

  async function ensureIdentity(): Promise<boolean> {
    if (hasToken) return true;
    setIdentifyErr("");
    const cleanedName = name.trim();
    const cleanedPhone = whatsapp.replace(/\D/g, "");
    if (!cleanedName) { setIdentifyErr("Enter your name"); return false; }
    if (cleanedPhone.length !== 10) { setIdentifyErr("Enter a valid 10-digit WhatsApp number"); return false; }

    setIdentifying(true);
    try {
      const res = await fetch("/api/dealer/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanedName, whatsapp: cleanedPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setIdentifyErr(data.error || "Something went wrong. Try again."); return false; }
      localStorage.setItem("prop100_dealer_token", data.token);
      localStorage.setItem("prop100_dealer_name", data.name);
      setHasToken(true);
      return true;
    } catch {
      setIdentifyErr("Network error. Check your connection and try again.");
      return false;
    } finally {
      setIdentifying(false);
    }
  }

  async function choosePurpose(p: Purpose) {
    setPendingPurpose(p);
    const ok = await ensureIdentity();
    setPendingPurpose(null);
    if (!ok) return;
    setPurpose(p);
    if (p === "rent" || p === "sale") {
      setStandardForm(emptyStandardForm(p));
    } else {
      setHostelForm(emptyHostelForm());
    }
  }

  function resumeDraft() {
    if (!draft) return;
    setPurpose(draft.purpose);
    if (draft.purpose === "rent" || draft.purpose === "sale") {
      setStandardForm({ ...emptyStandardForm(draft.purpose), ...draft.form_data } as StandardForm);
    } else {
      setHostelForm({ ...emptyHostelForm(), ...draft.form_data } as HostelForm);
    }
  }

  async function discardDraft() {
    setDraft(null);
    const token = localStorage.getItem("prop100_dealer_token");
    if (!token) return;
    try {
      await fetch("/api/dealer/draft", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // non-critical — worst case the banner reappears next visit
    }
  }

  function backToSelector() {
    setPurpose(null);
  }

  function goToDashboard() {
    setDraft(null);
    router.replace("/dealer");
  }

  /* ── Purpose selector (Step 0) — identity capture folded in ── */
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

          {hasToken === false && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: "var(--sh)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--ink)" }}>
                Your details
              </div>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "12px 14px", fontSize: 15, background: "var(--bg)", color: "var(--ink)", outline: "none", marginBottom: 10 }}
              />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="WhatsApp number (10 digits)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "12px 14px", fontSize: 15, background: "var(--bg)", color: "var(--ink)", outline: "none" }}
              />
              {identifyErr && (
                <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{identifyErr}</p>
              )}
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
                We&apos;ll use this to send you leads and let you manage your listing — no OTP needed right now.
              </p>
            </div>
          )}

          {hasToken && draftChecked && draft && (
            <div style={{ background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.25)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>
                Continue your unfinished {PURPOSE_LABEL[draft.purpose]} listing?
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                Last edited {new Date(draft.updated_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={resumeDraft} className={styles.btnNext} style={{ flex: 1 }}>
                  Continue
                </button>
                <button onClick={discardDraft} className={styles.btnBack} style={{ flex: "0 0 auto", padding: "0 18px" }}>
                  Discard
                </button>
              </div>
            </div>
          )}

          <div className={styles.purposeGrid}>
            {PURPOSES.map((p) => (
              <button
                key={p.key}
                className={styles.purposeCard}
                onClick={() => choosePurpose(p.key)}
                disabled={identifying}
                style={{ opacity: identifying && pendingPurpose !== p.key ? 0.5 : 1 }}
              >
                <span className={styles.purposeIcon}>{p.icon}</span>
                <span className={styles.purposeLabel}>{p.label}</span>
                <span className={styles.purposeSub}>
                  {identifying && pendingPurpose === p.key ? "Please wait…" : p.sub}
                </span>
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
