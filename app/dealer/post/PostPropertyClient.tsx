"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Purpose, PURPOSES, HostelForm, StandardForm,
  emptyHostelForm, emptyStandardForm,
} from "./types";
import { SaleForm, emptySaleForm } from "./sale/types";
import { RoomForm, emptyRoomForm } from "./room/types";
import HostelFlow from "./hostel/HostelFlow";
import StandardFlow from "./standard/StandardFlow";
import SaleFlow from "./sale/SaleFlow";
import RoomFlow from "./room/RoomFlow";
import styles from "./styles.module.css";

type Draft = { purpose: Purpose; form_data: Record<string, unknown>; updated_at: string };

const PURPOSE_LABEL: Record<Purpose, string> = { pg: "Hostel", rent: "Rent", sale: "Sale" };

type Props = {
  initialHasSession: boolean;
  initialDraft: Draft | null;
  initialSellerName?: string;
  initialSellerPhone?: string;
};

export default function PostPropertyClient({
  initialHasSession, initialDraft,
  initialSellerName = "", initialSellerPhone = "",
}: Props) {
  const router = useRouter();
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [hostelForm, setHostelForm] = useState<HostelForm>(emptyHostelForm());
  const [standardForm, setStandardForm] = useState<StandardForm>(emptyStandardForm("rent"));
  const [saleForm, setSaleForm] = useState<SaleForm>(emptySaleForm());
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm());
  // True once the Rent purpose's type grid picks "Room (PG)" — swaps
  // StandardFlow out for the dedicated RoomFlow wizard while purpose stays
  // "rent". See StandardFlow.tsx's onPickRoomPg / docs/sale-architecture.md-
  // style module split (this flow's own equivalent write-up would live in
  // a future docs/room-architecture.md if one gets written).
  const [roomFlowActive, setRoomFlowActive] = useState(false);
  const [localities, setLocalities] = useState<{ name: string; slug: string }[]>([]);

  // Verified seller identity — resolved server-side for an existing session
  // (page.tsx), or captured fresh below when a new owner OTP-verifies.
  // SaleFlow/Step4Publish only ever consumes these two plain strings + the
  // onChangeNumber callback — never OTP/session logic itself (see
  // docs/sale-architecture.md §10 on auth-provider agnosticism).
  const [sellerName, setSellerName] = useState(initialSellerName);
  const [sellerPhone, setSellerPhone] = useState(initialSellerPhone);
  // True while re-verifying a different WhatsApp number mid-wizard (Step 4's
  // "Change number" link) — distinct from the first-time identity gate so a
  // successful re-verify updates identity without resetting saleForm.
  const [reverifying, setReverifying] = useState(false);

  // Identity — OTP-verified (purpose='owner_post'), same mechanism as
  // regular dealer login. hasSession and draft both arrive as props,
  // already resolved server-side (page.tsx reads the session cookie via
  // getDealerSessionFromCookieStore before the first paint) — that used to
  // be a client-side fetch that flipped hasSession from null to its real
  // value after mount, which meant the identity card / draft-resume banner
  // popped in above the purpose grid and shoved it down: a ~0.3 CLS on this
  // page. Resolving both server-side means the correct layout is what
  // paints on frame one, nothing shifts.
  const [hasSession, setHasSession] = useState<boolean>(initialHasSession);
  const [identityStep, setIdentityStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [otp, setOtp] = useState("");
  const [identifyErr, setIdentifyErr] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pendingPurpose, setPendingPurpose] = useState<Purpose | null>(null);

  const [draft, setDraft] = useState<Draft | null>(initialDraft);

  // Cancel/done both leave via router.replace() to "/" or "/dealer" — prefetch
  // both now so that navigation is instant instead of round-tripping to the
  // server at click time.
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/dealer");
  }, [router]);

  useEffect(() => {
    fetch("/api/search-localities?q=&all=1")
      .then((r) => r.json())
      .then((data: { name: string; slug: string }[]) => {
        if (Array.isArray(data)) setLocalities(data);
      })
      .catch(() => {});
  }, []);

  function startCooldown() {
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function activatePurpose(p: Purpose, sellerNameOverride?: string) {
    setPurpose(p);
    setRoomFlowActive(false);
    if (p === "sale") {
      setSaleForm(emptySaleForm(sellerNameOverride ?? sellerName));
    } else if (p === "rent") {
      setStandardForm(emptyStandardForm(p));
    } else {
      setHostelForm(emptyHostelForm());
    }
  }

  // Rent's type grid picked "Room (PG)" — swap StandardFlow out for the
  // dedicated RoomFlow wizard, purpose stays "rent".
  function pickRoomPg() {
    setRoomForm(emptyRoomForm());
    setRoomFlowActive(true);
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

    const cleanedPhone = whatsapp.replace(/\D/g, "");
    setHasSession(true);
    setSellerName(name.trim());
    setSellerPhone(cleanedPhone);

    // "Change number" mid-wizard (Step 4) — identity updated in place,
    // return to the SAME wizard/step, saleForm untouched. Does not go
    // through activatePurpose (which would reset the form).
    if (reverifying) {
      setReverifying(false);
      setPendingPurpose(null);
      return;
    }

    if (pendingPurpose) activatePurpose(pendingPurpose, name.trim());
    setPendingPurpose(null);
  }

  // Step 4's "Change number" link — re-runs the same OTP gate without
  // resetting purpose/saleForm. See docs/sale-architecture.md §10.
  function startChangeNumber() {
    setReverifying(true);
    setIdentityStep("form");
    setIdentifyErr("");
    setName(sellerName);
    setWhatsapp("");
    setOtp("");
  }

  // Deliberately NOT choosePurpose() — that function short-circuits and
  // skips sending an OTP entirely whenever hasSession is already true,
  // which it always is by the time someone is mid-wizard wanting to swap
  // numbers. This always sends, regardless of session state.
  async function sendReverifyOtp() {
    setIdentifyErr("");
    const cleanedName = name.trim();
    const cleanedPhone = whatsapp.replace(/\D/g, "");
    if (!cleanedName) { setIdentifyErr("Enter your name"); return; }
    if (cleanedPhone.length !== 10) { setIdentifyErr("Enter a valid 10-digit WhatsApp number"); return; }

    setIdentifying(true);
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanedPhone, purpose: "owner_post" }),
    });
    const data = await res.json();
    setIdentifying(false);
    if (!res.ok) { setIdentifyErr(data.error ?? "Failed to send OTP. Please try again."); return; }
    setOtp("");
    setIdentityStep("otp");
    startCooldown();
  }

  function resumeDraft() {
    if (!draft) return;
    setPurpose(draft.purpose);
    if (draft.purpose === "sale") {
      setRoomFlowActive(false);
      setSaleForm({ ...emptySaleForm(sellerName), ...draft.form_data } as SaleForm);
    } else if (draft.purpose === "rent") {
      // A Room (PG) draft is marked with __roomFlow: true (see
      // RoomFlow.tsx's autosave) — RoomForm has no ptype field of its own
      // (always "Room"), so this marker is the resume-time discriminator
      // between a Room (PG) draft and a plain Flat/House/etc. rent draft.
      if ((draft.form_data as Record<string, unknown>).__roomFlow === true) {
        setRoomFlowActive(true);
        setRoomForm({ ...emptyRoomForm(), ...draft.form_data } as RoomForm);
      } else {
        setRoomFlowActive(false);
        setStandardForm({ ...emptyStandardForm(draft.purpose), ...draft.form_data } as StandardForm);
      }
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

  /* ── Re-verify a different WhatsApp number mid-wizard (Step 4's "Change
     number" link) — reuses the same OTP screens as the first-time gate,
     but returns to the SAME purpose/step on success instead of resetting
     the form. See startChangeNumber() / verifyIdentityOtp() above. ── */
  if (reverifying) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "var(--dark)", color: "#fff" }}>
          <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center" }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
          </div>
        </div>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 14px" }}>
          {identityStep === "form" ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, boxShadow: "var(--sh)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: "var(--ink)" }}>Verify new number</div>
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
                placeholder="New WhatsApp number (10 digits)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "12px 14px", fontSize: 15, background: "var(--bg)", color: "var(--ink)", outline: "none" }}
              />
              {identifyErr && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{identifyErr}</p>}
              <button
                onClick={sendReverifyOtp}
                disabled={identifying}
                className={styles.btnNext}
                style={{ width: "100%", marginTop: 12 }}
              >
                {identifying ? "Please wait…" : "Send OTP →"}
              </button>
              <button
                onClick={() => setReverifying(false)}
                style={{ display: "block", width: "100%", marginTop: 8, color: "var(--muted)", fontSize: 13, textAlign: "center" }}
              >
                ← Cancel
              </button>
            </div>
          ) : (
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, boxShadow: "var(--sh)" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "var(--ink)" }}>
                Verify your new WhatsApp number
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
              {identifyErr && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 8 }}>{identifyErr}</p>}
              <button onClick={verifyIdentityOtp} disabled={identifying} className={styles.btnNext} style={{ width: "100%", marginBottom: 8 }}>
                {identifying ? "Verifying…" : "Verify →"}
              </button>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setIdentityStep("form")} style={{ color: "var(--muted)", fontSize: 12.5 }}>← Change number</button>
                <button
                  onClick={sendReverifyOtp}
                  disabled={cooldown > 0}
                  style={{ color: "var(--muted)", fontSize: 12.5 }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
              <button
                onClick={() => setReverifying(false)}
                style={{ display: "block", width: "100%", marginTop: 8, color: "var(--muted)", fontSize: 13, textAlign: "center" }}
              >
                ← Cancel and keep current number
              </button>
            </div>
          )}
        </div>
      </div>
    );
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
            <button
              onClick={() => router.replace(hasSession ? "/dealer" : "/")}
              style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}
            >
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

          {hasSession && draft && (
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

  /* ── Hostel dedicated 4-step flow ── */
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

  /* ── Sale — dedicated premium 4-step flow (docs/sale-architecture.md) ── */
  if (purpose === "sale") {
    return (
      <SaleFlow
        form={saleForm}
        setForm={setSaleForm}
        localities={localities}
        sellerPhone={sellerPhone}
        onChangeNumber={startChangeNumber}
        onCancel={backToSelector}
        onDone={goToDashboard}
      />
    );
  }

  /* ── Rent: Room (PG) — dedicated premium wizard, purpose stays "rent" ── */
  if (purpose === "rent" && roomFlowActive) {
    return (
      <RoomFlow
        form={roomForm}
        setForm={setRoomForm}
        localities={localities}
        onCancel={backToSelector}
        onDone={goToDashboard}
      />
    );
  }

  /* ── Standard rent flow (Flat/House/Shop/etc.) ── */
  return (
    <StandardFlow
      form={standardForm}
      setForm={setStandardForm}
      localities={localities}
      onCancel={backToSelector}
      onDone={goToDashboard}
      onPickRoomPg={pickRoomPg}
    />
  );
}
