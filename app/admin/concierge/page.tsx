"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LoadingBar } from "@/components/LoadingBar";

type Status = "new" | "ai_qualifying" | "awaiting_human" | "human_active" | "connected" | "closed" | "dead";

type EnquiryRow = {
  id: number;
  reference_code: string;
  status: Status;
  intent: string | null;
  category: string | null;
  objective_key: string | null;
  slot_state: Record<string, unknown>;
  assigned_to: string | null;
  business_hours: boolean | null;
  created_at: string;
  updated_at: string;
  first_ai_at: string | null;
  first_human_at: string | null;
  qualified_at: string | null;
  students: { id: number; name: string | null; phone: string } | null;
  properties: { id: number; title: string; loc: string; slug: string | null } | null;
};

type Message = {
  id: number;
  direction: "inbound" | "outbound";
  sender: "student" | "ai" | "human";
  body: string;
  slot_updates: Record<string, unknown> | null;
  created_at: string;
};

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  ai_qualifying: "AI Qualifying",
  awaiting_human: "Awaiting Human",
  human_active: "In Progress",
  connected: "Connected",
  closed: "Closed",
  dead: "Dead",
};

const STATUS_COLOR: Record<Status, string> = {
  new: "#6b7480",
  ai_qualifying: "#7c5cff",
  awaiting_human: "var(--color-primary)",
  human_active: "#d97706",
  connected: "#16a06a",
  closed: "#6b7480",
  dead: "#6b7480",
};

const STATUS_FLOW: Status[] = ["new", "ai_qualifying", "awaiting_human", "human_active", "connected", "closed", "dead"];

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function authedFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase!.auth.getSession();
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${session?.access_token}` },
  });
}

export default function ConciergeOpsPage() {
  const [rows, setRows] = useState<EnquiryRow[] | null>(null);
  const [filter, setFilter] = useState<Status | "all">("awaiting_human");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ enquiry: EnquiryRow; messages: Message[] } | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadList = useCallback(async () => {
    const url = filter === "all" ? "/api/admin/concierge" : `/api/admin/concierge?status=${filter}`;
    const res = await authedFetch(url);
    if (res.ok) setRows(await res.json());
  }, [filter]);

  const loadDetail = useCallback(async (id: number) => {
    const res = await authedFetch(`/api/admin/concierge/${id}`);
    if (res.ok) setDetail(await res.json());
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  async function claim() {
    if (!selectedId) return;
    const name = prompt("Your name (for the assignment record):");
    if (!name) return;
    await authedFetch(`/api/admin/concierge/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim", assignedTo: name }),
    });
    loadDetail(selectedId);
    loadList();
  }

  async function changeStatus(status: Status) {
    if (!selectedId) return;
    await authedFetch(`/api/admin/concierge/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status }),
    });
    loadDetail(selectedId);
    loadList();
  }

  async function sendReply() {
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    setActionError("");
    const res = await authedFetch(`/api/admin/concierge/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", message: replyText.trim() }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error || "Failed to send.");
      return;
    }
    setReplyText("");
    loadDetail(selectedId);
    loadList();
  }

  return (
    <div>
      <LoadingBar loading={rows === null} />
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Concierge Ops Queue</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
        WhatsApp enquiries — AI automation is currently off, so every conversation is human-operated.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["awaiting_human", "human_active", "all", "connected", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8,
              border: "1px solid var(--line)",
              background: filter === s ? "var(--dark)" : "var(--surface)",
              color: filter === s ? "#fff" : "var(--ink)",
            }}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>
        {/* Queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows?.length === 0 && (
            <div style={{ color: "var(--muted)", fontSize: 13, padding: 16 }}>No enquiries in this filter.</div>
          )}
          {rows?.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              style={{
                background: "var(--surface)",
                border: selectedId === r.id ? "2px solid var(--color-primary)" : "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.students?.name || r.students?.phone || "Unknown"}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[r.status] }}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                {r.properties?.title || r.category || "General enquiry"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.reference_code}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtAge(r.created_at)}</span>
              </div>
              {r.assigned_to && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Claimed: {r.assigned_to}</div>
              )}
            </div>
          ))}
        </div>

        {/* Detail */}
        <div style={{ background: "var(--surface)", borderRadius: 12, padding: 20, minHeight: 300 }}>
          {!detail ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Select an enquiry to view details.</div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {detail.enquiry.students?.name || "Unnamed student"}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>+91 {detail.enquiry.students?.phone}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={claim} style={{ fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)" }}>
                    {detail.enquiry.assigned_to ? `Claimed: ${detail.enquiry.assigned_to}` : "Claim"}
                  </button>
                  <select
                    value={detail.enquiry.status}
                    onChange={(e) => changeStatus(e.target.value as Status)}
                    style={{ fontSize: 12, fontWeight: 700, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--ink)" }}
                  >
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {detail.enquiry.properties && (
                <div style={{ background: "var(--bg)", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <b>{detail.enquiry.properties.title}</b> — {detail.enquiry.properties.loc}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>KNOWN DETAILS</div>
                {Object.keys(detail.enquiry.slot_state ?? {}).length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>Nothing collected yet.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(detail.enquiry.slot_state).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "4px 8px" }}>
                        <b>{k}:</b> {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>TRANSCRIPT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
                {detail.messages.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>No messages yet.</div>
                )}
                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.direction === "inbound" ? "flex-start" : "flex-end",
                      background: m.direction === "inbound" ? "var(--bg)" : "var(--color-primary)",
                      color: m.direction === "inbound" ? "var(--ink)" : "#fff",
                      borderRadius: 10,
                      padding: "8px 12px",
                      maxWidth: "80%",
                      fontSize: 13,
                    }}
                  >
                    <div>{m.body}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                      {m.sender} · {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply to send over WhatsApp…"
                  rows={2}
                  style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 9, padding: 10, fontSize: 14, background: "var(--bg)", color: "var(--ink)", resize: "none" }}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  style={{ background: "var(--red)", color: "#fff", fontWeight: 700, borderRadius: 9, padding: "0 18px", opacity: sending ? 0.7 : 1 }}
                >
                  Send
                </button>
              </div>
              {actionError && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{actionError}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
