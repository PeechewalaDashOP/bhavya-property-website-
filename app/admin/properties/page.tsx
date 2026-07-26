"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingBar } from "@/components/LoadingBar";
import { fmt } from "@/lib/format";
import { HostelMeta } from "@/lib/types";
import { TENANT_PREFERENCES, COACHING_HUBS } from "@/lib/constants";
import {
  HOUSE_RULE_LABELS, SERVICE_LABELS, COMMON_AMENITY_LABELS,
  TENANT_TYPE_LABELS, PARKING_TYPE_LABELS, gateTimeLabel, noticePeriodLabel,
} from "@/lib/hostelLabels";
import {
  ROOM_CATEGORIES, USER_TYPES, ROOM_FACILITIES, COOLING_TYPES, HOUSE_RULES,
  TENANT_TYPES, CORE_SERVICES, COMMON_AMENITIES, PARKING_TYPES, ELECTRICITY_OPTIONS,
  NOTICE_PERIODS, GATE_TIMES, USP_CATEGORIES,
  type RoomCategoryKey, type UserType, type CoolingType, type ElectricityBilling,
} from "@/app/dealer/post/types";
import {
  buildPhotoLabelOptions, resolvePhotoLabelOption,
  PHOTO_LABEL_CUSTOM_VALUE,
} from "@/app/admin/photoTagOptions";
import { compressImages } from "@/lib/imageCompress";
import { compressVideos, validateVideoSize } from "@/lib/videoCompress";
import { uploadFileWithRetry } from "@/lib/upload";
import styles from "./styles.module.css";

type ListingStatus = "pending" | "live" | "paused_owner" | "paused_admin" | "rejected";
type StatusFilter = "pending" | "live" | "paused" | "rejected" | "all";
type Order = "new" | "old" | "price_desc" | "price_asc" | "leads";

const PAGE_SIZE = 20;
const GENDER_PREF_TO_TARGET: Record<string, "male" | "female" | "both"> = {
  boys: "male", girls: "female", any: "both",
};

type UnitAttrs = { occupancy?: string; cooling?: string; facilities?: string[] } | null;

type ReviewRow = { id: number; reviewer_name: string; rating: number; comment: string | null; created_at: string };

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
  attributes?: UnitAttrs;
};

// Room-type editor row — same shape as app/admin/properties/new/page.tsx's
// UnitRow, so an existing hostel listing edits with the same controls a
// fresh one is created with (category/cooling/facilities drive `attributes`).
type EditUnitRow = {
  id: string;
  category: RoomCategoryKey;
  customLabel: string;
  label: string;
  capacity: string;
  price_per_month: string;
  deposit_amount: string;
  total_count: string;
  available_count: string;
  coolingType: CoolingType;
  facilities: string[];
  meals_included: boolean;
  description: string;
};

function editUnitId() {
  return Math.random().toString(36).slice(2, 9);
}

function unitToEditRow(u: PropUnit): EditUnitRow {
  const attrs = u.attributes ?? {};
  const category = (ROOM_CATEGORIES.some((c) => c.key === attrs.occupancy) ? attrs.occupancy : "other") as RoomCategoryKey;
  const coolingType = (["ac", "cooler", "none"].includes(attrs.cooling ?? "") ? attrs.cooling : (u.has_ac ? "ac" : u.has_cooler ? "cooler" : "none")) as CoolingType;
  const facilities = Array.isArray(attrs.facilities) ? attrs.facilities : (u.attached_bath ? ["washroom"] : []);
  return {
    id: editUnitId(), category, customLabel: category === "other" ? u.label : "",
    label: u.label, capacity: String(u.capacity), price_per_month: String(u.price_per_month),
    deposit_amount: u.deposit_amount != null ? String(u.deposit_amount) : "",
    total_count: String(u.total_count), available_count: String(u.available_count),
    coolingType, facilities, meals_included: u.meals_included, description: u.description ?? "",
  };
}

function emptyEditUnit(): EditUnitRow {
  return {
    id: editUnitId(), category: "single", customLabel: "", label: "", capacity: "1",
    price_per_month: "", deposit_amount: "", total_count: "1", available_count: "",
    coolingType: "none", facilities: [], meals_included: false, description: "",
  };
}

// Photo item — "existing" wraps an already-uploaded gallery URL (with its
// current tag/section pulled from hostel_meta), "new" wraps a File picked
// during this edit session that still needs uploading on save.
type EditPhotoItem =
  | { id: string; kind: "existing"; url: string; tag: string; section: string; isCover: boolean }
  | { id: string; kind: "new"; file: File; previewUrl: string; tag: string; section: string; isCover: boolean; uploadedUrl?: string };

function editPhotoId() {
  return Math.random().toString(36).slice(2, 9);
}

type HostelEditState = {
  pg_name: string; user_type: UserType; address: string; pincode: string; landmark: string;
  operational_since: string; present_on_floor: string; tenant_types: string[]; house_rules: string[];
  notice_period: string; gate_timing_enabled: boolean; gate_closing_time: string; services: string[];
  electricity: "" | ElectricityBilling; common_amenities: string[]; parking_enabled: boolean;
  parking_types: string[]; usp_category: string; usp_text: string; custom_coaching_hub: string;
};

function emptyHostelEdit(): HostelEditState {
  return {
    pg_name: "", user_type: "owner", address: "", pincode: "", landmark: "",
    operational_since: "", present_on_floor: "", tenant_types: [], house_rules: [],
    notice_period: "30", gate_timing_enabled: false, gate_closing_time: "22:00", services: [],
    electricity: "", common_amenities: [], parking_enabled: false,
    parking_types: [], usp_category: "", usp_text: "", custom_coaching_hub: "",
  };
}

function hostelMetaToEditState(hm: HostelMeta | null): HostelEditState {
  const base = emptyHostelEdit();
  if (!hm) return base;
  return {
    pg_name: hm.pg_name ?? "",
    user_type: hm.user_type ?? "owner",
    address: hm.address ?? "",
    pincode: hm.pincode ?? "",
    landmark: hm.landmark ?? "",
    operational_since: hm.operational_since ?? "",
    present_on_floor: hm.present_on_floor ?? "",
    tenant_types: hm.tenant_types ?? [],
    house_rules: hm.house_rules ?? [],
    notice_period: hm.notice_period ?? "30",
    gate_timing_enabled: !!hm.gate_timing_enabled,
    gate_closing_time: hm.gate_closing_time ?? "22:00",
    services: hm.services ?? [],
    electricity: hm.electricity ?? "",
    common_amenities: hm.common_amenities ?? [],
    parking_enabled: !!hm.parking_enabled,
    parking_types: hm.parking_types ?? [],
    usp_category: hm.usp_category ?? "",
    usp_text: hm.usp_text ?? "",
    custom_coaching_hub: hm.custom_coaching_hub ?? "",
  };
}

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
  tenant_preference: string[] | null;
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
  const [editTenantPref, setEditTenantPref] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editUploadMsg, setEditUploadMsg] = useState("");

  // PG/Hostel-only edit state — full parity with the "Add Listing" form's
  // hostel-specific fields, room-type editor, and tagged/orderable photos.
  const [editHostel, setEditHostel] = useState<HostelEditState>(emptyHostelEdit());
  const [editUnits, setEditUnits] = useState<EditUnitRow[]>([]);
  const [editPhotos, setEditPhotos] = useState<EditPhotoItem[]>([]);
  const [editVideos, setEditVideos] = useState<string[]>([]);
  const [editNewVideos, setEditNewVideos] = useState<File[]>([]);
  const [editVideoErr, setEditVideoErr] = useState("");
  const [flashedId, setFlashedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [reviewsByProp, setReviewsByProp] = useState<Record<number, ReviewRow[]>>({});
  const [reviewsLoadingId, setReviewsLoadingId] = useState<number | null>(null);
  const [reviewActingId, setReviewActingId] = useState<number | null>(null);

  // Lazy-load reviews only for the row currently expanded — avoids an N+1
  // fetch for every row on the list view.
  useEffect(() => {
    if (expanded == null || reviewsByProp[expanded] !== undefined) return;
    setReviewsLoadingId(expanded);
    (async () => {
      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/admin/reviews?property_id=${expanded}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      setReviewsByProp((prev) => ({ ...prev, [expanded]: data.reviews ?? [] }));
      setReviewsLoadingId(null);
    })();
  }, [expanded, reviewsByProp]);

  async function deleteReview(propertyId: number, reviewId: number) {
    if (!supabase) return;
    if (!confirm("Delete this review? This cannot be undone.")) return;
    setReviewActingId(reviewId);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/reviews?id=${reviewId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });
    if (res.ok) {
      setReviewsByProp((prev) => ({ ...prev, [propertyId]: (prev[propertyId] ?? []).filter((r) => r.id !== reviewId) }));
    } else {
      alert("Failed to delete review.");
    }
    setReviewActingId(null);
  }

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
  function toggleEditTenantPref(t: string) {
    setEditTenantPref((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }
  function isPgProp(p: PropRow) {
    return p.ptype === "Hostel" || p.ptype === "PG" || !!p.hostel_meta;
  }
  function setHostelField<K extends keyof HostelEditState>(key: K, value: HostelEditState[K]) {
    setEditHostel((prev) => ({ ...prev, [key]: value }));
  }
  function toggleHostelList(key: "tenant_types" | "house_rules" | "services" | "common_amenities" | "parking_types", value: string) {
    setEditHostel((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((x) => x !== value) : [...prev[key], value],
    }));
  }
  function updateEditUnit(id: string, patch: Partial<EditUnitRow>) {
    setEditUnits((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }
  function setEditUnitCategory(id: string, category: RoomCategoryKey) {
    const cat = ROOM_CATEGORIES.find((c) => c.key === category);
    setEditUnits((prev) => prev.map((u) => (u.id === id
      ? { ...u, category, label: u.label || (category === "other" ? "" : `${cat?.label ?? ""} Room`) }
      : u)));
  }
  function toggleEditUnitFacility(id: string, key: string) {
    setEditUnits((prev) => prev.map((u) => (u.id === id ? { ...u, facilities: u.facilities.includes(key) ? u.facilities.filter((x) => x !== key) : [...u.facilities, key] } : u)));
  }
  function addEditUnit() {
    setEditUnits((prev) => [...prev, emptyEditUnit()]);
  }
  function removeEditUnit(id: string) {
    setEditUnits((prev) => (prev.length > 1 ? prev.filter((u) => u.id !== id) : prev));
  }
  function addEditPhotos(files: FileList | null) {
    if (!files) return;
    const arr: EditPhotoItem[] = Array.from(files).map((file) => ({
      id: editPhotoId(), kind: "new", file, previewUrl: URL.createObjectURL(file),
      tag: "", section: "", isCover: false,
    }));
    setEditPhotos((prev) => [...prev, ...arr]);
  }
  function removeEditPhoto(id: string) {
    setEditPhotos((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item && item.kind === "new") URL.revokeObjectURL(item.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }
  function setEditPhotoCover(id: string) {
    setEditPhotos((prev) => prev.map((x) => ({ ...x, isCover: x.id === id })));
  }
  function setEditPhotoLabelOption(id: string, value: string, options: ReturnType<typeof buildPhotoLabelOptions>) {
    if (value === PHOTO_LABEL_CUSTOM_VALUE) {
      setEditPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, tag: "", section: "" } : x)));
      return;
    }
    const opt = options.find((o) => o.value === value);
    if (!opt) return;
    setEditPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, tag: opt.tag, section: opt.section } : x)));
  }
  function setEditPhotoCustomLabel(id: string, text: string) {
    setEditPhotos((prev) => prev.map((x) => (x.id === id ? { ...x, tag: "", section: text } : x)));
  }
  function moveEditPhoto(id: string, dir: -1 | 1) {
    setEditPhotos((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addEditVideos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    for (const f of arr) {
      const msg = validateVideoSize(f);
      if (msg) { setEditVideoErr(msg); return; }
    }
    setEditVideoErr("");
    setEditNewVideos((prev) => [...prev, ...arr]);
  }

  function openEdit(p: PropRow) {
    setEditingId(p.id);
    setEditErr("");
    setEditTenantPref(p.tenant_preference ?? []);
    if (isPgProp(p)) {
      setEditHostel(hostelMetaToEditState(p.hostel_meta));
      setEditUnits((p.property_units ?? []).map(unitToEditRow));
      const gallery = p.gallery ?? [];
      const tagMap = p.hostel_meta?.photo_tags ?? {};
      const sectionMap = p.hostel_meta?.photo_sections ?? {};
      setEditPhotos(gallery.map((url, i) => ({
        id: editPhotoId(), kind: "existing", url,
        tag: tagMap[url] ?? "", section: sectionMap[url] ?? "", isCover: i === 0,
      })));
      setEditVideos(p.videos ?? []);
      setEditNewVideos([]);
      setEditVideoErr("");
    } else {
      setEditHostel(emptyHostelEdit());
      setEditUnits([]);
      setEditPhotos([]);
      setEditVideos([]);
      setEditNewVideos([]);
    }
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
    setEditUploadMsg("");
    const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));
    const isPg = isPgProp(p);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = { Authorization: `Bearer ${session!.access_token}` };

      let finalGallery: string[] = editPhotos.filter((i) => i.kind === "existing").map((i) => (i as { url: string }).url);
      let finalVideos: string[] = [...editVideos];
      let photoTagMap: Record<string, string> = {};
      let photoSectionMap: Record<string, string> = {};

      if (isPg) {
        const newPhotoItems = editPhotos.filter((i) => i.kind === "new") as Extract<EditPhotoItem, { kind: "new" }>[];
        const newPhotoFiles = newPhotoItems.map((i) => i.file);

        if (newPhotoFiles.length > 0 || editNewVideos.length > 0) {
          setEditUploadMsg("Compressing media…");
          const [compPhotos, compVideos] = await Promise.all([compressImages(newPhotoFiles), compressVideos(editNewVideos)]);
          const allFiles = [
            ...compPhotos.map((f) => ({ name: f.name, type: f.type, category: "photo" as const })),
            ...compVideos.map((f) => ({ name: f.name, type: f.type, category: "video" as const })),
          ];
          setEditUploadMsg("Preparing upload…");
          const prepRes = await fetch("/api/admin/property/prepare-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader },
            body: JSON.stringify({ files: allFiles }),
          });
          if (!prepRes.ok) {
            const d = await prepRes.json().catch(() => ({}));
            throw new Error(d.error ?? "Could not prepare upload.");
          }
          const prep = await prepRes.json();
          const uploadUrls: { signedUrl: string; publicUrl: string }[] = prep.files;
          const allFileObjs = [...compPhotos, ...compVideos];
          const refreshSignedUrl = async (meta: (typeof allFiles)[number]) => {
            const r = await fetch("/api/admin/property/prepare-upload", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeader },
              body: JSON.stringify({ files: [meta] }),
            });
            if (!r.ok) throw new Error("Could not retry upload — please try again.");
            const d = await r.json();
            return d.files[0].signedUrl as string;
          };
          const newPhotoUrls: string[] = [];
          const newVideoUrls: string[] = [];
          for (let i = 0; i < uploadUrls.length; i++) {
            const { signedUrl, publicUrl } = uploadUrls[i];
            const isPhoto = i < compPhotos.length;
            setEditUploadMsg(`Uploading ${isPhoto ? "photo" : "video"} ${i + 1}…`);
            await uploadFileWithRetry(signedUrl, allFileObjs[i], () => {}, () => refreshSignedUrl(allFiles[i]));
            if (isPhoto) newPhotoUrls.push(publicUrl);
            else newVideoUrls.push(publicUrl);
          }
          // Map new items back to their uploaded URL, in the same order they
          // were uploaded (compressImages/compressVideos preserve input order).
          newPhotoItems.forEach((item, idx) => { item.uploadedUrl = newPhotoUrls[idx]; });
          finalVideos = [...editVideos, ...newVideoUrls.filter(Boolean)];
        }

        setEditUploadMsg("Saving changes…");
        const urlById = new Map<string, string>();
        for (const item of editPhotos) {
          if (item.kind === "existing") urlById.set(item.id, item.url);
          else urlById.set(item.id, item.uploadedUrl ?? "");
        }
        const orderedUrls = editPhotos.map((item) => urlById.get(item.id)).filter((u): u is string => !!u);
        const coverItem = editPhotos.find((i) => i.isCover);
        const coverUrl = coverItem ? urlById.get(coverItem.id) : undefined;
        finalGallery = coverUrl ? [coverUrl, ...orderedUrls.filter((u) => u !== coverUrl)] : orderedUrls;

        for (const item of editPhotos) {
          const url = urlById.get(item.id);
          if (!url) continue;
          if (item.tag) photoTagMap[url] = item.tag;
          if (item.section) photoSectionMap[url] = item.section;
        }
      }

      const pgValidUnits = editUnits.filter((u) => u.label && Number(u.price_per_month) > 0);

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
        attached_bathroom: isPg ? pgValidUnits.some((u) => u.facilities.includes("washroom")) : !!editForm.attached_bathroom,
        parking_available: isPg ? editHostel.parking_enabled : !!editForm.parking_available,
        wifi_included: isPg ? editHostel.common_amenities.includes("wifi") : !!editForm.wifi_included,
        is_featured: !!editForm.is_featured,
        is_verified: !!editForm.is_verified,
        tenant_preference: editTenantPref,
        ...(isPg ? {
          gallery: finalGallery,
          videos: finalVideos,
          img: finalGallery[0] ?? null,
          hostel_meta: {
            pg_name: editHostel.pg_name.trim() || undefined,
            user_type: editHostel.user_type,
            address: editHostel.address.trim(),
            pincode: editHostel.pincode || null,
            landmark: editHostel.landmark.trim() || null,
            operational_since: editHostel.operational_since || null,
            present_on_floor: editHostel.present_on_floor.trim() || null,
            room_categories: Array.from(new Set(pgValidUnits.map((u) => u.category))),
            target_gender: GENDER_PREF_TO_TARGET[editForm.gender_preference as string] ?? "both",
            tenant_types: editHostel.tenant_types,
            house_rules: editHostel.house_rules,
            notice_period: editHostel.notice_period,
            gate_timing_enabled: editHostel.gate_timing_enabled,
            gate_closing_time: editHostel.gate_timing_enabled ? editHostel.gate_closing_time : null,
            services: editHostel.services,
            food_provided: !!editForm.meals_included,
            electricity: editHostel.electricity || null,
            common_amenities: editHostel.common_amenities,
            parking_enabled: editHostel.parking_enabled,
            parking_types: editHostel.parking_types,
            usp_category: editHostel.usp_category || null,
            usp_text: editHostel.usp_text.trim() || null,
            photo_tags: photoTagMap,
            photo_sections: photoSectionMap,
            custom_coaching_hub: editForm.nearest_coaching_hub === "Other" ? editHostel.custom_coaching_hub.trim() || null : null,
          },
        } : {}),
      };

      const unitsPayload = isPg
        ? pgValidUnits.map((u, i) => {
            const totalCount = Number(u.total_count) || 1;
            const availCount = u.available_count.trim() ? Number(u.available_count) : totalCount;
            return {
              label: u.label,
              capacity: Number(u.capacity) || 1,
              price_per_month: Number(u.price_per_month),
              deposit_amount: u.deposit_amount ? Number(u.deposit_amount) : null,
              total_count: totalCount,
              available_count: Math.min(availCount, totalCount),
              has_ac: u.coolingType === "ac",
              has_cooler: u.coolingType === "cooler",
              attached_bath: u.facilities.includes("washroom"),
              meals_included: u.meals_included,
              description: u.description || null,
              sort_order: i,
              attributes: { occupancy: u.category, cooling: u.coolingType, facilities: u.facilities },
            };
          })
        : undefined;

      const res = await fetch("/api/admin/properties", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ id: p.id, action: "edit", fields, ...(unitsPayload ? { units: unitsPayload } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save changes");
      setEditingId(null);
      flash(p.id);
      await fetchProps(0, false);
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : "Failed to save changes");
    }
    setEditSaving(false);
    setEditUploadMsg("");
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Properties</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push("/admin/properties/new")}
            style={{ fontSize: 13, color: "#fff", fontWeight: 700, padding: "7px 14px", border: "none", borderRadius: 8, background: "var(--ok, #16a06a)" }}
          >
            + Add Listing
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", opacity: loading ? 0.5 : 1 }}
          >
            Refresh
          </button>
        </div>
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
            const editUsedCategories = editingId === p.id ? Array.from(new Set(editUnits.map((u) => u.category))) : [];
            const editPhotoOptions = editingId === p.id ? buildPhotoLabelOptions(editUsedCategories) : [];
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
                                {COACHING_HUBS.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                              {isPgProp(p) && editForm.nearest_coaching_hub === "Other" && (
                                <input
                                  style={{ ...editInputStyle, marginTop: 6 }}
                                  value={editHostel.custom_coaching_hub}
                                  onChange={(e) => setHostelField("custom_coaching_hub", e.target.value)}
                                  placeholder="Type the actual coaching name"
                                />
                              )}
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
                              ...(isPgProp(p) ? [] : [["attached_bathroom", "Attached bath"], ["parking_available", "Parking"], ["wifi_included", "WiFi"]]),
                              ["is_featured", "Featured"],
                              ["is_verified", "✓ Verified by Prop100"],
                            ] as const).map(([key, label]) => (
                              <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                <input type="checkbox" checked={!!editForm[key]} onChange={(e) => setField(key, e.target.checked)} />
                                {label}
                              </label>
                            ))}
                          </div>
                          {isPgProp(p) && (
                            <>
                            <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>
                              Attached bath / Parking / WiFi are set automatically below from room facilities, parking, and common amenities.
                            </p>

                            {/* Owner type + address + operational details */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={editLabelStyle}>Owner is the</div>
                              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                                {USER_TYPES.map((u) => (
                                  <button key={u.key} onClick={() => setHostelField("user_type", u.key)}
                                    style={{ flex: 1, padding: "6px 6px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                      border: editHostel.user_type === u.key ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                      background: editHostel.user_type === u.key ? "rgba(15,118,110,0.08)" : "#fff",
                                      color: editHostel.user_type === u.key ? "var(--color-primary)" : "var(--ink)" }}>
                                    {u.label}
                                  </button>
                                ))}
                              </div>
                              <label style={{ display: "block", marginBottom: 8 }}>
                                <div style={editLabelStyle}>PG / Hostel name</div>
                                <input value={editHostel.pg_name} onChange={(e) => setHostelField("pg_name", e.target.value)} style={editInputStyle} />
                              </label>
                              <label style={{ display: "block", marginBottom: 8 }}>
                                <div style={editLabelStyle}>Full address</div>
                                <textarea value={editHostel.address} onChange={(e) => setHostelField("address", e.target.value)} rows={2} style={{ ...editInputStyle, resize: "vertical", fontFamily: "inherit" }} />
                              </label>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                                <label>
                                  <div style={editLabelStyle}>Pincode</div>
                                  <input value={editHostel.pincode} onChange={(e) => setHostelField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} style={editInputStyle} />
                                </label>
                                <label>
                                  <div style={editLabelStyle}>Landmark</div>
                                  <input value={editHostel.landmark} onChange={(e) => setHostelField("landmark", e.target.value)} style={editInputStyle} />
                                </label>
                                <label>
                                  <div style={editLabelStyle}>Running since</div>
                                  <input value={editHostel.operational_since} onChange={(e) => setHostelField("operational_since", e.target.value)} style={editInputStyle} placeholder="e.g. 2019" />
                                </label>
                                <label>
                                  <div style={editLabelStyle}>Present on floor</div>
                                  <input value={editHostel.present_on_floor} onChange={(e) => setHostelField("present_on_floor", e.target.value)} style={editInputStyle} placeholder="e.g. 1st, 2nd" />
                                </label>
                              </div>
                            </div>

                            {/* Room types */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={editLabelStyle}>Room types</div>
                              {editUnits.map((u) => (
                                <div key={u.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8, marginBottom: 8, background: "var(--bg)" }}>
                                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                                    {editUnits.length > 1 && (
                                      <span onClick={() => removeEditUnit(u.id)} style={{ fontSize: 11, color: "var(--color-danger)", cursor: "pointer", fontWeight: 700 }}>Remove</span>
                                    )}
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 8 }}>
                                    <label>
                                      <div style={editLabelStyle}>Category</div>
                                      <select value={u.category} onChange={(e) => setEditUnitCategory(u.id, e.target.value as RoomCategoryKey)} style={editInputStyle}>
                                        {ROOM_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                      </select>
                                    </label>
                                    <label>
                                      <div style={editLabelStyle}>Label</div>
                                      <input value={u.label} onChange={(e) => updateEditUnit(u.id, { label: e.target.value })} style={editInputStyle} />
                                    </label>
                                    <label>
                                      <div style={editLabelStyle}>Price/month (₹)</div>
                                      <input type="number" value={u.price_per_month} onChange={(e) => updateEditUnit(u.id, { price_per_month: e.target.value })} style={editInputStyle} />
                                    </label>
                                    <label>
                                      <div style={editLabelStyle}>Security Deposit (₹)</div>
                                      <input type="number" value={u.deposit_amount} onChange={(e) => updateEditUnit(u.id, { deposit_amount: e.target.value })} style={editInputStyle} />
                                    </label>
                                    <label>
                                      <div style={editLabelStyle}>Capacity</div>
                                      <input type="number" min={1} value={u.capacity} onChange={(e) => updateEditUnit(u.id, { capacity: e.target.value })} style={editInputStyle} />
                                    </label>
                                    <label>
                                      <div style={editLabelStyle}>Total rooms</div>
                                      <input type="number" min={1} value={u.total_count} onChange={(e) => updateEditUnit(u.id, { total_count: e.target.value })} style={editInputStyle} />
                                    </label>
                                    <label>
                                      <div style={editLabelStyle}>Available now</div>
                                      <input type="number" min={0} value={u.available_count} onChange={(e) => updateEditUnit(u.id, { available_count: e.target.value })} style={editInputStyle} placeholder="Blank = all available" />
                                    </label>
                                  </div>
                                  <div style={{ marginBottom: 6 }}>
                                    <div style={editLabelStyle}>Cooling</div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {COOLING_TYPES.map((c) => (
                                        <span key={c.key} onClick={() => updateEditUnit(u.id, { coolingType: c.key })}
                                          style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                            border: u.coolingType === c.key ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                            background: u.coolingType === c.key ? "rgba(15,118,110,0.08)" : "#fff",
                                            color: u.coolingType === c.key ? "var(--color-primary)" : "var(--muted)" }}>
                                          {c.icon} {c.label}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div style={{ marginBottom: 6 }}>
                                    <div style={editLabelStyle}>What&apos;s inside</div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {ROOM_FACILITIES.map((f) => (
                                        <span key={f.key} onClick={() => toggleEditUnitFacility(u.id, f.key)}
                                          style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                            border: u.facilities.includes(f.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                            background: u.facilities.includes(f.key) ? "rgba(15,118,110,0.08)" : "#fff",
                                            color: u.facilities.includes(f.key) ? "var(--color-primary)" : "var(--muted)" }}>
                                          {f.icon} {f.label}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                                    <input type="checkbox" checked={u.meals_included} onChange={(e) => updateEditUnit(u.id, { meals_included: e.target.checked })} />
                                    Meals included in this rent
                                  </label>
                                </div>
                              ))}
                              <button onClick={addEditUnit} style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", background: "rgba(15,118,110,0.08)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                                + Add another room type
                              </button>
                            </div>

                            {/* Who can stay + house rules */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={editLabelStyle}>Tenant type</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                                {TENANT_TYPES.map((t) => (
                                  <span key={t.key} onClick={() => toggleHostelList("tenant_types", t.key)}
                                    style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                      border: editHostel.tenant_types.includes(t.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                      background: editHostel.tenant_types.includes(t.key) ? "rgba(15,118,110,0.08)" : "#fff",
                                      color: editHostel.tenant_types.includes(t.key) ? "var(--color-primary)" : "var(--muted)" }}>
                                    {t.label}
                                  </span>
                                ))}
                              </div>
                              <div style={editLabelStyle}>House rules</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {HOUSE_RULES.map((r) => (
                                  <span key={r.key} onClick={() => toggleHostelList("house_rules", r.key)}
                                    style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                      border: editHostel.house_rules.includes(r.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                      background: editHostel.house_rules.includes(r.key) ? "rgba(15,118,110,0.08)" : "#fff",
                                      color: editHostel.house_rules.includes(r.key) ? "var(--color-primary)" : "var(--muted)" }}>
                                    {r.label}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Timings, services, electricity */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
                                <label>
                                  <div style={editLabelStyle}>Notice period</div>
                                  <select value={editHostel.notice_period} onChange={(e) => setHostelField("notice_period", e.target.value)} style={editInputStyle}>
                                    {NOTICE_PERIODS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                                  </select>
                                </label>
                                <label>
                                  <div style={editLabelStyle}>Electricity</div>
                                  <select value={editHostel.electricity} onChange={(e) => setHostelField("electricity", e.target.value as "" | ElectricityBilling)} style={editInputStyle}>
                                    <option value="">—</option>
                                    {ELECTRICITY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.icon} {o.label}</option>)}
                                  </select>
                                </label>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <input type="checkbox" checked={editHostel.gate_timing_enabled} onChange={(e) => setHostelField("gate_timing_enabled", e.target.checked)} />
                                <span style={{ fontSize: 12.5 }}>Gate closes at night</span>
                              </div>
                              {editHostel.gate_timing_enabled && (
                                <div style={{ marginBottom: 10, maxWidth: 220 }}>
                                  <select
                                    value={GATE_TIMES.some((t) => t.value === editHostel.gate_closing_time) ? editHostel.gate_closing_time : "custom"}
                                    onChange={(e) => setHostelField("gate_closing_time", e.target.value === "custom" ? "" : e.target.value)}
                                    style={editInputStyle}
                                  >
                                    {GATE_TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    <option value="custom">Custom…</option>
                                  </select>
                                  {!GATE_TIMES.some((t) => t.value === editHostel.gate_closing_time) && (
                                    <input type="time" style={{ ...editInputStyle, marginTop: 6 }} value={editHostel.gate_closing_time} onChange={(e) => setHostelField("gate_closing_time", e.target.value)} />
                                  )}
                                </div>
                              )}
                              <div style={editLabelStyle}>Services included</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {CORE_SERVICES.map((s) => (
                                  <span key={s.key} onClick={() => toggleHostelList("services", s.key)}
                                    style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                      border: editHostel.services.includes(s.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                      background: editHostel.services.includes(s.key) ? "rgba(15,118,110,0.08)" : "#fff",
                                      color: editHostel.services.includes(s.key) ? "var(--color-primary)" : "var(--muted)" }}>
                                    {s.icon} {s.label}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Common amenities + parking */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={editLabelStyle}>Common area amenities</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6, marginBottom: 10 }}>
                                {COMMON_AMENITIES.map((a) => (
                                  <label key={a.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                                    <input type="checkbox" checked={editHostel.common_amenities.includes(a.key)} onChange={() => toggleHostelList("common_amenities", a.key)} />
                                    {a.icon} {a.label}
                                  </label>
                                ))}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <input type="checkbox" checked={editHostel.parking_enabled} onChange={(e) => setHostelField("parking_enabled", e.target.checked)} />
                                <span style={{ fontSize: 12.5, fontWeight: 700 }}>Parking available</span>
                              </div>
                              {editHostel.parking_enabled && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {PARKING_TYPES.map((pt) => (
                                    <span key={pt.key} onClick={() => toggleHostelList("parking_types", pt.key)}
                                      style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                        border: editHostel.parking_types.includes(pt.key) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                        background: editHostel.parking_types.includes(pt.key) ? "rgba(15,118,110,0.08)" : "#fff",
                                        color: editHostel.parking_types.includes(pt.key) ? "var(--color-primary)" : "var(--muted)" }}>
                                      {pt.icon} {pt.label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* USP */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                                <label>
                                  <div style={editLabelStyle}>Strongest selling point</div>
                                  <select value={editHostel.usp_category} onChange={(e) => setHostelField("usp_category", e.target.value)} style={editInputStyle}>
                                    <option value="">Select category…</option>
                                    {USP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </label>
                                {editHostel.usp_category && (
                                  <label>
                                    <div style={editLabelStyle}>Details</div>
                                    <input value={editHostel.usp_text} onChange={(e) => setHostelField("usp_text", e.target.value)} style={editInputStyle} maxLength={100} />
                                  </label>
                                )}
                              </div>
                            </div>

                            {/* Photos */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={editLabelStyle}>Photos</div>
                              <label style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", marginBottom: 10 }}>
                                📷 Add photos ({editPhotos.length})
                                <input type="file" accept="image/*" multiple hidden onChange={(e) => { addEditPhotos(e.target.files); e.target.value = ""; }} />
                              </label>
                              {editPhotos.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {editPhotos.map((m, i) => {
                                    const optionValue = resolvePhotoLabelOption(editPhotoOptions, m.tag, m.section);
                                    const isCustom = optionValue === PHOTO_LABEL_CUSTOM_VALUE;
                                    const previewSrc = m.kind === "existing" ? m.url : m.previewUrl;
                                    return (
                                      <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: 6, background: "var(--bg)" }}>
                                        <div style={{ position: "relative", flexShrink: 0 }}>
                                          <img src={previewSrc} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6 }} />
                                          {m.isCover && <span style={{ position: "absolute", top: -6, left: -6, fontSize: 9, fontWeight: 800, background: "var(--color-primary)", color: "#fff", borderRadius: 8, padding: "1px 5px" }}>★</span>}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
                                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                            <select style={{ ...editInputStyle, width: "auto", padding: "4px 6px", fontSize: 11 }} value={optionValue} onChange={(e) => setEditPhotoLabelOption(m.id, e.target.value, editPhotoOptions)}>
                                              {editPhotoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                            {isCustom && (
                                              <input style={{ ...editInputStyle, width: 120, padding: "4px 6px", fontSize: 11 }} value={m.section} onChange={(e) => setEditPhotoCustomLabel(m.id, e.target.value)} placeholder="Custom tag…" />
                                            )}
                                          </div>
                                          {!m.isCover && (
                                            <span onClick={() => setEditPhotoCover(m.id)} style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", cursor: "pointer" }}>Set as cover</span>
                                          )}
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                          <button onClick={() => moveEditPhoto(m.id, -1)} disabled={i === 0} style={{ fontSize: 11, padding: "1px 6px", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.35 : 1, border: "1px solid var(--line)", borderRadius: 5, background: "#fff" }}>↑</button>
                                          <button onClick={() => moveEditPhoto(m.id, 1)} disabled={i === editPhotos.length - 1} style={{ fontSize: 11, padding: "1px 6px", cursor: i === editPhotos.length - 1 ? "default" : "pointer", opacity: i === editPhotos.length - 1 ? 0.35 : 1, border: "1px solid var(--line)", borderRadius: 5, background: "#fff" }}>↓</button>
                                        </div>
                                        <span onClick={() => removeEditPhoto(m.id)} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800, padding: "0 4px" }}>✕</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Videos */}
                            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                              <div style={editLabelStyle}>Videos</div>
                              <label style={{ display: "inline-block", fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)", border: "1.5px dashed var(--color-primary)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", marginBottom: 8 }}>
                                🎥 Add videos
                                <input type="file" accept="video/*" multiple hidden onChange={(e) => { addEditVideos(e.target.files); e.target.value = ""; }} />
                              </label>
                              {editVideoErr && <p style={{ color: "var(--color-danger)", fontSize: 12, marginBottom: 8 }}>{editVideoErr}</p>}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {editVideos.map((url, i) => (
                                  <span key={`ex-${i}`} style={{ fontSize: 11, padding: "3px 8px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, display: "flex", alignItems: "center", gap: 6 }}>
                                    ▶ Video {i + 1}
                                    <span onClick={() => setEditVideos((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800 }}>✕</span>
                                  </span>
                                ))}
                                {editNewVideos.map((f, i) => (
                                  <span key={`new-${i}`} style={{ fontSize: 11, padding: "3px 8px", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, display: "flex", alignItems: "center", gap: 6 }}>
                                    {f.name.length > 16 ? f.name.slice(0, 13) + "…" : f.name}
                                    <span onClick={() => setEditNewVideos((prev) => prev.filter((_, idx) => idx !== i))} style={{ cursor: "pointer", color: "var(--color-danger)", fontWeight: 800 }}>✕</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            </>
                          )}
                          {editUploadMsg && <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 10 }}>{editUploadMsg}</p>}
                          {p.type === "rent" && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={editLabelStyle}>Available For</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {TENANT_PREFERENCES.map((t) => (
                                  <span
                                    key={t}
                                    onClick={() => toggleEditTenantPref(t)}
                                    style={{
                                      fontSize: 12, padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontWeight: 600,
                                      border: editTenantPref.includes(t) ? "1.5px solid var(--color-primary)" : "1px solid var(--line)",
                                      background: editTenantPref.includes(t) ? "rgba(15,118,110,0.08)" : "var(--bg)",
                                      color: editTenantPref.includes(t) ? "var(--color-primary)" : "var(--muted)",
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
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
                            {p.tenant_preference && p.tenant_preference.length > 0 && (
                              <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "var(--muted)" }}>Available for:</span> {p.tenant_preference.join(", ")}</div>
                            )}
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

                      {/* Reviews — anyone can post on the public page (no
                          moderation queue), so admin's only lever is delete. */}
                      {isOpen && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>
                            Reviews {reviewsByProp[p.id] ? `(${reviewsByProp[p.id].length})` : ""}
                          </div>
                          {reviewsLoadingId === p.id ? (
                            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Loading…</div>
                          ) : (reviewsByProp[p.id] ?? []).length === 0 ? (
                            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No reviews yet.</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {(reviewsByProp[p.id] ?? []).map((r) => (
                                <div key={r.id} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                  <div>
                                    <div style={{ fontWeight: 700 }}>{r.reviewer_name} · <span style={{ color: "#f5a623" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></div>
                                    {r.comment && <div style={{ color: "var(--muted)", marginTop: 2 }}>{r.comment}</div>}
                                  </div>
                                  <button
                                    onClick={() => deleteReview(p.id, r.id)}
                                    disabled={reviewActingId === r.id}
                                    style={{ fontSize: 11, color: "var(--color-danger)", fontWeight: 700, border: "1px solid rgba(220,38,38,0.3)", borderRadius: 6, padding: "3px 8px", background: "#fff", cursor: "pointer", flexShrink: 0 }}
                                  >
                                    {reviewActingId === r.id ? "…" : "Delete"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
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
