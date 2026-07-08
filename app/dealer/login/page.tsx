"use client";

// OTP temporarily disabled — login by phone number only until WhatsApp Business API is approved.
// To revert: restore the two-step sendOtp() + verifyOtp() flow using /api/otp/send and /api/dealer/login/verify.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBar } from "@/components/LoadingBar";

export default function DealerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function login() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/dealer/login/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleaned }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Login failed. Please try again.");
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
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontWeight: 800, fontSize: 22 }}>
            Prop<span style={{ color: "var(--red)" }}>100</span>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
            Dealer Login
          </div>
        </div>

        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
          Enter your registered phone number to access your dealer dashboard.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Phone number (10 digits)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>
              {error}
            </p>
          )}
          <button
            onClick={login}
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
            {loading ? "Logging in…" : "Login →"}
          </button>
        </div>
      </div>
    </div>
  );
}
