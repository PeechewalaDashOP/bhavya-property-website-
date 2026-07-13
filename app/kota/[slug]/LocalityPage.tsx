"use client";

import { useState } from "react";
import Link from "next/link";
import { Locality } from "@/lib/types";
import { fmt } from "@/lib/format";

type PropertyRow = Record<string, unknown>;

function PropertyCard({ p }: { p: PropertyRow }) {
  const title = String(p.title ?? "");
  const price = Number(p.rent_per_month ?? p.price ?? 0);
  const ptype = String(p.ptype ?? "");
  const slug = String(p.slug ?? "");
  const img = String((p.gallery as string[])?.[0] ?? p.img ?? "");
  const deposit = Number(p.deposit_amount ?? 0);

  const content = (
    <div className="card">
      {img ? (
        <img src={img} alt={title} loading="lazy" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: "8px 8px 0 0" }} />
      ) : (
        <div style={{ width: "100%", height: 180, background: "#f0f2f5", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🏠</div>
      )}
      <div className="cinfo">
        <div className="ctitle">{title}</div>
        <div className="cprice">{fmt(price)}<span style={{ fontSize: 12, fontWeight: 400 }}>/month</span></div>
        {deposit > 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>Deposit: ₹{deposit.toLocaleString("en-IN")}</div>}
        <div className="cbadges">
          <span className="badge">{ptype}</span>
        </div>
      </div>
    </div>
  );

  return slug ? <Link href={`/property/${slug}`} style={{ textDecoration: "none" }}>{content}</Link> : content;
}

function ComingSoonForm({ locality }: { locality: Locality }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const clean = phone.replace(/\D/g, "");
    if (clean.length !== 10) { setError("Enter a valid 10-digit phone number"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/locality-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localityId: locality.id, name: name.trim(), phone: clean }),
    });
    setLoading(false);
    if (!res.ok) { setError("Could not save. Please try again."); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>You&apos;re on the list!</div>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          We&apos;ll notify you on WhatsApp when listings go live in {locality.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Get notified when we launch here</div>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        We&apos;ll send you a WhatsApp message when properties go live in {locality.name}.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14 }}
        />
        <input
          type="tel"
          inputMode="numeric"
          placeholder="10-digit phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 14 }}
        />
        {error && <div style={{ color: "var(--color-primary)", fontSize: 13 }}>{error}</div>}
        <button
          onClick={submit}
          disabled={loading}
          style={{ padding: "12px 0", borderRadius: 8, background: "var(--color-primary)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          {loading ? "Saving…" : "Notify Me →"}
        </button>
      </div>
    </div>
  );
}

export default function LocalityPage({
  locality,
  properties,
}: {
  locality: Locality;
  properties: PropertyRow[];
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Nav */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8ecf0", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
          <Link href="/" style={{ fontSize: 20, textDecoration: "none", color: "var(--ink)" }}>←</Link>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            Prop<span style={{ color: "var(--color-primary)" }}>100</span>
          </span>
        </div>
      </div>

      <div className="wrap" style={{ padding: "24px 16px" }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
          <Link href="/" style={{ color: "var(--muted)" }}>Home</Link>
          {" / "}
          <Link href="/kota" style={{ color: "var(--muted)" }}>Kota</Link>
          {" / "}
          <span>{locality.name}</span>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Properties in {locality.name}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
          {locality.status === "coming_soon"
            ? "We haven't launched here yet — be the first to know."
            : `${properties.length} propert${properties.length === 1 ? "y" : "ies"} available`}
        </p>

        {locality.status === "coming_soon" ? (
          <>
            <div style={{ display: "inline-block", padding: "4px 12px", background: "#fff3cd", color: "#856404", borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 24 }}>
              Coming Soon
            </div>
            <ComingSoonForm locality={locality} />
          </>
        ) : (
          <div className="list">
            {properties.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>No approved listings yet in {locality.name}.</p>
            ) : (
              properties.map((p, i) => <PropertyCard key={String(p.id ?? i)} p={p} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
