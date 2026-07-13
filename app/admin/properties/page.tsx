"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingBar } from "@/components/LoadingBar";
import { fmt } from "@/lib/format";
import { HostelMeta } from "@/lib/types";
import {
  HOUSE_RULE_LABELS, SERVICE_LABELS, COMMON_AMENITY_LABELS,
  TENANT_TYPE_LABELS, PARKING_TYPE_LABELS, gateTimeLabel, noticePeriodLabel,
} from "@/lib/hostelLabels";
import styles from "./styles.module.css";

type ListingStatus = "pending" | "live" | "paused_owner" | "paused_admin" | "rejected";

type PropRow = {
  id: number;
  title: string;
  type: string;
  ptype: string;
  loc: string;
  price: number | null;
  rent_per_month: number | null;
  deposit_amount: number | null;
  is_approved: boolean;
  listing_status: ListingStatus;
  slug: string | null;
  img: string | null;
  videos: string[] | null;
  gallery: string[] | null;
  features: string[] | null;
  description: string | null;
  created_at: string;
  hostel_meta: HostelMeta | null;
  dealers: { name: string; phone: string; is_active: boolean; role: string | null } | null;
};

const STATUS_BADGE: Record<ListingStatus, { label: string; bg: string; fg: string }> = {
  pending:      { label: "⏳ Under Review",     bg: "rgba(245,158,11,0.12)", fg: "#b45309" },
  live:         { label: "✓ Live",              bg: "rgba(22,160,106,0.12)", fg: "#16a06a" },
  paused_owner: { label: "⏸️ Paused by Owner",  bg: "rgba(107,116,128,0.12)", fg: "#6b7480" },
  paused_admin: { label: "⏸️ Paused by Admin",  bg: "rgba(107,116,128,0.12)", fg: "#6b7480" },
  rejected:     { label: "🔴 Rejected",         bg: "rgba(220,38,38,0.10)", fg: "var(--color-danger)" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function SkeletonCard() {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <span className={styles.sk} style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span className={styles.sk} style={{ width: "65%", height: 16, marginBottom: 10 }} />
          <span className={styles.sk} style={{ width: "45%", height: 13, marginBottom: 10 }} />
          <span className={styles.sk} style={{ width: "55%", height: 13 }} />
        </div>
      </div>
    </div>
  );
}

export default function AdminPropertiesPage() {
  const router = useRouter();
  const [props, setProps] = useState<PropRow[]>([]);
  const [filter, setFilter] = useState<"pending" | "live" | "paused" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const fetchProps = useCallback(async () => {
    setLoading(true);
    setErr("");
    if (!supabase) { router.replace("/admin/login"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/admin/login"); return; }

    const res = await fetch(`/api/admin/properties?filter=${filter}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) { setErr("Failed to load properties."); setLoading(false); return; }
    setProps(await res.json());
    setLoading(false);
  }, [filter, router]);

  useEffect(() => { fetchProps(); }, [fetchProps]);

  async function act(id: number, action: "approve" | "reject" | "pause" | "unpause") {
    if (!supabase) return;
    setActing(id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      // Every action changes listing_status, so on any filtered (non-"all")
      // tab the row simply no longer belongs there — just re-fetch to stay correct.
      if (filter !== "all") {
        setProps((prev) => prev.filter((p) => p.id !== id));
      } else {
        const next: Record<string, { is_approved: boolean; listing_status: ListingStatus }> = {
          approve: { is_approved: true, listing_status: "live" },
          reject: { is_approved: false, listing_status: "rejected" },
          pause: { is_approved: false, listing_status: "paused_admin" },
          unpause: { is_approved: true, listing_status: "live" },
        };
        setProps((prev) => prev.map((p) => (p.id === id ? { ...p, ...next[action] } : p)));
      }
      setExpanded(null);
    } else {
      await fetchProps();
    }
    setActing(null);
  }

  const pendingCount = props.filter((p) => p.listing_status === "pending").length;

  return (
    <div>
      <LoadingBar loading={loading || acting !== null} />

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>
          Properties{" "}
          {!loading && filter === "pending" && pendingCount > 0 && (
            <span style={{ color: "var(--color-warning)", fontWeight: 500, fontSize: 16 }}>
              {pendingCount} pending
            </span>
          )}
          {!loading && filter !== "pending" && (
            <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 16 }}>
              {props.length}
            </span>
          )}
        </h1>
        <button
          onClick={fetchProps}
          disabled={loading}
          style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", opacity: loading ? 0.5 : 1 }}
        >
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["pending", "live", "paused", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? styles.tabActive : styles.tab}
          >
            {{ pending: "⏳ Under Review", live: "✓ Live", paused: "⏸️ Paused", rejected: "🔴 Rejected", all: "All Properties" }[f]}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ color: "var(--color-danger)", padding: "20px 0", fontWeight: 600 }}>{err}</div>
      )}

      {loading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : props.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            {filter === "pending" ? "Nothing pending — all clear!" : "No properties yet"}
          </div>
          <div style={{ fontSize: 14 }}>
            {filter === "pending" ? "Switch to 'All Properties' to see live listings." : "Partners can submit via their dashboard."}
          </div>
        </div>
      ) : (
        props.map((p) => {
          const displayPrice = p.rent_per_month ?? p.price ?? 0;
          const isOpen = expanded === p.id;
          return (
            <div key={p.id} className={styles.propCard}>
              {/* Card summary — tap to expand */}
              <div
                style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "flex-start" }}
                onClick={() => setExpanded(isOpen ? null : p.id)}
              >
                {p.img ? (
                  <img
                    src={p.img}
                    alt=""
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 80, height: 80, borderRadius: 10, background: "var(--line)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>
                    {p.type === "rent" ? "🔑" : "🏷️"}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                    {p.ptype} · {p.loc}
                    {p.dealers?.name && (
                      <span>
                        {" "}· <strong style={{ color: "var(--ink)" }}>{p.dealers.name}</strong>
                        {p.dealers.role === "owner" && (
                          <span style={{ fontSize: 10, background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "1px 5px", fontWeight: 800, marginLeft: 5, verticalAlign: "middle" }}>
                            Self-listed
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    {fmt(displayPrice)}
                    {p.type === "rent" ? <span style={{ fontWeight: 400 }}>/mo</span> : ""}
                    {p.deposit_amount ? (
                      <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                        + ₹{p.deposit_amount.toLocaleString("en-IN")} dep
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {fmtDate(p.created_at)} · {p.gallery?.length ?? 0} photos · {p.videos?.length ?? 0} videos
                    </span>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6,
                        background: STATUS_BADGE[p.listing_status].bg,
                        color: STATUS_BADGE[p.listing_status].fg,
                      }}
                    >
                      {STATUS_BADGE[p.listing_status].label}
                    </span>
                  </div>
                </div>

                <div style={{ color: "var(--muted)", fontSize: 16, flexShrink: 0, marginTop: 4 }}>
                  {isOpen ? "▲" : "▼"}
                </div>
              </div>

              {/* Expanded detail panel */}
              {isOpen && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>

                  {p.description && (
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
                      {p.description}
                    </p>
                  )}

                  {p.features && p.features.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {p.features.map((f) => (
                        <span key={f} style={{ fontSize: 12, padding: "3px 10px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 20, color: "var(--muted)", fontWeight: 600 }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Photo strip */}
                  {(p.gallery?.length ?? 0) > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Photos</div>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                        {p.gallery!.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video links */}
                  {(p.videos?.length ?? 0) > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Videos</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {p.videos!.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 13, color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}
                          >
                            ▶ Video {i + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PG/Hostel wizard details — only present for the new hostel flow */}
                  {p.hostel_meta && (
                    <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>
                        PG / Hostel Details
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--ink)" }}>
                        {p.hostel_meta.pg_name && (
                          <div><strong>{p.hostel_meta.pg_name}</strong>{p.hostel_meta.user_type && <span style={{ color: "var(--muted)" }}> — listed by {p.hostel_meta.user_type}</span>}</div>
                        )}
                        {p.hostel_meta.address && (
                          <div>📍 {p.hostel_meta.address}{p.hostel_meta.landmark ? `, near ${p.hostel_meta.landmark}` : ""}{p.hostel_meta.pincode ? ` — ${p.hostel_meta.pincode}` : ""}</div>
                        )}
                        {p.hostel_meta.operational_since && (
                          <div>🗓 Running since {p.hostel_meta.operational_since}{p.hostel_meta.present_on_floor ? ` · Floor: ${p.hostel_meta.present_on_floor}` : ""}</div>
                        )}
                        {p.hostel_meta.tenant_types && p.hostel_meta.tenant_types.length > 0 && (
                          <div>🎓 For: {p.hostel_meta.tenant_types.map((t) => TENANT_TYPE_LABELS[t] ?? t).join(", ")}</div>
                        )}
                        {p.hostel_meta.gate_timing_enabled && p.hostel_meta.gate_closing_time && (
                          <div>🚪 Gate closes: {gateTimeLabel(p.hostel_meta.gate_closing_time)}</div>
                        )}
                        {p.hostel_meta.notice_period && (
                          <div>📝 Notice period: {noticePeriodLabel(p.hostel_meta.notice_period)}</div>
                        )}
                        {p.hostel_meta.services && p.hostel_meta.services.length > 0 && (
                          <div>🧺 Services: {p.hostel_meta.services.map((s) => SERVICE_LABELS[s]?.label ?? s).join(", ")}</div>
                        )}
                        {p.hostel_meta.house_rules && p.hostel_meta.house_rules.length > 0 && (
                          <div>🚫 Rules: {p.hostel_meta.house_rules.map((r) => HOUSE_RULE_LABELS[r] ?? r).join(", ")}</div>
                        )}
                        {p.hostel_meta.common_amenities && p.hostel_meta.common_amenities.length > 0 && (
                          <div>✨ Amenities: {p.hostel_meta.common_amenities.map((a) => COMMON_AMENITY_LABELS[a]?.label ?? a).join(", ")}</div>
                        )}
                        {p.hostel_meta.parking_enabled && p.hostel_meta.parking_types && p.hostel_meta.parking_types.length > 0 && (
                          <div>🅿️ Parking: {p.hostel_meta.parking_types.map((t) => PARKING_TYPE_LABELS[t] ?? t).join(", ")}</div>
                        )}
                        {p.hostel_meta.usp_text && (
                          <div>⭐ USP{p.hostel_meta.usp_category ? ` (${p.hostel_meta.usp_category})` : ""}: {p.hostel_meta.usp_text}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Partner / owner info */}
                  {p.dealers && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                      {p.dealers.role === "owner" ? "Owner" : "Partner"}:{" "}
                      <strong style={{ color: "var(--ink)" }}>{p.dealers.name}</strong>
                      {p.dealers.phone && (
                        <a href={`tel:${p.dealers.phone}`} style={{ color: "var(--color-primary)", fontWeight: 600, marginLeft: 6 }}>
                          {p.dealers.phone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Action buttons — depend on current lifecycle status */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {p.listing_status === "pending" && (
                      <>
                        <button onClick={() => act(p.id, "approve")} disabled={acting === p.id} className={styles.btnApprove}>
                          ✓ Approve & Publish
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Reject "${p.title}"? It stays visible to the owner as rejected — not deleted.`)) act(p.id, "reject");
                          }}
                          disabled={acting === p.id}
                          className={styles.btnReject}
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {p.listing_status === "live" && (
                      <button
                        onClick={() => {
                          if (confirm(`Pause "${p.title}"? It will come off the public site until you unpause it.`)) act(p.id, "pause");
                        }}
                        disabled={acting === p.id}
                        className={styles.btnReject}
                      >
                        ⏸️ Pause
                      </button>
                    )}
                    {(p.listing_status === "paused_owner" || p.listing_status === "paused_admin") && (
                      <button onClick={() => act(p.id, "unpause")} disabled={acting === p.id} className={styles.btnApprove}>
                        ▶ Unpause & Publish
                      </button>
                    )}
                    {p.listing_status === "rejected" && (
                      <button onClick={() => act(p.id, "approve")} disabled={acting === p.id} className={styles.btnApprove}>
                        ✓ Approve & Publish
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
