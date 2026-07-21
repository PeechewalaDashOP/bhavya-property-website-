"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBar } from "@/components/LoadingBar";

export default function DealerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notRegistered, setNotRegistered] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
      body: JSON.stringify({ phone: cleaned, purpose: "dealer_login" }),
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
    setNotRegistered(false);
    const res = await fetch("/api/dealer/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp: cleanedOtp }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Verification failed. Please try again.");
      setNotRegistered(data.code === "not_registered");
      return;
    }
    router.replace("/dealer");
  }

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
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Partner Login
          </div>
        </div>

        {step === "phone" ? (
          <>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Enter your registered phone number — we&apos;ll send a WhatsApp code to verify it&apos;s you.
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
              {error && (
                <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>
              )}
              <button
                onClick={sendOtp}
                disabled={loading}
                style={{
                  background: "var(--red)",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: "15px",
                  fontSize: 16,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Sending…" : "Send OTP →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Code sent to <b style={{ color: "var(--ink)" }}>+91 {phone.replace(/\D/g, "")}</b> on WhatsApp. Valid for 10 minutes.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); setNotRegistered(false); }}
                style={{ ...inputStyle, letterSpacing: 8, fontSize: 22, textAlign: "center" }}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              />
              {error && (
                <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>
              )}
              {notRegistered && (
                <a
                  href="/post-property"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "var(--bg)",
                    color: "var(--color-primary)",
                    fontWeight: 700,
                    fontSize: 14,
                    padding: "12px",
                    borderRadius: 9,
                    border: "1.5px solid var(--color-primary)",
                    textDecoration: "none",
                  }}
                >
                  Listing for the first time? Post your property →
                </a>
              )}
              <button
                onClick={verifyOtp}
                disabled={loading}
                style={{
                  background: "var(--red)",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: "15px",
                  fontSize: 16,
                  opacity: loading ? 0.7 : 1,
                }}
              >
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
                onClick={() => { setStep("phone"); setError(""); setNotRegistered(false); }}
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
