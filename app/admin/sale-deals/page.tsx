"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingBar } from "@/components/LoadingBar";

type SaleDeal = {
  id: number;
  lead_id: number | null;
  property_id: number;
  dealer_id: number;
  buyer_name: string;
  buyer_phone: string;
  status: "interested" | "negotiating" | "closed" | "invoiced" | "collected" | "dead";
  agreed_price_paise: number | null;
  buyer_commission_paise: number | null;
  seller_commission_paise: number | null;
  buyer_commission_collected_paise: number;
  seller_commission_collected_paise: number;
  admin_notes: string | null;
  closed_at: string | null;
  invoiced_at: string | null;
  collected_at: string | null;
  created_at: string;
  properties: { title: string; loc: string } | null;
  dealers: { name: string } | null;
};

function rupees(paise: number | null): string {
  if (paise == null) return "—";
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " " + new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_LABEL: Record<SaleDeal["status"], string> = {
  interested: "Interested",
  negotiating: "Negotiating",
  closed: "Closed",
  invoiced: "Invoiced",
  collected: "Collected",
  dead: "Dead",
};
const STATUS_COLOR: Record<SaleDeal["status"], string> = {
  interested: "#2563eb",
  negotiating: "#b45309",
  closed: "#16a06a",
  invoiced: "#7c3aed",
  collected: "#16a06a",
  dead: "#94a3b8",
};

// Forward-only lifecycle (plus an escape hatch to "dead" from anywhere).
const NEXT_STATUS: Record<SaleDeal["status"], SaleDeal["status"][]> = {
  interested: ["negotiating", "dead"],
  negotiating: ["closed", "dead"],
  closed: ["invoiced", "dead"],
  invoiced: ["collected", "dead"],
  collected: [],
  dead: [],
};

export default function AdminSaleDealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<SaleDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  // close-deal form
  const [priceInput, setPriceInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const authHeader = useCallback(async (): Promise<Record<string, string> | null> => {
    if (!supabase) { router.replace("/admin/login"); return null; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/admin/login"); return null; }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [router]);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const headers = await authHeader();
    if (!headers) return;
    const res = await fetch("/api/admin/sale-deals", { headers });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) { setErr("Failed to load sale deals."); setLoading(false); return; }
    setDeals(await res.json());
    setLoading(false);
  }, [authHeader, router]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  function toggleRow(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setMsg(""); setPriceInput(""); setNoteInput("");
  }

  async function transition(deal: SaleDeal, status: SaleDeal["status"]) {
    if (status === "closed" && (!priceInput || Number(priceInput) <= 0)) {
      setMsg("Enter the agreed price to close this deal");
      return;
    }
    if (!confirm(`Move this deal to "${STATUS_LABEL[status]}"?`)) return;
    setBusy(true);
    setMsg("");
    const headers = await authHeader();
    if (!headers) return;
    const res = await fetch("/api/admin/sale-deals", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: deal.id,
        status,
        agreedPricePaise: status === "closed" ? Math.round(Number(priceInput) * 100) : undefined,
        note: noteInput.trim() || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMsg(data.error ?? "Update failed"); return; }
    setMsg(`✓ Moved to ${STATUS_LABEL[status]}`);
    setPriceInput(""); setNoteInput("");
    await fetchDeals();
    setOpenId(deal.id);
  }

  const cell: React.CSSProperties = { padding: "12px 14px", fontSize: 13.5, color: "var(--ink)" };
  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px",
    fontSize: 14, background: "#fff", color: "var(--ink)", outline: "none",
  };

  return (
    <div>
      <LoadingBar loading={loading || busy} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>🏷️ Sale Deals</h1>
        <button onClick={fetchDeals} style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", padding: "8px 14px", border: "1.5px solid var(--color-primary)", borderRadius: 8 }}>
          Refresh
        </button>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 18 }}>
        Buy/Sell only — separate from rental Leads. Buyer commission 0.25% · Seller commission 0.5% of the agreed price, computed on closing. Admin-verified only (no dealer magic link, given the stakes involved).
      </p>
      {err && <p style={{ color: "var(--red)", marginBottom: 12 }}>{err}</p>}

      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
                {["Buyer", "Property", "Partner", "Status", "Agreed Price", "Buyer Commission", "Seller Commission", "Created", ""].map((h) => (
                  <th key={h} style={{ ...cell, textAlign: "left", fontSize: 12, color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const nextOptions = NEXT_STATUS[d.status];
                return (
                  <>
                    <tr key={d.id} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => toggleRow(d.id)}>
                      <td style={cell}>
                        <b>{d.buyer_name}</b>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.buyer_phone}</div>
                      </td>
                      <td style={cell}>
                        <div>{d.properties?.title ?? "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.properties?.loc ?? ""}</div>
                      </td>
                      <td style={cell}>{d.dealers?.name ?? "—"}</td>
                      <td style={cell}>
                        <span style={{ color: STATUS_COLOR[d.status], fontWeight: 800, fontSize: 12.5 }}>
                          {STATUS_LABEL[d.status]}
                        </span>
                      </td>
                      <td style={cell}>{rupees(d.agreed_price_paise)}</td>
                      <td style={cell}>{rupees(d.buyer_commission_paise)}</td>
                      <td style={cell}>{rupees(d.seller_commission_paise)}</td>
                      <td style={{ ...cell, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(d.created_at)}</td>
                      <td style={{ ...cell, color: "var(--muted)" }}>{openId === d.id ? "▲" : "▼"}</td>
                    </tr>
                    {openId === d.id && (
                      <tr key={`${d.id}-detail`} style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
                        <td colSpan={9} style={{ padding: "16px 14px" }}>
                          {d.admin_notes && (
                            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12, whiteSpace: "pre-wrap" }}>
                              <b>Notes:</b> {d.admin_notes}
                            </p>
                          )}
                          {nextOptions.length > 0 ? (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                              {nextOptions.includes("closed") && (
                                <input
                                  type="number" inputMode="numeric" min={1} placeholder="Agreed price ₹"
                                  value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                                  style={{ ...inputStyle, width: 150 }}
                                />
                              )}
                              <input
                                type="text" placeholder="Note (optional)" value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                              />
                              {nextOptions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => transition(d, s)}
                                  disabled={busy}
                                  style={{
                                    background: s === "dead" ? "var(--bg)" : "var(--color-primary)",
                                    color: s === "dead" ? "var(--muted)" : "#fff",
                                    border: s === "dead" ? "1px solid var(--line)" : "none",
                                    fontWeight: 700, fontSize: 13.5, padding: "9px 16px", borderRadius: 8,
                                    opacity: busy ? 0.6 : 1,
                                  }}
                                >
                                  {s === "dead" ? "Mark dead" : `Move to ${STATUS_LABEL[s]} →`}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                              This deal is {STATUS_LABEL[d.status].toLowerCase()} — no further transitions.
                            </p>
                          )}
                          {msg && <p style={{ fontSize: 13, fontWeight: 700, color: msg.startsWith("✓") ? "#16a06a" : "var(--red)" }}>{msg}</p>}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!loading && deals.length === 0 && (
                <tr><td colSpan={9} style={{ ...cell, textAlign: "center", color: "var(--muted)", padding: 32 }}>No sale deals yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
