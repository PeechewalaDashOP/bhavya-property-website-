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

  // Identity — OTP-verified (purpose='owner_post'), same mechanism as
  // regular dealer login. The session lives in an httpOnly cookie, so
  // "am I logged in" is answered by asking the server (/api/dealer/session)
  // rather than reading anything client-side.
  const [hasSession, setHasSession] = useState<boolean | null>(null); // null = still checking
  const [identityStep, setIdentityStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [otp, setOtp] = useState("");
  const [identifyErr, setIdentifyErr] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pendingPurpose, setPendingPurpose] = useState<Purpose | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftChecked, setDraftChecked] = useState(false);

  useEffect(() => {
    fetch("/api/dealer/session")
      .then((r) => setHasSession(r.ok))
      .catch(() => setHasSession(false));
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
    if (!hasSession) { setDraftChecked(true); return; }
    fetch("/api/dealer/draft")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Draft | null) => setDraft(d))
      .catch(() => {})
      .finally(() => setDraftChecked(true));
  }, [hasSession]);

  function startCooldown() {
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function activatePurpose(p: Purpose) {
    setPurpose(p);
    if (p === "rent" || p === "sale") {
      setStandardForm(emptyStandardForm(p));
    } else {
      setHostelForm(emptyHostelForm());
    }
  }

  async function choosePurpose(p: Purpose) {
    if (hasSession) { activatePurpose(p); return; }

    // Not identified yet — validate details and send an OTP before
    // proceeding into the wizard.
    setIdentifyErr("");
    const cleanedName = name.trim();
    const cleanedPhone = whatsapp.replace(/\D/g, "");
    if (!cleanedName) { setIdentifyErr("Enter your name"); return; }
    if (cleanedPhone.length !== 10) { setIdentifyErr("Enter a valid 10-digit WhatsApp number"); return; }

    setPendingPurpose(p);
    setIdentifying(true);
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanedPhone, purpose: "owner_post" }),
    });
    const data = await res.json();
    setIdentifying(false);
    // pendingPurpose stays set while on the OTP screen — needed for the
    // resend button, and to activate the right purpose once verified.
    if (!res.ok) { setIdentifyErr(data.error ?? "Failed to send OTP. Please try again."); return; }
    setOtp("");
    setIdentityStep("otp");
    startCooldown();
  }

  async function verifyIdentityOtp() {
    const cleanedOtp = otp.replace(/\D/g, "");
    if (cleanedOtp.length !== 6) { setIdentifyErr("Enter the 6-digit OTP"); return; }

    setIdentifying(true);
    setIdentifyErr("");
    const res = await fetch("/api/dealer/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), whatsapp: whatsapp.replace(/\D/g, ""), otp: cleanedOtp }),
    });
    const data = await res.json();
    setIdentifying(false);
    if (!res.ok) { setIdentifyErr(data.error ?? "Verification failed. Please try again."); return; }

    setHasSession(true);
    if (pendingPurpose) activatePurpose(pendingPurpose);
    setPendingPurpose(null);
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
    try {
      await fetch("/api/dealer/draft", { method: "DELETE" });
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

          {hasSession === false && identityStep === "form" && (
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
                We&apos;ll send a WhatsApp code to this number to confirm it&apos;s yours, then use it to send you leads.
              </p>
            </div>
          )}

          {hasSession === false && identityStep === "otp" && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: "var(--sh)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "var(--ink)" }}>
                Verify your WhatsApp number
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
                Code sent to <strong style={{ color: "var(--ink)" }}>+91 {whatsapp}</strong>. Valid for 10 minutes.
              </p>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "12px 14px", fontSize: 20, letterSpacing: 6, textAlign: "center", background: "var(--bg)", color: "var(--ink)", outline: "none", marginBottom: 10 }}
                autoFocus
              />
              {identifyErr && (
                <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{identifyErr}</p>
              )}
              <button
                onClick={verifyIdentityOtp}
                disabled={identifying}
                className={styles.btnNext}
                style={{ width: "100%", marginBottom: 8 }}
              >
                {identifying ? "Verifying…" : "Verify →"}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => { setIdentityStep("form"); setIdentifyErr(""); }}
                  style={{ color: "var(--muted)", fontSize: 12.5 }}
                >
                  ← Change number
                </button>
                <button
                  onClick={() => pendingPurpose && choosePurpose(pendingPurpose)}
                  disabled={cooldown > 0}
                  style={{ color: "var(--muted)", fontSize: 12.5 }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
            </div>
          )}

          {hasSession && draftChecked && draft && (
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
                disabled={identifying || identityStep === "otp"}
                style={{ opacity: (identifying && pendingPurpose !== p.key) || identityStep === "otp" ? 0.5 : 1 }}
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
