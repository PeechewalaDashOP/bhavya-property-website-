"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingBar } from "@/components/LoadingBar";
import styles from "./styles.module.css";

type Status = "new" | "contacted" | "closed" | "dead";

type LeadRow = {
  id: number;
  reference_code: string;
  customer_name: string;
  customer_phone: string;
  status: Status;
  move_in_date: string | null;
  occupants: number | null;
  msg: string | null;
  intent: string | null;
  created_at: string;
  contacted_at: string | null;
  closed_at: string | null;
  properties: { title: string; loc: string } | null;
  dealers: { name: string } | null;
};

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
  dead: "Dead",
};

const STATUS_COLOR: Record<Status, string> = {
  new: "var(--color-primary)",
  contacted: "#d97706",
  closed: "#16a06a",
  dead: "#6b7480",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function timeToContact(lead: LeadRow): string {
  if (!lead.contacted_at) return "—";
  const ms = new Date(lead.contacted_at).getTime() - new Date(lead.created_at).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.floor(ms / 60_000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function SkeletonRows() {
  const widths = [60, 110, 120, 90, 75, 80, 70, 40];
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
          {widths.map((w, j) => (
            <td key={j} style={{ padding: "16px 14px" }}>
              <span className={styles.sk} style={{ width: w, height: 13 }} />
              {j === 1 && (
                <span className={styles.sk} style={{ width: 80, height: 11, marginTop: 6 }} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function AdminLeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [updating, setUpdating] = useState<number | null>(null);
  const [flashedId, setFlashedId] = useState<number | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    if (!supabase) { router.replace("/admin/login"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/admin/login"); return; }

    const res = await fetch("/api/admin/leads", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    if (!res.ok) { setErr("Failed to load leads."); setLoading(false); return; }
    setLeads(await res.json());
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function updateStatus(id: number, status: Status) {
    if (!supabase) return;
    setUpdating(id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ id, status }),
    });

    if (res.ok) {
      setFlashedId(id);
      setTimeout(() => setFlashedId(null), 700);
    } else {
      await fetchLeads();
    }
    setUpdating(null);
  }

  const counts = leads.reduce(
    (acc, l) => { acc[l.status] = (acc[l.status] ?? 0) + 1; return acc; },
    {} as Record<Status, number>
  );

  const HEADERS = ["Ref", "Customer", "Property", "Dealer", "Status", "Move-in / People", "Created", "Response"];

  return (
    <div>
      <LoadingBar loading={loading || updating !== null} />

      {err ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--red)", fontSize: 15 }}>{err}</div>
      ) : (
        <>
          {/* Page header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>
              Leads{" "}
              {!loading && (
                <span style={{ color: "var(--muted)", fontWeight: 500, fontSize: 16 }}>{leads.length}</span>
              )}
            </h1>
            <button
              onClick={fetchLeads}
              disabled={loading}
              style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", opacity: loading ? 0.5 : 1 }}
            >
              Refresh
            </button>
          </div>

          {/* Status summary */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            {(["new", "contacted", "closed", "dead"] as Status[]).map((s) => (
              <div key={s} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 18px", boxShadow: "var(--sh)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[s], display: "inline-block" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{STATUS_LABEL[s]}</span>
                {loading ? (
                  <span className={styles.sk} style={{ width: 18, height: 18, borderRadius: 4 }} />
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>{counts[s] ?? 0}</span>
                )}
              </div>
            ))}
          </div>

          {/* Table */}
          <div className={styles.tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} className={styles.stickyTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && leads.length === 0 ? (
                  <SkeletonRows />
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)" }}>
                      No leads yet.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead, i) => (
                    <tr
                      key={lead.id}
                      className={flashedId === lead.id ? styles.rowFlash : styles.row}
                      style={{ borderBottom: i < leads.length - 1 ? "1px solid var(--line)" : "none", verticalAlign: "top" }}
                    >
                      {/* Ref */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontWeight: 700, color: "var(--ink)", fontSize: 13 }}>{lead.reference_code}</span>
                      </td>

                      {/* Customer */}
                      <td style={{ padding: "12px 14px", minWidth: 140 }}>
                        <div style={{ fontWeight: 600 }}>{lead.customer_name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>+91 {lead.customer_phone}</div>
                        {lead.msg && (
                          <div style={{ color: "var(--muted)", fontSize: 11.5, marginTop: 3, fontStyle: "italic", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            &ldquo;{lead.msg}&rdquo;
                          </div>
                        )}
                      </td>

                      {/* Property */}
                      <td style={{ padding: "12px 14px", minWidth: 160 }}>
                        {lead.properties ? (
                          <>
                            <div style={{ fontWeight: 600 }}>{lead.properties.title}</div>
                            <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{lead.properties.loc}</div>
                          </>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>

                      {/* Dealer */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {lead.dealers?.name ?? <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <select
                          value={lead.status}
                          disabled={updating === lead.id}
                          onChange={(e) => updateStatus(lead.id, e.target.value as Status)}
                          style={{
                            border: `1.5px solid ${STATUS_COLOR[lead.status]}`,
                            color: STATUS_COLOR[lead.status],
                            background: "var(--surface)",
                            borderRadius: 7,
                            padding: "5px 10px",
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: "pointer",
                            opacity: updating === lead.id ? 0.5 : 1,
                            transition: "opacity 0.15s",
                          }}
                        >
                          {(["new", "contacted", "closed", "dead"] as Status[]).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>

                      {/* Move-in / People */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <div>{fmtDate(lead.move_in_date)}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                          {lead.occupants ? `${lead.occupants} person${lead.occupants > 1 ? "s" : ""}` : "—"}
                        </div>
                      </td>

                      {/* Created */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <div>{fmtDate(lead.created_at)}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{fmtTime(lead.created_at)}</div>
                      </td>

                      {/* Response time */}
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: lead.contacted_at ? "var(--ok)" : "var(--muted)", fontWeight: lead.contacted_at ? 700 : 400 }}>
                        {timeToContact(lead)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
