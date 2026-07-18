"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/admin/login") return;
    if (!supabase) { router.replace("/admin/login"); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/admin/login");
    });
  }, [pathname, router]);

  if (pathname === "/admin/login") return <>{children}</>;

  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/admin/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Top bar */}
      <div style={{ background: "var(--dark)", color: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>
              Prop<span style={{ color: "var(--red)" }}>100</span>
              <span style={{ color: "#7a8fa3", fontWeight: 500, fontSize: 12, marginLeft: 8 }}>Admin</span>
            </span>
            <div style={{ display: "flex", gap: 2 }}>
              <Link
                href="/admin/leads"
                style={{
                  color: pathname === "/admin/leads" ? "#fff" : "#7a8fa3",
                  fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 6,
                  background: pathname === "/admin/leads" ? "rgba(255,255,255,.12)" : "transparent",
                  textDecoration: "none", transition: "all 0.15s",
                }}
              >
                Leads
              </Link>
              <Link
                href="/admin/properties"
                style={{
                  color: pathname === "/admin/properties" ? "#fff" : "#7a8fa3",
                  fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 6,
                  background: pathname === "/admin/properties" ? "rgba(255,255,255,.12)" : "transparent",
                  textDecoration: "none", transition: "all 0.15s",
                }}
              >
                Properties
              </Link>
              <Link
                href="/admin/requests"
                style={{
                  color: pathname === "/admin/requests" ? "#fff" : "#7a8fa3",
                  fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 6,
                  background: pathname === "/admin/requests" ? "rgba(255,255,255,.12)" : "transparent",
                  textDecoration: "none", transition: "all 0.15s",
                }}
              >
                Area Requests
              </Link>
              <Link
                href="/admin/wallet"
                style={{
                  color: pathname === "/admin/wallet" ? "#fff" : "#7a8fa3",
                  fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 6,
                  background: pathname === "/admin/wallet" ? "rgba(255,255,255,.12)" : "transparent",
                  textDecoration: "none", transition: "all 0.15s",
                }}
              >
                Wallets
              </Link>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ color: "#7a8fa3", fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 6, background: "rgba(255,255,255,.06)" }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {children}
      </div>
    </div>
  );
}
