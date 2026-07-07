"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) { setError("Supabase is not configured."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.replace("/admin/leads");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--line)",
    borderRadius: 9,
    padding: "13px 14px",
    fontSize: 14.5,
    background: "var(--bg)",
    color: "var(--ink)",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: "36px 28px", width: "100%", maxWidth: 380, boxShadow: "var(--sh)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>
            Kota<span style={{ color: "var(--red)" }}>Property</span>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Admin Dashboard</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, textAlign: "center" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--red)",
              color: "#fff",
              fontWeight: 700,
              borderRadius: 9,
              padding: "14px",
              fontSize: 15,
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
