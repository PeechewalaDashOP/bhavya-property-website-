"use client";

import { useEffect, useState } from "react";
import { LoadingBar } from "@/components/LoadingBar";

type Enquiry = {
  id: number;
  referenceCode: string;
  category: string | null;
  status: string;
  statusLabel: string;
  createdAt: string;
  property: { title: string; slug: string | null; img: string | null } | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 9,
  padding: "14px",
  fontSize: 16,
  background: "var(--bg)",
  color: "var(--ink)",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--red)",
  color: "#fff",
  fontWeight: 700,
  borderRadius: 10,
  padding: "15px",
  fontSize: 16,
};

export default function AccountPage() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [enquiries, setEnquiries] = useState<Enquiry[] | null>(null);

  /* If the student arrived here mid "Get help from Prop100" (bounced from
     a property page for OTP login), resume that intent straight into
     WhatsApp instead of showing the dashboard. Returns true if it
     redirected away. */
  async function resumePendingConcierge(): Promise<boolean> {
    let pending: { propertyId: number | null; sourceUrl: string } | null = null;
    try {
      const raw = sessionStorage.getItem("p100_pending_concierge");
      if (raw) pending = JSON.parse(raw);
    } catch {}
    if (!pending) return false;
    sessionStorage.removeItem("p100_pending_concierge");

    const res = await fetch("/api/concierge/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pending),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.waLink) {
      window.location.href = data.waLink;
      return true;
    }
    return false;
  }

  async function checkSession() {
    setChecking(true);
    const res = await fetch("/api/student/session");
    if (res.ok) {
      const data = await res.json();
      setLoggedIn(true);
      setName(data.name);
      setPhone(data.phone);
      const redirected = await resumePendingConcierge();
      if (!redirected) loadEnquiries();
    } else {
      setLoggedIn(false);
    }
    setChecking(false);
  }

  async function loadEnquiries() {
    const res = await fetch("/api/student/enquiries");
    if (res.ok) {
      const data = await res.json();
      setEnquiries(data.enquiries);
    }
  }

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function sendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleaned, purpose: "student_login" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send OTP. Please try again.");
      return;
    }
    setOtp("");
    setStep("otp");
    startCooldown();
  }

  async function verifyOtp() {
    const cleanedOtp = otp.replace(/\D/g, "");
    if (cleanedOtp.length !== 6) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/student/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp: cleanedOtp }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Verification failed. Please try again.");
      return;
    }
    setLoggedIn(true);
    setName(data.student.name);
    const redirected = await resumePendingConcierge();
    if (!redirected) loadEnquiries();
  }

  async function logout() {
    await fetch("/api/student/logout", { method: "POST" });
    setLoggedIn(false);
    setEnquiries(null);
    setStep("phone");
    setOtp("");
    setPhone("");
  }

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <LoadingBar loading={true} />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          padding: 16,
        }}
      >
        <LoadingBar loading={loading} />
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            padding: "36px 28px",
            width: "100%",
            maxWidth: 380,
            boxShadow: "var(--sh)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontWeight: 800, fontSize: 22 }}>
              Prop<span style={{ color: "var(--red)" }}>100</span>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>My Account</div>
          </div>

          {step === "phone" ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                Enter your phone number — we&apos;ll send a WhatsApp code to log you in.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Phone number (10 digits)"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(""); }}
                  style={inputStyle}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                />
                {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>}
                <button onClick={sendOtp} disabled={loading} style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Sending…" : "Send OTP →"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
                Code sent to <b style={{ color: "var(--ink)" }}>+91 {phone.replace(/\D/g, "")}</b> on WhatsApp.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  style={{ ...inputStyle, letterSpacing: 8, fontSize: 22, textAlign: "center" }}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                />
                {error && <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>}
                <button onClick={verifyOtp} disabled={loading} style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Verifying…" : "Verify & Login →"}
                </button>
                <button
                  onClick={sendOtp}
                  disabled={loading || cooldown > 0}
                  style={{ color: "var(--muted)", fontSize: 13, padding: "8px 0", textAlign: "center" }}
                >
                  {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Didn't receive it? Resend OTP"}
                </button>
                <button
                  onClick={() => { setStep("phone"); setError(""); }}
                  disabled={loading}
                  style={{ color: "var(--muted)", fontSize: 13, padding: "4px 0", textAlign: "center" }}
                >
                  ← Change phone number
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 20 }}>
          Prop<span style={{ color: "var(--red)" }}>100</span>{" "}
          <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 15 }}>My Account</span>
        </div>

        <div
          style={{
            background: "var(--surface)",
            borderRadius: 14,
            padding: "20px",
            boxShadow: "var(--sh)",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{name || "Prop100 Student"}</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>+91 {phone}</div>
          </div>
          <button
            onClick={logout}
            style={{ color: "var(--muted)", fontSize: 13, border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px" }}
          >
            Logout
          </button>
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>My Enquiries</div>

        {enquiries === null ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
        ) : enquiries.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 14,
              padding: "24px 20px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: 14,
              boxShadow: "var(--sh)",
            }}
          >
            No enquiries yet. Browse properties and tap &ldquo;Get contact details&rdquo; to get started.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {enquiries.map((e) => (
              <div
                key={e.id}
                style={{
                  background: "var(--surface)",
                  borderRadius: 12,
                  padding: "16px",
                  boxShadow: "var(--sh)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {e.property?.title || (e.category ? `${e.category} enquiry` : "General enquiry")}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      Ref: {e.referenceCode} · {new Date(e.createdAt).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--color-primary)",
                      background: "var(--bg)",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "4px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
