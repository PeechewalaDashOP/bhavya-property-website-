"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingBar } from "@/components/LoadingBar";
import { fmt } from "@/lib/format";

type ListingStatus = "pending" | "live" | "paused_owner" | "paused_admin" | "rejected";

type PropRow = {
  id: number;
  title: string;
  ptype: string;
  loc: string;
  type: "sale" | "rent";
  img: string | null;
  price: number | null;
  rent_per_month: number | null;
  deposit_amount: number | null;
  listing_status: ListingStatus;
  created_at: string;
};

const STATUS_BADGE: Record<ListingStatus, { label: string; bg: string; fg: string }> = {
  pending:      { label: "⏳ Under Review",     bg: "rgba(245,158,11,0.12)", fg: "#b45309" },
  live:         { label: "✓ Live",              bg: "rgba(22,160,106,0.12)", fg: "#16a06a" },
  paused_owner: { label: "⏸️ Paused by You",    bg: "rgba(107,116,128,0.12)", fg: "#6b7480" },
  paused_admin: { label: "⏸️ Paused by Admin",  bg: "rgba(107,116,128,0.12)", fg: "#6b7480" },
  rejected:     { label: "🔴 Rejected",         bg: "rgba(220,38,38,0.10)", fg: "var(--color-danger)" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

export default function DealerPropertiesPage() {
  const router = useRouter();
  const [props, setProps] = useState<PropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [priceEdit, setPriceEdit] = useState<PropRow | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [depositInput, setDepositInput] = useState("");
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceErr, setPriceErr] = useState("");

  const fetchProps = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/dealer/properties");
    if (res.status === 401) { router.replace("/dealer/login"); return; }
    if (!res.ok) { setErr("Failed to load your properties."); setLoading(false); return; }
    setProps(await res.json());
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchProps(); }, [fetchProps]);

  async function act(id: number, action: "pause" | "resume", label: string) {
    if (!confirm(label)) return;
    setActing(id);
    const res = await fetch(`/api/dealer/property/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) await fetchProps();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Something went wrong");
    }
    setActing(null);
  }

  function openPriceEdit(p: PropRow) {
    setPriceEdit(p);
    setPriceInput(String(p.rent_per_month ?? p.price ?? ""));
    setDepositInput(String(p.deposit_amount ?? ""));
    setPriceErr("");
  }

  async function savePrice() {
    if (!priceEdit) return;
    const amount = Number(priceInput);
    if (!amount || amount <= 0) { setPriceErr("Enter a valid price"); return; }
    setPriceSaving(true);
    setPriceErr("");
    const fields: Record<string, number> =
      priceEdit.type === "rent" ? { rent_per_month: amount } : { price: amount };
    if (priceEdit.type === "rent" && depositInput) fields.deposit_amount = Number(depositInput) || 0;
    const res = await fetch(`/api/dealer/property/${priceEdit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit_price", fields }),
    });
    const data = await res.json().catch(() => ({}));
    setPriceSaving(false);
    if (!res.ok) { setPriceErr(data.error ?? "Failed to update price"); return; }
    setProps((prev) => prev.map((row) =>
      row.id === priceEdit.id
        ? { ...row, ...(priceEdit.type === "rent" ? { rent_per_month: amount, deposit_amount: fields.deposit_amount ?? row.deposit_amount } : { price: amount }) }
        : row
    ));
    setPriceEdit(null);
  }

  async function del(id: number, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setActing(id);
    const res = await fetch(`/api/dealer/property/${id}`, {
      method: "DELETE",
    });
    if (res.ok) setProps((prev) => prev.filter((p) => p.id !== id));
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Something went wrong");
    }
    setActing(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={loading || acting !== null} />

      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>Prop<span style={{ color: "var(--red)" }}>100</span></span>
            <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>My Properties</span>
          </div>
          <Link href="/dealer" style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>← Dashboard</Link>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 48px" }}>
        {err && <div style={{ color: "var(--color-danger)", padding: "20px 0", fontWeight: 600 }}>{err}</div>}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>Loading…</div>
        ) : props.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏠</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>No properties yet</div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>Post your first listing to start getting leads.</div>
            <Link
              href="/dealer/post"
              style={{ display: "inline-block", background: "var(--color-primary)", color: "#fff", fontSize: 14, fontWeight: 700, padding: "10px 20px", borderRadius: 9, textDecoration: "none" }}
            >
              + Post Property
            </Link>
          </div>
        ) : (
          props.map((p) => {
            const displayPrice = p.rent_per_month ?? p.price ?? 0;
            const badge = STATUS_BADGE[p.listing_status];
            return (
              <div key={p.id} style={{ background: "var(--surface)", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid var(--line)", boxShadow: "var(--sh)" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  {p.img ? (
                    <img src={p.img} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 10, background: "var(--bg)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                      {p.type === "rent" ? "🔑" : "🏷️"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{p.ptype} · {p.loc}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {fmt(displayPrice)}{p.type === "rent" ? <span style={{ fontWeight: 400 }}>/mo</span> : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 6, background: badge.bg, color: badge.fg }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(p.created_at)}</span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {p.listing_status === "pending" && (
                    <>
                      <Link
                        href={`/dealer/properties/${p.id}`}
                        style={{ flex: 1, textAlign: "center", background: "var(--bg)", color: "var(--ink)", fontSize: 13, fontWeight: 700, padding: "9px", borderRadius: 8, border: "1px solid var(--line)", textDecoration: "none" }}
                      >
                        ✎ Edit
                      </Link>
                      <button
                        onClick={() => del(p.id, p.title)}
                        disabled={acting === p.id}
                        style={{ flex: "0 0 auto", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.25)" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {p.listing_status === "live" && (
                    <>
                      <button
                        onClick={() => openPriceEdit(p)}
                        disabled={acting === p.id}
                        style={{ flex: 1, background: "var(--bg)", color: "var(--ink)", fontSize: 13, fontWeight: 700, padding: "9px", borderRadius: 8, border: "1px solid var(--line)" }}
                      >
                        ✎ Edit Price
                      </button>
                      <button
                        onClick={() => act(p.id, "pause", `Pause "${p.title}"? It will come off the public site until you resume it.`)}
                        disabled={acting === p.id}
                        style={{ flex: 1, background: "var(--bg)", color: "var(--ink)", fontSize: 13, fontWeight: 700, padding: "9px", borderRadius: 8, border: "1px solid var(--line)" }}
                      >
                        ⏸️ Pause Listing
                      </button>
                    </>
                  )}
                  {p.listing_status === "paused_owner" && (
                    <>
                      <button
                        onClick={() => openPriceEdit(p)}
                        disabled={acting === p.id}
                        style={{ flex: 1, background: "var(--bg)", color: "var(--ink)", fontSize: 13, fontWeight: 700, padding: "9px", borderRadius: 8, border: "1px solid var(--line)" }}
                      >
                        ✎ Edit Price
                      </button>
                      <button
                        onClick={() => act(p.id, "resume", `Resume "${p.title}"? It will go live on the public site again.`)}
                        disabled={acting === p.id}
                        style={{ flex: 1, background: "var(--color-primary)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px", borderRadius: 8, border: "none" }}
                      >
                        ▶ Resume Listing
                      </button>
                      <button
                        onClick={() => del(p.id, p.title)}
                        disabled={acting === p.id}
                        style={{ flex: "0 0 auto", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.25)" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {p.listing_status === "paused_admin" && (
                    <div style={{ flex: 1, fontSize: 12.5, color: "var(--muted)", padding: "9px 0" }}>
                      Paused by admin — contact Bhavya to reactivate.
                    </div>
                  )}
                  {p.listing_status === "rejected" && (
                    <>
                      <Link
                        href={`/dealer/properties/${p.id}`}
                        style={{ flex: 1, textAlign: "center", background: "var(--bg)", color: "var(--ink)", fontSize: 13, fontWeight: 700, padding: "9px", borderRadius: 8, border: "1px solid var(--line)", textDecoration: "none" }}
                      >
                        View details
                      </Link>
                      <button
                        onClick={() => del(p.id, p.title)}
                        disabled={acting === p.id}
                        style={{ flex: "0 0 auto", background: "var(--color-danger-light)", color: "var(--color-danger)", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(220,38,38,0.25)" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {priceEdit && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setPriceEdit(null); }}
        >
          <div style={{ background: "var(--surface)", width: "100%", maxWidth: 520, borderRadius: "18px 18px 0 0", padding: "22px 18px calc(env(safe-area-inset-bottom, 16px) + 18px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Edit Price</div>
              <button onClick={() => setPriceEdit(null)} style={{ fontSize: 22, color: "var(--muted)" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>{priceEdit.title}</div>

            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
              {priceEdit.type === "rent" ? "Monthly Rent (₹)" : "Price (₹)"}
            </label>
            <input
              type="number" inputMode="numeric" value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }}
            />

            {priceEdit.type === "rent" && (
              <>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                  Deposit (₹, optional)
                </label>
                <input
                  type="number" inputMode="numeric" value={depositInput}
                  onChange={(e) => setDepositInput(e.target.value)}
                  style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }}
                />
              </>
            )}

            {priceErr && <p style={{ color: "var(--color-danger)", fontSize: 13, marginBottom: 10 }}>{priceErr}</p>}

            <button
              onClick={savePrice}
              disabled={priceSaving}
              style={{ width: "100%", background: "var(--color-primary)", color: "#fff", fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 10, border: "none", opacity: priceSaving ? 0.6 : 1 }}
            >
              {priceSaving ? "Saving…" : "Save Price"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
