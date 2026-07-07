"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBar } from "@/components/LoadingBar";

export default function DealerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      body: JSON.stringify({ phone: cleaned }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send OTP");
      return;
    }
    setStep("otp");
    // Start 60s resend cooldown
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function verifyOtp() {
    const cleanedOtp = otp.replace(/\D/g, "");
    if (cleanedOtp.length !== 6) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/dealer/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp: cleanedOtp }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Verification failed");
      return;
    }
    localStorage.setItem("prop100_dealer_token", data.token);
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
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontWeight: 800, fontSize: 22 }}>
            Prop<span style={{ color: "var(--red)" }}>100</span>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Dealer Login
          </div>
        </div>

        {step === "phone" ? (
          <>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              Enter your registered phone number to receive a one-time password.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Phone number (10 digits)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              />
              {error && (
                <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>
                  {error}
                </p>
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
                {loading ? "Sending…" : "Send OTP"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 4, lineHeight: 1.5 }}>
              OTP sent to{" "}
              <b style={{ color: "var(--ink)" }}>+91 {phone.replace(/\D/g, "")}</b>
            </p>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
              Valid for 10 minutes.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="6-digit OTP"
                value={otp}
                maxLength={6}
                onChange={(e) => setOtp(e.target.value)}
                style={{ ...inputStyle, fontSize: 22, letterSpacing: 6, textAlign: "center" }}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                autoFocus
              />
              {error && (
                <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>
                  {error}
                </p>
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
                {loading ? "Verifying…" : "Verify & Login"}
              </button>
              <button
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                disabled={cooldown > 0 || loading}
                style={{
                  color: "var(--muted)",
                  fontSize: 13,
                  padding: "8px 0",
                  textAlign: "center",
                }}
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
