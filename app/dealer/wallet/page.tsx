"use client";

/* Dealer wallet — designed for a non-technical 45-60 year old owner:
   one big balance number, one QR, one green "I've paid" button.
   Top-up v1 is manual UPI: owner pays the Prop100 UPI, taps the WhatsApp
   button, Bhavya credits from the admin panel and any waiting leads
   auto-release. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingBar } from "@/components/LoadingBar";

type Txn = {
  id: number;
  amount_paise: number;
  type: string;
  note: string | null;
  balance_after_paise: number;
  created_at: string;
};

type Wallet = {
  balancePaise: number;
  freeLeadsRemaining: number;
  pendingCount: number;
  transactions: Txn[];
};

const TXN_LABEL: Record<string, string> = {
  topup: "Recharge",
  lead_charge: "Lead",
  refund: "Refund",
  bonus: "Bonus",
  admin_adjust: "Adjustment",
};

function rupees(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function DealerWalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const upiVpa = process.env.NEXT_PUBLIC_UPI_VPA || "";
  const conciergeWa = process.env.NEXT_PUBLIC_CONCIERGE_WHATSAPP || "";

  const fetchWallet = useCallback(async () => {
    const token = localStorage.getItem("prop100_dealer_token");
    if (!token) { router.replace("/dealer/login"); return; }
    setLoading(true);
    const res = await fetch("/api/dealer/wallet", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { router.replace("/dealer/login"); return; }
    if (!res.ok) { setErr("Could not load wallet. Please try again."); setLoading(false); return; }
    setWallet(await res.json());
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchWallet(); }, [fetchWallet]);

  const waText = encodeURIComponent(
    "Namaste! Maine Prop100 wallet ke liye UPI payment kar diya hai. Please balance add kar dijiye. (Amount: ₹___)"
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <LoadingBar loading={loading} />

      {/* Header */}
      <div style={{ background: "var(--dark)", color: "#fff", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>
            Prop<span style={{ color: "var(--red)" }}>100</span>
            <span style={{ color: "#7a8fa3", fontWeight: 500, fontSize: 13, marginLeft: 8 }}>Wallet</span>
          </span>
          <Link href="/dealer" style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 14px 48px" }}>
        {err && <p style={{ color: "var(--red)", textAlign: "center", padding: "24px 0" }}>{err}</p>}

        {wallet && (
          <>
            {/* Balance card */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "22px 18px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 700, marginBottom: 4 }}>Wallet Balance</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>
                {rupees(wallet.balancePaise)}
              </div>
              {wallet.freeLeadsRemaining > 0 && (
                <div style={{ fontSize: 13.5, color: "#16a06a", fontWeight: 700, marginTop: 8 }}>
                  🎁 {wallet.freeLeadsRemaining} free lead{wallet.freeLeadsRemaining === 1 ? "" : "s"} remaining
                </div>
              )}
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
                Har interested student ka contact = ₹25. Pehle {wallet.freeLeadsRemaining > 0 ? "5 leads" : "leads"} free.
              </div>
            </div>

            {/* Pending leads alert */}
            {wallet.pendingCount > 0 && (
              <div style={{ background: "#fff8ed", border: "1.5px solid #f3c778", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "#b45309", marginBottom: 4 }}>
                  ⏳ {wallet.pendingCount} student{wallet.pendingCount === 1 ? "" : "s"} waiting!
                </div>
                <div style={{ fontSize: 13, color: "#92600a", lineHeight: 1.5 }}>
                  Interested student{wallet.pendingCount === 1 ? " ka" : "s ke"} contact aapke liye ready {wallet.pendingCount === 1 ? "hai" : "hain"}.
                  Recharge karte hi number aapko WhatsApp par milega.
                </div>
              </div>
            )}

            {/* Top-up block */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 16px", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, color: "var(--ink)", marginBottom: 12 }}>
                Recharge karein (min ₹100)
              </div>
              <ol style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.9, paddingLeft: 18, marginBottom: 14 }}>
                <li>Neeche diye UPI par payment karein</li>
                <li>&quot;Maine pay kar diya&quot; button dabayein</li>
                <li>Balance kuch hi der me add ho jayega ✓</li>
              </ol>

              {/* QR — drop public/upi-qr.png in the repo to show it */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/upi-qr.png"
                alt="UPI QR code"
                style={{ width: 180, height: 180, display: "block", margin: "0 auto 12px", borderRadius: 10, border: "1px solid var(--line)", objectFit: "contain", background: "#fff" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {upiVpa && (
                <>
                  <div style={{ textAlign: "center", fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 12, userSelect: "all" }}>
                    {upiVpa}
                  </div>
                  <a
                    href={`upi://pay?pa=${encodeURIComponent(upiVpa)}&pn=Prop100&cu=INR`}
                    style={{ display: "block", textAlign: "center", background: "var(--color-primary)", color: "#fff", fontWeight: 700, borderRadius: 10, padding: "13px", fontSize: 15, textDecoration: "none", marginBottom: 10 }}
                  >
                    📲 UPI App me kholein
                  </a>
                </>
              )}
              {conciergeWa && (
                <a
                  href={`https://wa.me/${conciergeWa}?text=${waText}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "block", textAlign: "center", background: "#16a06a", color: "#fff", fontWeight: 700, borderRadius: 10, padding: "13px", fontSize: 15, textDecoration: "none" }}
                >
                  ✅ Maine pay kar diya — WhatsApp karein
                </a>
              )}
            </div>

            {/* Transactions */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px" }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)", marginBottom: 10 }}>History</div>
              {wallet.transactions.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--muted)" }}>Abhi koi transaction nahi.</p>
              ) : (
                wallet.transactions.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {TXN_LABEL[t.type] ?? t.type}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(t.created_at)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: t.amount_paise >= 0 ? "#16a06a" : "var(--red)" }}>
                        {t.amount_paise >= 0 ? "+" : ""}{rupees(t.amount_paise)}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>bal {rupees(t.balance_after_paise)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
