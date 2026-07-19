"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
type StatusFilter = "pending" | "live" | "paused" | "rejected" | "all";
type Order = "new" | "old" | "price_desc" | "price_asc" | "leads";

const PAGE_SIZE = 20;

type PropUnit = {
  id: number;
  label: string;
  capacity: number;
  price_per_month: number;
  deposit_amount: number | null;
  total_count: number;
  available_count: number;
  has_ac: boolean;
  has_cooler: boolean;
  attached_bath: boolean;
  meals_included: boolean;
  description: string | null;
  sort_order: number;
};

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
  is_verified: boolean;
  is_featured: boolean;
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
  sqft: number | null;
  furnishing_status: string | null;
  gender_preference: string | null;
  available_from: string | null;
  meals_included: boolean;
  min_stay_months: number | null;
  floor_number: number | null;
  total_floors: number | null;
  attached_bathroom: boolean;
  parking_available: boolean;
  wifi_included: boolean;
  nearest_coaching_hub: string | null;
  lat: number | null;
  lng: number | null;
  property_units: PropUnit[] | null;
};

type Counts = {
  status: { pending: number; live: number; paused: number; rejected: number; all: number };
  loc: Record<string, number>;
  ptype: Record<string, number>;
  oldestPendingAt: string | null;
};

const STATUS_BADGE: Record<ListingStatus, { label: string; bg: string; fg: string }> = {
  pending:      { label: "⏳ Under Review",     bg: "rgba(245,158,11,0.12)", fg: "#b45309" },
  live:         { label: "✓ Live",              bg: "rgba(22,160,106,0.12)", fg: "#16a06a" },
  paused_owner: { label: "⏸️ Paused by Owner",  bg: "rgba(107,116,128,0.12)", fg: "#6b7480" },
  paused_admin: { label: "⏸️ Paused by Admin",  bg: "rgba(107,116,128,0.12)", fg: "#6b7480" },
  rejected:     { label: "🔴 Rejected",         bg: "rgba(220,38,38,0.10)", fg: "var(--color-danger)" },
};

// Muted, brand-consistent palette for the type-split bar — cycles if there
// are ever more property types than colors.
const SPLIT_COLORS = ["#0F766E", "#2DD4BF", "#B45309", "#6366F1", "#DB2777", "#65A30D", "#64748B"];

const editLabelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "var(--muted)", marginBottom: 3 };
const editInputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid var(--line)", borderRadius: 7, padding: "7px 9px",
  fontSize: 13, background: "#fff", color: "var(--ink)", boxSizing: "border-box",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function waitingLabel(createdAt: string): { text: string; old: boolean } {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return { text: "just now", old: false };
  if (hours < 48) return { text: `waiting ${Math.floor(hours)}h`, old: false };
  return { text: `waiting ${Math.floor(hours / 24)}d`, old: true };
}

// Small rAF count-up — respects prefers-reduced-motion by jumping straight
// to the final value instead of animating.
function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDisplay(value); prevRef.current = value; return; }

    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 500;
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{display}</>;
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

// useSearchParams() requires a Suspense boundary in the App Router, or
// static prerendering of this page fails the production build outright
// (not just a warning) — Next.js needs a fallback to show while the
// client-only searchParams-dependent content resolves.
export default function AdminPropertiesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Loading…</div>}>
      <PropertiesContent />
    </Suspense>
  );
}

function PropertiesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filter, setFilter] = useState<StatusFilter>((searchParams.get("filter") as StatusFilter) || "pending");
  const [loc, setLoc] = useState(searchParams.get("loc") ?? "");
  const [ptype, setPtype] = useState(searchParams.get("ptype") ?? "");
  const [qInput, setQInput] = useState(searchParams.get("q") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [order, setOrder] = useState<Order>((searchParams.get("order") as Order) || "new");

  const [props, setProps] = useState<PropRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [leadCounts, setLeadCounts] = useState<Record<number, number>>({});
  const [areaList, setAreaList] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [flashedId, setFlashedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Debounce free-text search — 300ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // Filter state -> URL (bookmarkable/shareable views, survives refresh).
  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "pending") params.set("filter", filter);
    if (loc) params.set("loc", loc);
    if (ptype) params.set("ptype", ptype);
    if (q) params.set("q", q);
    if (order !== "new") params.set("order", order);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, loc, ptype, q, order]);

  const fetchProps = useCallback(async (nextOffset: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setErr("");
    if (!supabase) { router.replace("/admin/login"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/admin/login"); return; }

    const params = new URLSearchParams({ filter, offset: String(nextOffset), order });
    if (loc) params.set("loc", loc);
    if (ptype) params.set("ptype", ptype);
    if (q) params.set("q", q);

    const res = await fetch(`/api/admin/properties?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) { setErr("Failed to load properties."); setLoading(false); setLoadingMore(false); return; }
    const data = await res.json();
    setProps((prev) => (append ? [...prev, ...data.rows] : data.rows));
    setTotal(data.total);
    setCounts(data.counts);
    setLeadCounts((prev) => (append ? { ...prev, ...data.leadCounts } : data.leadCounts));
    setAreaList(data.areas);
    setOffset(nextOffset);
    setLoading(false);
    setLoadingMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, loc, ptype, q, order, router]);

  useEffect(() => { fetchProps(0, false); }, [filter, loc, ptype, q, order]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    fetchProps(offset + PAGE_SIZE, true);
  }

  function refresh() {
    fetchProps(0, false);
  }

  function flash(id: number) {
    setFlashedId(id);
    setTimeout(() => setFlashedId(null), 700);
  }

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
      if (filter !== "all") {
        setProps((prev) => prev.filter((p) => p.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      } else {
        const next: Record<string, { is_approved: boolean; listing_status: ListingStatus }> = {
          approve: { is_approved: true, listing_status: "live" },
          reject: { is_approved: false, listing_status: "rejected" },
          pause: { is_approved: false, listing_status: "paused_admin" },
          unpause: { is_approved: true, listing_status: "live" },
        };
        setProps((prev) => prev.map((p) => (p.id === id ? { ...p, ...next[action] } : p)));
        flash(id);
      }
      setExpanded((cur) => (cur === id ? null : cur));
    } else {
      await fetchProps(0, false);
    }
    setActing(null);
  }

  async function deleteProperty(p: PropRow) {
    if (!supabase) return;
    const sure = confirm(
      `Permanently delete "${p.title}"? This cannot be undone. Past leads for it are kept for records, but the listing itself is gone for good.`
    );
    if (!sure) return;
    setActing(p.id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/properties?id=${p.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProps((prev) => prev.filter((row) => row.id !== p.id));
      setTotal((t) => Math.max(0, t - 1));
      setExpanded(null);
    } else {
      alert(data.error ?? "Failed to delete property.");
    }
    setActing(null);
  }

  function setField(key: string, value: string | boolean) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function openEdit(p: PropRow) {
    setEditingId(p.id);
    setEditErr("");
    setEditForm({
      title: p.title ?? "",
      price: String((p.type === "rent" ? p.rent_per_month : p.price) ?? ""),
      deposit_amount: String(p.deposit_amount ?? ""),
      sqft: String(p.sqft ?? ""),
      furnishing_status: p.furnishing_status ?? "",
      gender_preference: p.gender_preference ?? "",
      available_from: p.available_from ?? "",
      min_stay_months: String(p.min_stay_months ?? ""),
      floor_number: String(p.floor_number ?? ""),
      total_floors: String(p.total_floors ?? ""),
      nearest_coaching_hub: p.nearest_coaching_hub ?? "",
      description: p.description ?? "",
      meals_included: p.meals_included,
      attached_bathroom: p.attached_bathroom,
      parking_available: p.parking_available,
      wifi_included: p.wifi_included,
      is_featured: p.is_featured,
      is_verified: p.is_verified,
    });
  }

  async function saveEdit(p: PropRow) {
    if (!supabase) return;
    setEditSaving(true);
    setEditErr("");
    const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
    const fields: Record<string, unknown> = {
      title: editForm.title,
      [p.type === "rent" ? "rent_per_month" : "price"]: Number(editForm.price) || 0,
      deposit_amount: numOrNull(editForm.deposit_amount as string),
      sqft: numOrNull(editForm.sqft as string),
      furnishing_status: editForm.furnishing_status || null,
      gender_preference: editForm.gender_preference || null,
      available_from: editForm.available_from || null,
      min_stay_months: numOrNull(editForm.min_stay_months as string),
      floor_number: numOrNull(editForm.floor_number as string),
      total_floors: numOrNull(editForm.total_floors as string),
      nearest_coaching_hub: editForm.nearest_coaching_hub || null,
      description: editForm.description || null,
      meals_included: !!editForm.meals_included,
      attached_bathroom: !!editForm.attached_bathroom,
      parking_available: !!editForm.parking_available,
      wifi_included: !!editForm.wifi_included,
      is_featured: !!editForm.is_featured,
      is_verified: !!editForm.is_verified,
    };
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/properties", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ id: p.id, action: "edit", fields }),
    });
    const data = await res.json().catch(() => ({}));
    setEditSaving(false);
    if (!res.ok) { setEditErr(data.error ?? "Failed to save changes"); return; }
    setEditingId(null);
    flash(p.id);
    await fetchProps(0, false);
  }

  async function copyLink(p: PropRow) {
    if (!p.slug) return;
    const url = `${window.location.origin}/property/${p.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      alert(url); // clipboard denied — at least show it
    }
  }

  function clearFilter(which: "loc" | "ptype" | "q") {
    if (which === "loc") setLoc("");
    else if (which === "ptype") setPtype("");
    else { setQInput(""); setQ(""); }
  }

  function clearAllFilters() {
    setLoc(""); setPtype(""); setQInput(""); setQ("");
  }

  const hasFilters = !!(loc || ptype || q);
  const pausedRejected = (counts?.status.paused ?? 0) + (counts?.status.rejected ?? 0);
  const typeEntries = counts ? Object.entries(counts.ptype).sort((a, b) => b[1] - a[1]) : [];
  const typeTotal = typeEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div>
      <LoadingBar loading={loading || acting !== null} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Properties</h1>
        <button
          onClick={refresh}
          disabled={loading}
          style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", opacity: loading ? 0.5 : 1 }}
        >
          Refresh
        </button>
      </div>

      {/* Overview strip */}
      {counts && (
        <div className={styles.statGrid}>
          <button className={`${styles.statCard} ${filter === "all" ? styles.statCardActive : ""}`} onClick={() => setFilter("all")}>
            <div className={styles.statNum}><CountUp value={counts.status.all} /></div>
            <div className={styles.statLabel}>Total</div>
          </button>
          <button className={`${styles.statCard} ${filter === "pending" ? styles.statCardActive : ""}`} onClick={() => setFilter("pending")}>
            <div className={styles.statNum} style={{ color: counts.status.pending > 0 ? "#b45309" : undefined }}>
              ⏳ <CountUp value={counts.status.pending} />
            </div>
            <div className={styles.statLabel}>Pending</div>
          </button>
          <button className={`${styles.statCard} ${filter === "live" ? styles.statCardActive : ""}`} onClick={() => setFilter("live")}>
            <div className={styles.statNum} style={{ color: "#16a06a" }}>✓ <CountUp value={counts.status.live} /></div>
            <div className={styles.statLabel}>Live</div>
          </button>
          <button className={`${styles.statCard} ${filter === "paused" ? styles.statCardActive : ""}`} onClick={() => setFilter("paused")}>
            <div className={styles.statNum}>⏸ <CountUp value={pausedRejected} /></div>
            <div className={styles.statLabel}>Paused + Rejected</div>
          </button>
        </div>
      )}

      {/* Type-split infographic */}
      {typeTotal > 0 && (
        <>
          <div className={styles.splitBar}>
            {typeEntries.map(([t, n], i) => (
              <div
                key={t}
                className={styles.splitSeg}
                title={`${t}: ${n}`}
                onClick={() => setPtype(ptype === t ? "" : t)}
                style={{ flexGrow: n, background: SPLIT_COLORS[i % SPLIT_COLORS.length], opacity: ptype && ptype !== t ? 0.35 : 1 }}
              />
            ))}
          </div>
          <div className={styles.splitLegend}>
            {typeEntries.map(([t, n], i) => (
              <span key={t} className={styles.splitLegendItem} onClick={() => setPtype(ptype === t ? "" : t)}>
                <span className={styles.splitDot} style={{ background: SPLIT_COLORS[i % SPLIT_COLORS.length] }} />
                {t} {n}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Attention banner */}
      {counts && counts.status.pending > 0 && (
        <div
          className={styles.banner}
          onClick={() => { setFilter("pending"); setOrder("old"); }}
        >
          <span className={styles.bannerText}>
            ⏳ {counts.status.pending} listing{counts.status.pending === 1 ? "" : "s"} waiting for review
            {counts.oldestPendingAt && ` · oldest ${fmtDate(counts.oldestPendingAt)}`}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>Review →</span>
        </div>
      )}

      <div className={styles.stickyBar}>
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        {/* Facet row */}
        <div className={styles.facetRow}>
          <select className={styles.facetSelect} value={loc} onChange={(e) => setLoc(e.target.value)}>
            <option value="">All areas</option>
            {areaList.map((a) => (
              <option key={a} value={a}>{a} ({counts?.loc[a] ?? 0})</option>
            ))}
          </select>
          <select className={styles.facetSelect} value={ptype} onChange={(e) => setPtype(e.target.value)}>
            <option value="">All types</option>
            {typeEntries.map(([t, n]) => (
              <option key={t} value={t}>{t} ({n})</option>
            ))}
          </select>
          <input
            className={styles.facetSearch}
            placeholder="🔎 Search title or partner…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <select className={styles.sortSelect} value={order} onChange={(e) => setOrder(e.target.value as Order)}>
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
            <option value="price_desc">Price: high → low</option>
            <option value="price_asc">Price: low → high</option>
            <option value="leads">Most leads</option>
          </select>
        </div>

        {/* Filter chips */}
        {hasFilters && (
          <div className={styles.chipRow}>
            {loc && <span className={styles.chip}>{loc}<span className={styles.chipX} onClick={() => clearFilter("loc")}>✕</span></span>}
            {ptype && <span className={styles.chip}>{ptype}<span className={styles.chipX} onClick={() => clearFilter("ptype")}>✕</span></span>}
            {q && <span className={styles.chip}>&ldquo;{q}&rdquo;<span className={styles.chipX} onClick={() => clearFilter("q")}>✕</span></span>}
            <span className={styles.clearAll} onClick={clearAllFilters}>Clear all</span>
          </div>
        )}

        {!loading && (
          <div className={styles.resultCount}>
            Showing {props.length} of {total}
          </div>
        )}
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
          <div style={{ fontSize: 36, marginBottom: 10 }}>{hasFilters ? "🔍" : "✓"}</div>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            {hasFilters
              ? "No properties match these filters"
              : filter === "pending" ? "Nothing pending — all clear!" : "No properties yet"}
          </div>
          <div style={{ fontSize: 14, marginBottom: hasFilters ? 16 : 0 }}>
            {hasFilters
              ? `Try widening ${[loc && "area", ptype && "type", q && "search"].filter(Boolean).join(", ")}.`
              : filter === "pending" ? "Switch to 'All Properties' to see live listings." : "Partners can submit via their dashboard."}
          </div>
          {hasFilters && (
            <button onClick={clearAllFilters} className={styles.btnEdit} style={{ display: "inline-block" }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {props.map((p) => {
            const displayPrice = p.rent_per_month ?? p.price ?? 0;
            const isOpen = expanded === p.id;
            const wait = p.listing_status === "pending" ? waitingLabel(p.created_at) : null;
            const leads = leadCounts[p.id] ?? 0;
            return (
              <div key={p.id} className={`${styles.propCard} ${flashedId === p.id ? styles.propCardFlash : ""}`}>
                {/* Card summary — tap to expand */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", flex: 1, minWidth: 0 }}
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
                        {wait && (
                          <span className={`${styles.waitBadge} ${wait.old ? styles.waitBadgeOld : ""}`}>{wait.text}</span>
                        )}
                        {leads > 0 && <span className={styles.leadBadge}>📞 {leads} lead{leads === 1 ? "" : "s"}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <div style={{ color: "var(--muted)", fontSize: 16, cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : p.id)}>
                      {isOpen ? "▲" : "▼"}
                    </div>
                    {p.listing_status === "pending" && (
                      <button
                        className={styles.quickApprove}
                        disabled={acting === p.id}
                        onClick={(e) => { e.stopPropagation(); act(p.id, "approve"); }}
                        title="Approve & publish without opening details"
                      >
                        ✓ Approve
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded detail panel — always in the DOM, animated open/closed via CSS grid-rows */}
                <div className={`${styles.expandWrap} ${isOpen ? styles.expandWrapOpen : ""}`}>
                  <div className={styles.expandInner}>
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>

                      {p.description && (
                        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
                          {p.description}
                        </p>
                      )}

                      {/* Full listing details — every field/toggle captured at post time.
                          Edit mode swaps this block for real inputs bound to editForm. */}
                      {editingId === p.id ? (
                        <div style={{ background: "var(--bg)", border: "1.5px solid var(--color-primary)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--color-primary)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>
                            Editing Listing
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 10 }}>
                            <label style={{ gridColumn: "1 / -1" }}>
                              <div style={editLabelStyle}>Title</div>
                              <input value={editForm.title as string} onChange={(e) => setField("title", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>{p.type === "rent" ? "Rent (₹/mo)" : "Price (₹)"}</div>
                              <input type="number" value={editForm.price as string} onChange={(e) => setField("price", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Deposit (₹)</div>
                              <input type="number" value={editForm.deposit_amount as string} onChange={(e) => setField("deposit_amount", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Sqft</div>
                              <input type="number" value={editForm.sqft as string} onChange={(e) => setField("sqft", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Furnishing</div>
                              <select value={editForm.furnishing_status as string} onChange={(e) => setField("furnishing_status", e.target.value)} style={editInputStyle}>
                                <option value="">—</option>
                                <option value="furnished">Furnished</option>
                                <option value="semi-furnished">Semi-furnished</option>
                                <option value="unfurnished">Unfurnished</option>
                              </select>
                            </label>
                            <label>
                              <div style={editLabelStyle}>Gender</div>
                              <select value={editForm.gender_preference as string} onChange={(e) => setField("gender_preference", e.target.value)} style={editInputStyle}>
                                <option value="">—</option>
                                <option value="boys">Boys</option>
                                <option value="girls">Girls</option>
                                <option value="any">Any</option>
                              </select>
                            </label>
                            <label>
                              <div style={editLabelStyle}>Available from</div>
                              <input type="date" value={editForm.available_from as string} onChange={(e) => setField("available_from", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Min stay (months)</div>
                              <input type="number" value={editForm.min_stay_months as string} onChange={(e) => setField("min_stay_months", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Floor</div>
                              <input type="number" value={editForm.floor_number as string} onChange={(e) => setField("floor_number", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Total floors</div>
                              <input type="number" value={editForm.total_floors as string} onChange={(e) => setField("total_floors", e.target.value)} style={editInputStyle} />
                            </label>
                            <label>
                              <div style={editLabelStyle}>Nearest coaching</div>
                              <select value={editForm.nearest_coaching_hub as string} onChange={(e) => setField("nearest_coaching_hub", e.target.value)} style={editInputStyle}>
                                <option value="">—</option>
                                {["Allen", "Resonance", "FIITJEE", "Vibrant", "Motion", "Other"].map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label style={{ display: "block", marginBottom: 10 }}>
                            <div style={editLabelStyle}>Description</div>
                            <textarea
                              value={editForm.description as string}
                              onChange={(e) => setField("description", e.target.value)}
                              rows={3}
                              style={{ ...editInputStyle, resize: "vertical", fontFamily: "inherit" }}
                            />
                          </label>
                          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 12, fontSize: 13 }}>
                            {([
                              ["meals_included", "Meals included"],
                              ["attached_bathroom", "Attached bath"],
                              ["parking_available", "Parking"],
                              ["wifi_included", "WiFi"],
                              ["is_featured", "Featured"],
                              ["is_verified", "Verified"],
                            ] as const).map(([key, label]) => (
                              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                <input type="checkbox" checked={!!editForm[key]} onChange={(e) => setField(key, e.target.checked)} />
                                {label}
                              </label>
                            ))}
                          </div>
                          {editErr && <p style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 10 }}>{editErr}</p>}
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => saveEdit(p)} disabled={editSaving} className={styles.btnApprove} style={{ flex: "0 0 auto", padding: "9px 20px" }}>
                              {editSaving ? "Saving…" : "✓ Save Changes"}
                            </button>
                            <button onClick={() => { setEditingId(null); setEditErr(""); }} disabled={editSaving} className={styles.btnReject}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8 }}>
                            Listing Details
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "6px 14px", fontSize: 13, color: "var(--ink)" }}>
                            {p.sqft ? <div><span style={{ color: "var(--muted)" }}>Sqft:</span> {p.sqft}</div> : null}
                            {p.furnishing_status ? <div><span style={{ color: "var(--muted)" }}>Furnishing:</span> {p.furnishing_status}</div> : null}
                            {p.gender_preference ? <div><span style={{ color: "var(--muted)" }}>Gender:</span> {p.gender_preference}</div> : null}
                            {p.available_from ? <div><span style={{ color: "var(--muted)" }}>Available from:</span> {fmtDate(p.available_from)}</div> : null}
                            {p.min_stay_months ? <div><span style={{ color: "var(--muted)" }}>Min stay:</span> {p.min_stay_months} mo</div> : null}
                            {(p.floor_number != null || p.total_floors != null) ? (
                              <div><span style={{ color: "var(--muted)" }}>Floor:</span> {p.floor_number ?? "—"}{p.total_floors ? ` of ${p.total_floors}` : ""}</div>
                            ) : null}
                            {p.nearest_coaching_hub ? <div><span style={{ color: "var(--muted)" }}>Near:</span> {p.nearest_coaching_hub}</div> : null}
                            {(p.lat != null && p.lng != null) ? (
                              <div>
                                <span style={{ color: "var(--muted)" }}>GPS:</span>{" "}
                                <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary)" }}>
                                  {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                                </a>
                              </div>
                            ) : null}
                            <div><span style={{ color: "var(--muted)" }}>Meals:</span> {p.meals_included ? "Yes" : "No"}</div>
                            <div><span style={{ color: "var(--muted)" }}>Attached bath:</span> {p.attached_bathroom ? "Yes" : "No"}</div>
                            <div><span style={{ color: "var(--muted)" }}>Parking:</span> {p.parking_available ? "Yes" : "No"}</div>
                            <div><span style={{ color: "var(--muted)" }}>WiFi:</span> {p.wifi_included ? "Yes" : "No"}</div>
                            <div><span style={{ color: "var(--muted)" }}>Verified:</span> {p.is_verified ? "✓ Yes" : "No"}</div>
                          </div>
                        </div>
                      )}

                      {/* Room/unit variants — standard-flow multi-unit listings */}
                      {p.property_units && p.property_units.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>
                            Room / Unit Variants ({p.property_units.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {[...p.property_units].sort((a, b) => a.sort_order - b.sort_order).map((u) => (
                              <div key={u.id} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5 }}>
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                                  {u.label} — ₹{u.price_per_month.toLocaleString("en-IN")}/mo
                                  {u.deposit_amount ? ` · ₹${u.deposit_amount.toLocaleString("en-IN")} dep` : ""}
                                </div>
                                <div style={{ color: "var(--muted)" }}>
                                  {u.capacity} occupant{u.capacity > 1 ? "s" : ""} · {u.available_count}/{u.total_count} available
                                  {u.has_ac ? " · AC" : ""}{u.has_cooler ? " · Cooler" : ""}{u.attached_bath ? " · Attached bath" : ""}{u.meals_included ? " · Meals" : ""}
                                </div>
                                {u.description && <div style={{ color: "var(--muted)", marginTop: 2, fontStyle: "italic" }}>{u.description}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
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

                      {/* Partner / owner info + copy public link */}
                      {(p.dealers || (p.listing_status === "live" && p.slug)) && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                          {p.dealers ? (
                            <div style={{ fontSize: 12, color: "var(--muted)" }}>
                              {p.dealers.role === "owner" ? "Owner" : "Partner"}:{" "}
                              <strong style={{ color: "var(--ink)" }}>{p.dealers.name}</strong>
                              {p.dealers.phone && (
                                <a href={`tel:${p.dealers.phone}`} style={{ color: "var(--color-primary)", fontWeight: 600, marginLeft: 6 }}>
                                  {p.dealers.phone}
                                </a>
                              )}
                            </div>
                          ) : <span />}
                          {p.listing_status === "live" && p.slug && (
                            <button className={styles.copyLinkBtn} onClick={() => copyLink(p)}>
                              {copiedId === p.id ? "Copied ✓" : "🔗 Copy public link"}
                            </button>
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
                        {editingId !== p.id && (
                          <button
                            onClick={() => openEdit(p)}
                            disabled={acting === p.id}
                            className={styles.btnEdit}
                          >
                            ✎ Edit Property
                          </button>
                        )}
                        <button
                          onClick={() => deleteProperty(p)}
                          disabled={acting === p.id}
                          className={styles.btnDelete}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {props.length < total && (
            <button className={styles.loadMoreBtn} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : `Load ${Math.min(PAGE_SIZE, total - props.length)} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
