"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingBar } from "@/components/LoadingBar";

type DealerWallet = {
  id: number;
  name: string;
  phone: string | null;
  is_active: boolean;
  wallet_balance_paise: number;
  free_leads_remaining: number;
  pending_count: number;
  waived_value_paise: number;
};

type Txn = {
  id: number;
  amount_paise: number;
  type: string;
  lead_id: number | null;
  note: string | null;
  balance_after_paise: number;
  created_at: string;
};

function rupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " " + new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const TXN_LABEL: Record<string, string> = {
  topup: "Top-up",
  lead_charge: "Lead charge",
  refund: "Refund",
  bonus: "Bonus",
  admin_adjust: "Adjustment",
};

export default function AdminWalletPage() {
  const router = useRouter();
  const [dealers, setDealers] = useState<DealerWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(false);
  // credit form
  const [amount, setAmount] = useState("");
  const [creditType, setCreditType] = useState("topup");
  const [note, setNote] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [creditMsg, setCreditMsg] = useState("");

  const authHeader = useCallback(async (): Promise<Record<string, string> | null> => {
    if (!supabase) { router.replace("/admin/login"); return null; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/admin/login"); return null; }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [router]);

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    const headers = await authHeader();
    if (!headers) return;
    const res = await fetch("/api/admin/wallet", { headers });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) { setErr("Failed to load wallets."); setLoading(false); return; }
    setDealers(await res.json());
    setLoading(false);
  }, [authHeader, router]);

  useEffect(() => { fetchDealers(); }, [fetchDealers]);

  async function toggleDealer(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    setCreditMsg(""); setAmount(""); setNote(""); setCreditType("topup");
    setTxnsLoading(true);
    const headers = await authHeader();
    if (!headers) return;
    const res = await fetch(`/api/admin/wallet?dealerId=${id}`, { headers });
    setTxns(res.ok ? await res.json() : []);
    setTxnsLoading(false);
  }

  async function credit(dealerId: number) {
    const rs = Number(amount);
    if (!rs || rs <= 0) { setCreditMsg("Enter a valid amount in ₹"); return; }
    if (!confirm(`Credit ₹${rs} (${TXN_LABEL[creditType]}) to this partner?`)) return;
    setCrediting(true);
    setCreditMsg("");
    const headers = await authHeader();
    if (!headers) return;
    const res = await fetch("/api/admin/wallet", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ dealerId, amountPaise: Math.round(rs * 100), type: creditType, note: note.trim() || null }),
    });
    const data = await res.json();
    setCrediting(false);
    if (!res.ok) { setCreditMsg(data.error ?? "Credit failed"); return; }
    setCreditMsg(
      `✓ Credited. New balance ${rupees(data.newBalancePaise)}` +
      (data.released ? ` · ${data.released} pending lead${data.released === 1 ? "" : "s"} released` : "") +
      (data.expired ? ` · ${data.expired} expired (not billed)` : "")
    );
    setAmount(""); setNote("");
    await fetchDealers();
    await toggleDealer(dealerId); // refresh txns, keeps panel open
    setOpenId(dealerId);
  }

  const cell: React.CSSProperties = { padding: "12px 14px", fontSize: 13.5, color: "var(--ink)" };
  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px",
    fontSize: 14, background: "#fff", color: "var(--ink)", outline: "none",
  };

  return (
    <div>
      <LoadingBar loading={loading || crediting} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>💰 Wallets</h1>
        <button onClick={fetchDealers} style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", padding: "8px 14px", border: "1.5px solid var(--color-primary)", borderRadius: 8 }}>
          Refresh
        </button>
      </div>
      {err && <p style={{ color: "var(--red)", marginBottom: 12 }}>{err}</p>}

      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
                {["Partner", "Balance", "Free leads left", "Pending leads", "Free value delivered", ""].map((h) => (
                  <th key={h} style={{ ...cell, textAlign: "left", fontSize: 12, color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dealers.map((d) => (
                <>
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => toggleDealer(d.id)}>
                    <td style={cell}>
                      <b>{d.name}</b>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.phone ?? "—"}{!d.is_active && " · hidden"}</div>
                    </td>
                    <td style={{ ...cell, fontWeight: 800 }}>{rupees(d.wallet_balance_paise)}</td>
                    <td style={cell}>{d.free_leads_remaining}</td>
                    <td style={{ ...cell, color: d.pending_count > 0 ? "#d97706" : "var(--muted)", fontWeight: d.pending_count > 0 ? 800 : 400 }}>
                      {d.pending_count > 0 ? `⏳ ${d.pending_count}` : "0"}
                    </td>
                    <td style={cell}>{rupees(d.waived_value_paise)}</td>
                    <td style={{ ...cell, color: "var(--muted)" }}>{openId === d.id ? "▲" : "▼"}</td>
                  </tr>
                  {openId === d.id && (
                    <tr key={`${d.id}-detail`} style={{ borderBottom: "1px solid var(--line)", background: "var(--bg)" }}>
                      <td colSpan={6} style={{ padding: "16px 14px" }}>
                        {/* Credit form */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                          <input type="number" inputMode="numeric" min={1} placeholder="Amount ₹" value={amount}
                            onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, width: 110 }} />
                          <select value={creditType} onChange={(e) => setCreditType(e.target.value)} style={inputStyle}>
                            <option value="topup">Top-up (UPI received)</option>
                            <option value="bonus">Bonus</option>
                            <option value="refund">Refund</option>
                            <option value="admin_adjust">Adjustment</option>
                          </select>
                          <input type="text" placeholder="Note (UPI txn id…)" value={note}
                            onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
                          <button onClick={() => credit(d.id)} disabled={crediting}
                            style={{ background: "var(--color-primary)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 18px", borderRadius: 8, opacity: crediting ? 0.6 : 1 }}>
                            {crediting ? "Crediting…" : "Credit →"}
                          </button>
                        </div>
                        {creditMsg && <p style={{ fontSize: 13, fontWeight: 700, color: creditMsg.startsWith("✓") ? "#16a06a" : "var(--red)", marginBottom: 12 }}>{creditMsg}</p>}

                        {/* Ledger */}
                        {txnsLoading ? (
                          <p style={{ fontSize: 13, color: "var(--muted)" }}>Loading transactions…</p>
                        ) : txns.length === 0 ? (
                          <p style={{ fontSize: 13, color: "var(--muted)" }}>No transactions yet.</p>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <tbody>
                              {txns.map((t) => (
                                <tr key={t.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                  <td style={{ ...cell, padding: "8px 10px", color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtDate(t.created_at)}</td>
                                  <td style={{ ...cell, padding: "8px 10px" }}>
                                    {TXN_LABEL[t.type] ?? t.type}
                                    {t.lead_id ? ` · lead #${t.lead_id}` : ""}
                                    {t.note ? ` · ${t.note}` : ""}
                                  </td>
                                  <td style={{ ...cell, padding: "8px 10px", textAlign: "right", fontWeight: 800, color: t.amount_paise >= 0 ? "#16a06a" : "var(--red)", whiteSpace: "nowrap" }}>
                                    {t.amount_paise >= 0 ? "+" : ""}{rupees(t.amount_paise)}
                                  </td>
                                  <td style={{ ...cell, padding: "8px 10px", textAlign: "right", color: "var(--muted)", whiteSpace: "nowrap" }}>
                                    bal {rupees(t.balance_after_paise)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!loading && dealers.length === 0 && (
                <tr><td colSpan={6} style={{ ...cell, textAlign: "center", color: "var(--muted)", padding: 32 }}>No partners yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
