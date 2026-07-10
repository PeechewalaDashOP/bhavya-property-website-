"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingBar } from "@/components/LoadingBar";
import { fmt } from "@/lib/format";
import styles from "./styles.module.css";

type Status = "new" | "contacted" | "closed" | "dead";

type DealerLead = {
  id: number;
  reference_code: string;
  customer_name: string;
  customer_phone: string;
  status: Status;
  move_in_date: string | null;
  occupants: number | null;
  msg: string | null;
  created_at: string;
  contacted_at: string | null;
  properties: { title: string; loc: string; price: number } | null;
};

const STATUS_LABEL: Record<Status, string> = { new: "New", contacted: "Called", closed: "Closed", dead: "Dead" };
const STATUS_COLOR: Record<Status, string> = { new: "var(--color-primary)", contacted: "#d97706", closed: "#16a06a", dead: "#6b7480" };

function fmtPhone(p: string): string {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.slice(0, 5) + " " + d.slice(5);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Skeleton card ─────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid var(--line)", boxShadow: "var(--sh)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span className={styles.sk} style={{ width: 68, height: 12 }} />
        <span className={styles.sk} style={{ width: 46, height: 20, borderRadius: 20 }} />
      </div>
      <span className={styles.sk} style={{ width: "62%", height: 22, marginBottom: 10 }} />
      <span className={styles.sk} style={{ width: "50%", height: 19, marginBottom: 10 }} />
      <span className={styles.sk} style={{ width: "72%", height: 14, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <span className={styles.sk} style={{ flex: 1, height: 46, borderRadius: 10 }} />
        <span className={styles.sk} style={{ width: 82, height: 46, borderRadius: 10 }} />
      </div>
    </div>
  );
}

/* ─── Lead card ─────────────────────────────────────────── */
function LeadCard({
  lead,
  updating,
  onStatus,
  dim = false,
}: {
  lead: DealerLead;
  updating: boolean;
  onStatus: (id: number, s: Status) => void;
  dim?: boolean;
}) {
  const isNew = lead.status === "new";
  const isContacted = lead.status === "contacted";

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: 14,
        padding: "16px",
        marginBottom: 12,
        border: isNew ? "2px solid var(--color-primary)" : "1px solid var(--line)",
        boxShadow: "var(--sh)",
        opacity: dim ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Ref + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>{lead.reference_code}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: STATUS_COLOR[lead.status], borderRadius: 20, padding: "3px 10px" }}>
          {STATUS_LABEL[lead.status]}
        </span>
      </div>

      {/* Name */}
      <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>{lead.customer_name}</div>

      {/* Phone */}
      <a
        href={`tel:+91${lead.customer_phone}`}
        className={styles.phoneLink}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 17, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8, padding: "2px 0" }}
      >
        📞 +91 {fmtPhone(lead.customer_phone)}
      </a>

      {/* WhatsApp */}
      <div style={{ marginBottom: 10 }}>
        <a
          href={`https://wa.me/91${lead.customer_phone}?text=${encodeURIComponent(
            `Hi ${lead.customer_name}, I'm calling about your property enquiry (Ref: ${lead.reference_code}) on Prop100.`
          )}`}
          target="_blank"
          rel="noreferrer"
          className={styles.waLink}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#16a06a" }}
        >
          💬 WhatsApp
        </a>
      </div>

      {/* Property */}
      {lead.properties && (
        <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 4 }}>
          🏠 {lead.properties.title}
          {lead.properties.price ? <span style={{ color: "var(--ink)", fontWeight: 600 }}> · {fmt(lead.properties.price)}</span> : null}
          <span> · {lead.properties.loc}</span>
        </div>
      )}

      {/* Move-in */}
      {(lead.move_in_date || lead.occupants) && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
          {lead.move_in_date && `📅 ${fmtDate(lead.move_in_date)}`}
          {lead.occupants ? ` · ${lead.occupants} person${lead.occupants > 1 ? "s" : ""}` : ""}
        </div>
      )}

      {/* Message */}
      {lead.msg && (
        <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", margin: "8px 0", background: "var(--bg)", borderRadius: 8, padding: "8px 10px" }}>
          &ldquo;{lead.msg}&rdquo;
        </div>
      )}

      {/* Action buttons */}
      {isNew && (
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={() => onStatus(lead.id, "contacted")}
            disabled={updating}
            className={styles.btnPrimary}
            style={{ flex: 1, background: "var(--color-primary)", color: "#fff", fontWeight: 700, borderRadius: 10, padding: "14px", fontSize: 16, opacity: updating ? 0.55 : 1, border: "none", cursor: updating ? "default" : "pointer" }}
          >
            ✅ I Called Them
          </button>
          <button
            onClick={() => onStatus(lead.id, "dead")}
            disabled={updating}
            className={styles.btnSecondary}
            style={{ background: "var(--bg)", color: "var(--muted)", fontWeight: 600, borderRadius: 10, padding: "14px 16px", fontSize: 14, border: "1px solid var(--line)", opacity: updating ? 0.55 : 1, cursor: updating ? "default" : "pointer" }}
          >
            ✗
          </button>
        </div>
      )}

      {isContacted && (
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={() => onStatus(lead.id, "closed")}
            disabled={updating}
            className={styles.btnPrimary}
            style={{ flex: 1, background: "var(--ok)", color: "#fff", fontWeight: 700, borderRadius: 10, padding: "14px", fontSize: 16, opacity: updating ? 0.55 : 1, border: "none", cursor: updating ? "default" : "pointer" }}
          >
            🤝 Deal Done
          </button>
          <button
            onClick={() => onStatus(lead.id, "dead")}
            disabled={updating}
            className={styles.btnSecondary}
            style={{ background: "var(--bg)", color: "var(--muted)", fontWeight: 600, borderRadius: 10, padding: "14px 16px", fontSize: 14, border: "1px solid var(--line)", opacity: updating ? 0.55 : 1, cursor: updating ? "default" : "pointer" }}
          >
            ✗
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */
export default function DealerPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<DealerLead[]>([]);
  const [dealerName, setDealerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("prop100_dealer_token") : null;
    if (!token) { router.replace("/dealer/login"); return; }

    const res = await fetch("/api/dealer/leads", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      localStorage.removeItem("prop100_dealer_token");
      router.replace("/dealer/login");
      return;
    }
    if (!res.ok) { setErr("Failed to load. Tap refresh to try again."); setLoading(false); return; }

    const data = await res.json();
    setLeads(data.leads ?? []);
    setDealerName(data.dealerName ?? "");
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function updateStatus(id: number, status: Status) {
    setUpdating(id);
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    const token = localStorage.getItem("prop100_dealer_token");
    const res = await fetch("/api/dealer/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) await fetchLeads();
    setUpdating(null);
  }

  function logout() {
    localStorage.removeItem("prop100_dealer_token");
    router.replace("/dealer/login");
  }

  const newCount = leads.filter((l) => l.status === "new").length;
  const activeLeads = leads.filter((l) => l.status !== "dead" && l.status !== "closed");
  const doneLeads = leads.filter((l) => l.status === "dead" || l.status === "closed");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={loading || updating !== null} />

      {/* Header */}
      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>
              Prop<span style={{ color: "var(--red)" }}>100</span>
            </span>
            {dealerName && (
              <span style={{ color: "#7a8fa3", fontSize: 13, marginLeft: 8 }}>{dealerName}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href="/dealer/post"
              style={{ background: "var(--red)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "7px 14px", borderRadius: 8, textDecoration: "none" }}
            >
              + Post
            </Link>
            <button onClick={logout} style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600 }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 48px" }}>
        {err ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: "var(--red)", marginBottom: 16 }}>{err}</p>
            <button
              onClick={fetchLeads}
              className={styles.btnPrimary}
              style={{ background: "var(--red)", color: "#fff", fontWeight: 700, borderRadius: 10, padding: "13px 28px", fontSize: 15, border: "none", cursor: "pointer" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <span style={{ fontSize: 18, fontWeight: 800 }}>Your Leads</span>
                {!loading && newCount > 0 && (
                  <span style={{ marginLeft: 8, background: "var(--color-primary)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 20, padding: "3px 10px" }}>
                    {newCount} new
                  </span>
                )}
              </div>
              <button
                onClick={fetchLeads}
                disabled={loading}
                style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600, padding: "7px 14px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", opacity: loading ? 0.5 : 1 }}
              >
                Refresh
              </button>
            </div>

            {/* Skeletons or lead cards */}
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : activeLeads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 6 }}>All caught up!</div>
                <div style={{ fontSize: 14 }}>No active leads right now.</div>
              </div>
            ) : (
              activeLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  updating={updating === lead.id}
                  onStatus={updateStatus}
                />
              ))
            )}

            {/* Closed / dead — collapsed */}
            {!loading && doneLeads.length > 0 && (
              <details style={{ marginTop: 24 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", fontWeight: 600, userSelect: "none", padding: "8px 0" }}>
                  {doneLeads.length} closed / dead lead{doneLeads.length > 1 ? "s" : ""}
                </summary>
                <div style={{ marginTop: 10 }}>
                  {doneLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} updating={updating === lead.id} onStatus={updateStatus} dim />
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
