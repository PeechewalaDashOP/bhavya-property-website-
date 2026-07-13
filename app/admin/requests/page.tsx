"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RequestRow = {
  id: number;
  name: string;
  phone: string;
  created_at: string;
  localities: { name: string; slug: string; status: string } | null;
};

type AreaCount = { name: string; slug: string; count: number };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} style={{ height: 52, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--line)", animation: "pulse 1.5s infinite" }} />
      ))}
    </div>
  );
}

export default function AdminRequestsPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/admin/requests", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setErr("Failed to load requests."); setLoading(false); return; }
      setRows(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  // Area demand summary sorted by count desc
  const areaCounts: AreaCount[] = Object.values(
    rows.reduce<Record<string, AreaCount>>((acc, r) => {
      const name = r.localities?.name ?? "Unknown";
      const slug = r.localities?.slug ?? "";
      if (!acc[slug]) acc[slug] = { name, slug, count: 0 };
      acc[slug].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (r.localities?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Area Requests</h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          People who asked to be notified when a coming-soon area goes live.
        </p>
      </div>

      {err && (
        <div style={{ color: "var(--red)", background: "rgba(220,38,38,0.08)", borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
          {err}
        </div>
      )}

      {/* Demand summary */}
      {!loading && areaCounts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Demand by Area
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {areaCounts.map((a) => (
              <div
                key={a.slug}
                style={{
                  background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: 8, padding: "8px 14px", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--ink)" }}>{a.name}</span>
                <span style={{
                  background: "var(--red)", color: "#fff",
                  borderRadius: 20, padding: "2px 8px",
                  fontSize: 12, fontWeight: 800,
                }}>
                  {a.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name, phone or area…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", maxWidth: 360, padding: "10px 14px",
            border: "1px solid var(--line)", borderRadius: 8,
            fontSize: 14, background: "var(--bg)", color: "var(--ink)", outline: "none",
          }}
        />
      </div>

      {/* Table */}
      {loading ? <Skeleton /> : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)", fontSize: 14 }}>
          {rows.length === 0 ? "No requests yet." : "No results for your search."}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--line)", textAlign: "left" }}>
                {["Name", "Phone", "Area", "Requested On"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--ink)" }}>{r.name}</td>
                  <td style={{ padding: "12px 14px", color: "var(--muted)", fontFamily: "monospace" }}>{r.phone}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{
                      background: "rgba(245,158,11,0.1)", color: "#b45309",
                      borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600,
                    }}>
                      {r.localities?.name ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                    {fmtDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
            {filtered.length} of {rows.length} requests
          </div>
        </div>
      )}
    </div>
  );
}
