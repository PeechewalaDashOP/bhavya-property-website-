"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingBar } from "@/components/LoadingBar";

type UnitRow = {
  id: number;
  label: string;
  capacity: number;
  price_per_month: number;
  total_count: number;
  available_count: number;
  last_confirmed_at: string | null;
  sort_order: number;
};

type PropRow = {
  id: number;
  title: string;
  ptype: string;
  loc: string;
  slug: string | null;
  is_approved: boolean;
  property_units: UnitRow[];
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function DealerAvailabilityPage() {
  const router = useRouter();
  const [props, setProps] = useState<PropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [err, setErr] = useState("");

  const fetchProps = useCallback(async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("prop100_dealer_token") : null;
    if (!token) { router.replace("/dealer/login"); return; }

    const res = await fetch("/api/dealer/properties", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem("prop100_dealer_token");
      router.replace("/dealer/login");
      return;
    }
    if (!res.ok) { setErr("Could not load your properties."); setLoading(false); return; }

    const data: PropRow[] = await res.json();
    setProps(data);

    // Seed drafts with current available_count
    const initial: Record<number, number> = {};
    for (const p of data) {
      for (const u of p.property_units) {
        initial[u.id] = u.available_count;
      }
    }
    setDrafts(initial);
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchProps(); }, [fetchProps]);

  async function saveUnit(unitId: number) {
    const token = localStorage.getItem("prop100_dealer_token");
    if (!token) return;

    setSaving(unitId);
    const res = await fetch("/api/dealer/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unitId, availableCount: drafts[unitId] ?? 0 }),
    });
    setSaving(null);

    if (!res.ok) {
      setErr("Save failed. Please try again.");
      return;
    }

    const { availableCount } = await res.json();

    // Update local state so freshness shows "today" immediately
    setProps((prev) =>
      prev.map((p) => ({
        ...p,
        property_units: p.property_units.map((u) =>
          u.id === unitId
            ? { ...u, available_count: availableCount, last_confirmed_at: new Date().toISOString() }
            : u
        ),
      }))
    );
    setDrafts((d) => ({ ...d, [unitId]: availableCount }));
    setSaved((s) => ({ ...s, [unitId]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [unitId]: false })), 2500);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={loading || saving !== null} />

      {/* Header */}
      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/dealer" style={{ color: "#7a8fa3", fontSize: 22, lineHeight: 1, padding: "6px 8px 6px 0" }}>←</Link>
          <span style={{ fontWeight: 800, fontSize: 16 }}>
            Prop<span style={{ color: "var(--color-primary)" }}>100</span>
          </span>
          <span style={{ color: "#7a8fa3", fontSize: 14, fontWeight: 600 }}>Update Availability</span>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 48px" }}>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Tap a unit to update how many beds/rooms are currently available. This keeps buyers informed and builds trust.
        </p>

        {err && (
          <div style={{ color: "var(--color-danger)", fontSize: 14, marginBottom: 16, padding: "12px 14px", background: "var(--color-danger-light)", borderRadius: 10 }}>
            {err}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>Loading your properties…</div>
        ) : props.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏠</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>No properties yet</div>
            <Link href="/dealer/post" style={{ color: "var(--color-primary)", fontWeight: 600, fontSize: 14 }}>Post your first property →</Link>
          </div>
        ) : (
          props.map((p) => (
            <div key={p.id} style={{ marginBottom: 20 }}>
              {/* Property header */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>{p.title}</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  {p.ptype} · {p.loc}
                  {!p.is_approved && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#b45309", fontWeight: 700, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 4, padding: "1px 6px" }}>
                      Pending approval
                    </span>
                  )}
                </div>
              </div>

              {/* Unit rows */}
              {p.property_units.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: "12px 14px", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--line)" }}>
                  No unit rows for this property.
                </div>
              ) : (
                p.property_units.map((u) => {
                  const days = daysSince(u.last_confirmed_at);
                  const isStale = days !== null && days > 7;
                  const isSaved = saved[u.id];
                  const isDirty = drafts[u.id] !== u.available_count;

                  return (
                    <div
                      key={u.id}
                      style={{
                        background: "var(--surface)",
                        border: isStale ? "1px solid rgba(245,158,11,0.4)" : "1px solid var(--line)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        marginBottom: 10,
                      }}
                    >
                      {/* Unit label + last confirmed */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>{u.label}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                            ₹{u.price_per_month.toLocaleString("en-IN")}/mo · {u.total_count} total
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: isStale ? "#b45309" : "var(--muted)", fontWeight: isStale ? 700 : 400 }}>
                            {isStale ? "⚠️ " : ""}
                            Last confirmed: {fmtDate(u.last_confirmed_at)}
                          </div>
                          {days !== null && (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              {days === 0 ? "Today" : `${days} day${days > 1 ? "s" : ""} ago`}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Availability counter */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>Available rooms/beds:</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={() => setDrafts((d) => ({ ...d, [u.id]: Math.max(0, (d[u.id] ?? 0) - 1) }))}
                            style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            −
                          </button>
                          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", minWidth: 28, textAlign: "center" }}>
                            {drafts[u.id] ?? u.available_count}
                          </span>
                          <button
                            onClick={() => setDrafts((d) => ({ ...d, [u.id]: Math.min(u.total_count, (d[u.id] ?? 0) + 1) }))}
                            style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Save button */}
                      <button
                        onClick={() => saveUnit(u.id)}
                        disabled={saving === u.id || isSaved}
                        style={{
                          marginTop: 12,
                          width: "100%",
                          padding: "12px",
                          borderRadius: 10,
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: saving === u.id ? "default" : "pointer",
                          background: isSaved
                            ? "rgba(22,163,74,0.12)"
                            : isDirty
                            ? "var(--color-primary)"
                            : "var(--bg)",
                          color: isSaved
                            ? "var(--color-success)"
                            : isDirty
                            ? "#fff"
                            : "var(--muted)",
                          border: isSaved
                            ? "1px solid rgba(22,163,74,0.3)"
                            : isDirty
                            ? "none"
                            : "1px solid var(--line)",
                          opacity: saving === u.id ? 0.6 : 1,
                        } as React.CSSProperties}
                      >
                        {saving === u.id
                          ? "Saving…"
                          : isSaved
                          ? "✓ Saved!"
                          : isDirty
                          ? "Save & Confirm Availability"
                          : "Confirm — No Changes"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
