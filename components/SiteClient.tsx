"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, Locality, PublicDealer, Property } from "@/lib/types";
import { fmt } from "@/lib/format";

type Props = { properties: Property[]; dealers: PublicDealer[]; areas: Area[]; localities?: Locality[] };
type Tab = "sale" | "rent" | "PG" | "Plot" | "Shop";
type GateCtx = { kind?: "dealer"; propId?: number; dealerId?: number; title: string; dealerName?: string; price?: number };
type ChatMsg =
  | { who: "bot" | "me"; text: string }
  | { who: "bot"; dealers: PublicDealer[] }
  | { who: "bot"; cards: Property[] };

const COACH_AREA_IMG = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80";

export default function SiteClient({ properties, dealers, areas, localities = [] }: Props) {
  const router = useRouter();
  /* ---------------- state ---------------- */
  const [mobOpen, setMobOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("sale");

  // hero search selects (inputs) vs applied filters used by the list
  const [searchLoc, setSearchLoc] = useState("");
  const [searchType, setSearchType] = useState("");
  const [searchBud, setSearchBud] = useState("");
  const [appliedLoc, setAppliedLoc] = useState("");
  const [appliedType, setAppliedType] = useState("");
  const [appliedBud, setAppliedBud] = useState(0);

  // listing filters
  const [fBhk, setFBhk] = useState("");
  const [fFurn, setFFurn] = useState("");
  const [fSort, setFSort] = useState("rel");
  const [cVer, setCVer] = useState(false);
  const [cCoach, setCCoach] = useState(false);
  const [shown, setShown] = useState(6);

  // modals
  const [modalProp, setModalProp] = useState<Property | null>(null);
  const [leadCtx, setLeadCtx] = useState<GateCtx | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  // gateway data
  const [unlock, setUnlock] = useState<Set<number>>(new Set());
  const [unlockRef, setUnlockRef] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // lead gateway — step 1 fields
  const [ldName, setLdName] = useState("");
  const [ldPhone, setLdPhone] = useState("");
  const [ldMoveIn, setLdMoveIn] = useState("");
  const [ldOccupants, setLdOccupants] = useState("1");
  // lead gateway — step 2 OTP
  const [gatewayStep, setGatewayStep] = useState<"form" | "otp">("form");
  const [ldOtp, setLdOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  // post-OTP reveal: propId → dealer phone (session only — never persisted)
  const [revealPhones, setRevealPhones] = useState<Record<number, string>>({});
  const resendTimerRef = useRef<ReturnType<typeof setInterval>>();

  // footer enquiry fields
  const [fName, setFName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fIntent, setFIntent] = useState("I want to Buy");
  const [fMsg, setFMsg] = useState("");

  // chatbot
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [qreplies, setQreplies] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatStarted = useRef(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const chatHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ---------------- effects ---------------- */
  useEffect(() => {
    try {
      setUnlock(new Set(JSON.parse(localStorage.getItem("kp_unlock") || "[]")));
    } catch {}
  }, []);
  useEffect(() => setShown(6), [tab, appliedLoc, appliedType, appliedBud, fBhk, fFurn, fSort, cVer, cCoach]);
  useEffect(() => setSearchBud(""), [tab]);
  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [msgs]);

  /* ---------------- helpers ---------------- */
  function showToast(m: string) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2000);
  }
  function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }
  function budgetOptions(): [string, string][] {
    return tab === "rent"
      ? [["", "Budget"], ["8000", "Under ₹8k"], ["12000", "Under ₹12k"], ["18000", "Under ₹18k"], ["25000", "Under ₹25k"], ["40000", "Under ₹40k"]]
      : [["", "Budget"], ["2000000", "Under ₹20 L"], ["3500000", "Under ₹35 L"], ["5000000", "Under ₹50 L"], ["7500000", "Under ₹75 L"], ["10000000", "Under ₹1 Cr"]];
  }
  /* ---------------- list ---------------- */
  const list = useMemo(() => {
    let l = properties.slice();
    if (tab === "sale") l = l.filter((p) => p.type === "sale");
    else if (tab === "rent") l = l.filter((p) => p.type === "rent");
    // "PG" tab covers both PG and Hostel listings — the post-property wizard
    // treats them as one "PG / Hostel" purpose with two sub-kinds.
    else if (tab === "PG") l = l.filter((p) => p.ptype === "PG" || p.ptype === "Hostel");
    else l = l.filter((p) => p.ptype === tab);
    if (appliedLoc) l = l.filter((p) => p.loc === appliedLoc);
    if (appliedType) l = l.filter((p) => p.ptype === appliedType);
    if (appliedBud) l = l.filter((p) => p.price <= appliedBud);
    if (fBhk) l = l.filter((p) => (fBhk === "4" ? p.bhk >= 4 : p.bhk === +fBhk));
    if (fFurn) l = l.filter((p) => p.furnish === fFurn);
    if (cVer) l = l.filter((p) => p.verified);
    if (cCoach) l = l.filter((p) => p.coaching);
    if (fSort === "lo") l.sort((a, b) => a.price - b.price);
    if (fSort === "hi") l.sort((a, b) => b.price - a.price);
    if (fSort === "new") l.sort((a, b) => a.postedDays - b.postedDays);
    return l;
  }, [properties, tab, appliedLoc, appliedType, appliedBud, fBhk, fFurn, fSort, cVer, cCoach]);

  const ctx = (tab === "sale" ? "For sale" : tab === "rent" ? "For rent" : tab) + (appliedLoc ? " in " + appliedLoc : " in Kota") + " —";
  const rem = list.length - shown;

  function applySearch() {
    setAppliedLoc(searchLoc);
    setAppliedType(searchType);
    setAppliedBud(+searchBud || 0);
    scrollToId("listings");
  }
  function goArea(name: string) {
    setTab("sale");
    setAppliedLoc(name);
    setSearchLoc(name);
    scrollToId("listings");
  }

  /* ---------------- gateway ---------------- */
  function persistUnlock(next: Set<number>) {
    try { localStorage.setItem("kp_unlock", JSON.stringify([...next])); } catch {}
  }
  function openLead(ctx2: GateCtx) {
    setLeadCtx(ctx2);
    setLdName(""); setLdPhone(""); setLdMoveIn(""); setLdOccupants("1");
    setGatewayStep("form"); setLdOtp(""); setOtpError("");
    setOtpAttempts(0); setResendCooldown(0);
    clearInterval(resendTimerRef.current);
  }
  // OTP temporarily disabled — submits directly until WhatsApp Business API is approved.
  // To revert: restore this function to call /api/otp/send and setGatewayStep("otp").
  async function sendOtp() {
    if (!leadCtx || submitting) return;
    if (ldName.trim().length < 2) return showToast("Please enter your name");
    const phone = ldPhone.replace(/\D/g, "");
    if (phone.length !== 10) return showToast("Enter a valid 10-digit phone number");
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ldName.trim(),
          phone,
          propId: leadCtx.propId ?? null,
          dealerId: leadCtx.dealerId ?? null,
          moveInDate: ldMoveIn || null,
          occupants: parseInt(ldOccupants) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      const ref: string = data.ref;
      const dealerPhone: string | null = data.dealerPhone ?? null;
      if (leadCtx.propId != null) {
        const next = new Set(unlock); next.add(leadCtx.propId);
        setUnlock(next); persistUnlock(next);
        setUnlockRef((m) => ({ ...m, [leadCtx.propId as number]: ref }));
        if (dealerPhone) setRevealPhones((m) => ({ ...m, [leadCtx.propId as number]: dealerPhone }));
      }
      const wasDealer = leadCtx.kind === "dealer";
      const dealerCtx = leadCtx;
      setLeadCtx(null); setGatewayStep("form");
      showToast("Contact unlocked ✓ Ref " + ref);
      if (wasDealer) {
        setModalProp(null);
        setDealerReveal({ ref, name: dealerCtx.dealerName || "", phone: dealerPhone || "" });
      }
    } catch (err) {
      showToast((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  async function submitLead() {
    if (!leadCtx || submitting) return;
    const otp = ldOtp.replace(/\D/g, "");
    if (otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); return; }
    setOtpError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: ldPhone.replace(/\D/g, ""),
          token: otp,
          name: ldName.trim(),
          propId: leadCtx.propId ?? null,
          dealerId: leadCtx.dealerId ?? null,
          moveInDate: ldMoveIn || null,
          occupants: parseInt(ldOccupants) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpAttempts((n) => n + 1);
        setOtpError(data.error || "Invalid OTP. Please try again.");
        return;
      }
      const ref: string = data.ref;
      const dealerPhone: string | null = data.dealerPhone ?? null;
      if (leadCtx.propId != null) {
        const next = new Set(unlock); next.add(leadCtx.propId);
        setUnlock(next); persistUnlock(next);
        setUnlockRef((m) => ({ ...m, [leadCtx.propId as number]: ref }));
        if (dealerPhone) setRevealPhones((m) => ({ ...m, [leadCtx.propId as number]: dealerPhone }));
      }
      const wasDealer = leadCtx.kind === "dealer";
      const dealerCtx = leadCtx;
      setLeadCtx(null); setGatewayStep("form");
      showToast("Contact unlocked ✓ Ref " + ref);
      if (wasDealer) {
        setModalProp(null);
        setDealerReveal({ ref, name: dealerCtx.dealerName || "", phone: dealerPhone || "" });
      }
    } catch (err) {
      setOtpError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  const [dealerReveal, setDealerReveal] = useState<{ ref: string; name: string; phone: string } | null>(null);
  function dealerLead(name: string, id?: number) {
    openLead({ kind: "dealer", dealerName: name, dealerId: id, title: "(dealer enquiry)" });
  }

  async function footerEnquiry(e: React.FormEvent) {
    e.preventDefault();
    const name = fName.trim(); const phone = fPhone.replace(/\D/g, "");
    if (name.length < 2 || phone.length < 10) return showToast("Please enter name and a valid phone");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, intent: fIntent, prop: "General enquiry", dealer: "—", price: 0, msg: fMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setFName(""); setFPhone(""); setFIntent("I want to Buy"); setFMsg("");
      showToast("Thanks! Ref " + data.ref + " — we will call you back ✓");
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  /* ---------------- chatbot ---------------- */
  function toggleChat() {
    const open = !chatOpen; setChatOpen(open);
    if (open && !chatStarted.current) {
      chatStarted.current = true;
      chatHistory.current = [];
      setMsgs([{ who: "bot", text: "Hi! 👋 I'm your Kota property assistant. Tell me what you're looking for and I'll find it.\n\nआप हिंदी में भी पूछ सकते हैं! 😊" }]);
      setQreplies(["🏠 Homes to buy", "🔑 Homes for rent", "🎓 Near coaching", "📞 Talk to a partner"]);
    }
  }
  function pushMsg(m: ChatMsg) { setMsgs((prev) => [...prev, m]); }

  function handleChat(text: string) {
    if (!text || chatLoading) return;
    pushMsg({ who: "me", text });
    setQreplies([]);

    if (/^(start over|reset|शुरू करें|restart)/i.test(text)) {
      chatHistory.current = [];
      setMsgs([{ who: "bot", text: "Let's start again 🙂 What are you looking for?" }]);
      setQreplies(["🏠 Homes to buy", "🔑 Homes for rent", "🎓 Near coaching", "📞 Talk to a partner"]);
      return;
    }

    // Add user message to history
    chatHistory.current = [...chatHistory.current, { role: "user", content: text }];
    setChatLoading(true);

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory.current }),
    })
      .then((r) => r.json())
      .then((data: { text?: string; showCards?: boolean; filter?: { type?: string; loc?: string; bhk?: number; ptype?: string; coaching?: boolean }; quickReplies?: string[] }) => {
        const botText = data.text ?? "Sorry, I couldn't understand that. Please try again.";

        // Add assistant response to history
        chatHistory.current = [...chatHistory.current, { role: "assistant", content: botText }];

        // Show text bubble
        pushMsg({ who: "bot", text: botText });

        // Optionally show property cards based on filter
        if (data.showCards) {
          let l = properties.slice();
          const f = data.filter ?? {};
          if (f.type === "rent" || f.type === "sale") l = l.filter((p) => p.type === f.type);
          if (f.loc) {
            const locLower = f.loc.toLowerCase();
            l = l.filter((p) => p.loc.toLowerCase().includes(locLower));
          }
          if (f.bhk) {
            const b = f.bhk;
            l = l.filter((p) => (b >= 4 ? p.bhk >= 4 : p.bhk === b));
          }
          if (f.ptype) {
            const pt = f.ptype.toLowerCase();
            l = l.filter((p) => p.ptype?.toLowerCase() === pt || p.ptype?.toLowerCase().includes(pt));
          }
          if (f.coaching) l = l.filter((p) => p.coaching);

          if (!l.length) l = properties.filter((p) => p.verified).slice(0, 3);
          pushMsg({ who: "bot", cards: l.slice(0, 3) });
        }

        // Set quick replies
        if (data.quickReplies?.length) {
          setQreplies(data.quickReplies);
        } else {
          setQreplies(["Show more options", "📞 Talk to a partner", "🔁 Start over"]);
        }
      })
      .catch(() => {
        pushMsg({ who: "bot", text: "Something went wrong. Please try again." });
        setQreplies(["🔁 Start over"]);
      })
      .finally(() => setChatLoading(false));
  }

  /* ---------------- derived display ---------------- */
  const areaCount = (name: string) => properties.filter((p) => p.loc === name).length;
  const dealerCount = (name: string) => properties.filter((p) => p.dealer.name === name).length;

  // Area image lookup — areas table has the photos, localities have status/sort
  const areaImageMap = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.name, a.img])),
    [areas]
  );

  // Sorted localities: live first (by sort_order), then coming_soon (by sort_order)
  const sortedLocalities = useMemo(
    () =>
      [...localities].sort((a, b) => {
        if (a.status !== b.status) return a.status === "live" ? -1 : 1;
        return (a.sort_order ?? 999) - (b.sort_order ?? 999);
      }),
    [localities]
  );

  /* ===================================================================== */
  return (
    <>
      {/* HEADER */}
      <header className="hd"><div className="wrap in">
        <div className="logo">Prop<b>100</b></div>
        <nav>
          <a href="#listings" onClick={() => setTab("sale")}>Buy</a>
          <a href="#listings" onClick={() => setTab("rent")}>Rent</a>
          <a href="#areas">Areas</a>
          <a href="#dealers">Partners</a>
          <a href="#why">Why Us</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="sp" />
        <button className="post" onClick={() => router.push("/dealer/post")}>+ Post Property</button>
        <button className="ham" onClick={() => setMobOpen((v) => !v)}>☰</button>
      </div></header>
      <div className={"mob" + (mobOpen ? " show" : "")} onClick={() => setMobOpen(false)}>
        <a href="#listings" onClick={() => setTab("sale")}>Buy</a>
        <a href="#listings" onClick={() => setTab("rent")}>Rent</a>
        <a href="#areas">Explore Areas</a>
        <a href="#dealers">Our Partners</a>
        <a href="#why">Why Choose Us</a>
        <a href="#process">How It Works</a>
        <a href="#about">About Us</a>
        <a href="#contact">Contact / Enquiry</a>
      </div>

      {/* HERO + SEARCH */}
      <div className="hero" id="home"><div className="wrap">
        <h1>Find your home in Kota</h1>
        <p>Verified houses, flats, plots &amp; rentals — direct from trusted partners</p>
        <div className="sbox">
          <div className="tabs">
            {(["sale", "rent", "PG", "Plot", "Shop"] as Tab[]).map((tb) => (
              <button key={tb} className={tab === tb ? "on" : ""} onClick={() => setTab(tb)}>
                {tb === "sale" ? "Buy" : tb === "rent" ? "Rent" : tb === "Plot" ? "Plots" : tb === "Shop" ? "Commercial" : "PG"}
              </button>
            ))}
          </div>
          <div className="sfields">
            <select value={searchLoc} onChange={(e) => setSearchLoc(e.target.value)}>
              <option value="">All localities in Kota</option>
              {sortedLocalities.length > 0
                ? sortedLocalities.map((l) => (
                    <option key={l.slug} value={l.name}>
                      {l.name}{l.status === "coming_soon" ? " (Coming Soon)" : ""}
                    </option>
                  ))
                : areas.map((a) => <option key={a.name}>{a.name}</option>)}
            </select>
            <select value={searchType} onChange={(e) => setSearchType(e.target.value)}>
              <option value="">Property type</option>
              <option>Flat</option><option>House</option><option>Villa</option><option>Plot</option><option>Shop</option><option>PG</option>
            </select>
            <select value={searchBud} onChange={(e) => setSearchBud(e.target.value)}>
              {budgetOptions().map(([v, lbl]) => <option key={lbl} value={v}>{lbl}</option>)}
            </select>
            <button className="go" onClick={applySearch}>🔍 Search</button>
          </div>
        </div>
        <div className="hstats">
          <span><b>{properties.length}</b> Properties</span>
          <span><b>{localities.length > 0 ? localities.length : areas.length}</b> Areas</span>
          <span><b>{dealers.length}</b> Verified Partners</span>
          <span><b>₹0</b> Buyer Brokerage</span>
        </div>
      </div></div>

      {/* EXPLORE AREAS */}
      <section id="areas"><div className="wrap">
        <h2 className="sec">Explore Kota area-wise</h2>
        <p className="sub">Tap an area to see all homes available there</p>
        <div className="areagrid">
          {(sortedLocalities.length > 0 ? sortedLocalities : areas.map((a) => ({ name: a.name, slug: a.name, status: "live" as const, sort_order: 0, id: a.name, parent_id: null, level: "locality" as const, latitude: null, longitude: null, aliases: [], created_at: "" }))).slice(0, 8).map((l) => {
            const isComingSoon = l.status === "coming_soon";
            const img = areaImageMap[l.name] ?? "";
            return (
              <div
                className="areacard"
                key={l.slug ?? l.name}
                onClick={() => sortedLocalities.length > 0 ? router.push(`/kota/${l.slug}`) : goArea(l.name)}
                style={isComingSoon ? { opacity: 0.55, filter: "grayscale(60%)", cursor: "pointer" } : {}}
              >
                {img
                  ? <img src={img} loading="lazy" alt={l.name} />
                  : <div style={{ width: "100%", height: "100%", background: "#c8d0da" }} />}
                <div className="ov">
                  <b style={isComingSoon ? { fontStyle: "italic", color: "#f59e0b" } : {}}>{l.name}</b>
                  <span>{isComingSoon ? "Coming soon" : `${areaCount(l.name)} homes`}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div></section>

      {/* LISTINGS */}
      <section id="listings" style={{ paddingTop: 10 }}><div className="wrap">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <div>
            <h2 className="sec" style={{ marginBottom: 2 }}>Properties in Kota</h2>
            <p className="sub" style={{ marginBottom: 0 }}>Filter and find what fits you</p>
          </div>
          <a href="/map" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#1a2332", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>🗺️ Map View</a>
        </div>
        <div className="fbar"><div className="fchips">
          <div className="fchip"><select value={fBhk} onChange={(e) => setFBhk(e.target.value)}>
            <option value="">BHK: Any</option><option value="1">1 BHK</option><option value="2">2 BHK</option><option value="3">3 BHK</option><option value="4">4+ BHK</option>
          </select></div>
          <div className="fchip"><select value={fFurn} onChange={(e) => setFFurn(e.target.value)}>
            <option value="">Furnishing: Any</option><option>Fully furnished</option><option>Semi-furnished</option><option>Unfurnished</option>
          </select></div>
          <div className="fchip"><select value={fSort} onChange={(e) => setFSort(e.target.value)}>
            <option value="rel">Sort: Relevance</option><option value="lo">Price: Low–High</option><option value="hi">Price: High–Low</option><option value="new">Newest</option>
          </select></div>
          <button className={"fchip" + (cVer ? " on" : "")} onClick={() => setCVer((v) => !v)}>✓ Verified</button>
          <button className={"fchip" + (cCoach ? " on" : "")} onClick={() => setCCoach((v) => !v)}>🎓 Near coaching</button>
          <a href="/nearby" className="fchip" style={{ textDecoration: "none" }}>📍 Near me</a>
        </div></div>
        <div className="rcount"><span>{ctx}</span> <b>{list.length}</b> properties</div>
        <div className="list">
          {list.slice(0, shown).map((p) => {
            const goDetail = p.slug
              ? () => {
                  const params = fBhk ? `?bhk=${fBhk}` : "";
                  router.push(`/property/${p.slug}${params}`);
                }
              : () => setModalProp(p);
            return (
            <div className="card" key={p.id}>
              <div className="ph" onClick={goDetail} style={p.slug ? { cursor: "pointer" } : undefined}>
                <img src={p.img} loading="lazy" alt={p.title} />
                <span className="tag">{p.type === "sale" ? "For Sale" : "For Rent"}</span>
                {p.verified && <span className="ver">✓ Verified</span>}
                <span className="photos">📷 {p.photos}</span>
              </div>
              <div className="b">
                <div className="price">{fmt(p.price)}{p.type === "rent" && <small> /month</small>}</div>
                <div className="tt" onClick={goDetail}>{p.title}</div>
                <div className="lc">📍 {p.loc}, Kota{p.coaching ? " · 🎓 " + p.coaching : ""}</div>
                <div className="sp">
                  {p.bhk ? <span><b>{p.bhk}</b> BHK</span> : null}
                  {p.baths ? <span><b>{p.baths}</b> Bath</span> : null}
                  {p.sqft ? <span><b>{p.sqft.toLocaleString("en-IN")}</b> sqft</span> : null}
                </div>
                <div className="ft"><div className="dl">Partner: <b>{p.dealer.name}</b></div><button className="ct" onClick={p.slug ? goDetail : () => setModalProp(p)}>Contact</button></div>
              </div>
            </div>
            );
          })}
        </div>
        {list.length === 0 && <div className="empty">No properties match.<br />Try a wider budget or another locality.</div>}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          {rem > 0 ? (
            <button className="btn-more" onClick={() => setShown((s) => s + 6)}>View more homes — {rem} more ↓</button>
          ) : shown > 6 && list.length > 6 ? (
            <button className="btn-more ghost" onClick={() => { setShown(6); scrollToId("listings"); }}>Show less ↑</button>
          ) : null}
        </div>
      </div></section>

      {/* DEALERS */}
      <section className="dealers" id="dealers"><div className="wrap">
        <h2 className="sec">Our verified partners</h2>
        <p className="sub">Trusted local property partners across Kota</p>
        <div className="dgrid">
          {dealers.map((d) => (
            <div className="dcard" key={d.id}>
              <div className="av">{d.name[0]}</div>
              <h4>{d.name}</h4><div className="role">{d.role}</div>
              <div className="st">
                <div><b>{dealerCount(d.name)}</b>Homes</div>
                <div><b>{d.years}</b>Years</div>
                <div><b>⭐{d.rating}</b>Rating</div>
              </div>
              <button className="cl" onClick={() => dealerLead(d.name, d.id)}>📞 Contact partner</button>
            </div>
          ))}
        </div>
      </div></section>

      {/* WHY US */}
      <section className="why" id="why"><div className="wrap">
        <h2 className="sec">Why choose Prop100</h2>
        <p className="sub">Simple, honest and made for Kota</p>
        <div className="whygrid">
          <div className="whycard"><div className="ic">🛡️</div><h4>Verified listings</h4><p>Real photos, real prices. No fake posts.</p></div>
          <div className="whycard"><div className="ic">🤝</div><h4>Direct to partner</h4><p>Talk straight to the owner/partner.</p></div>
          <div className="whycard"><div className="ic">₹</div><h4>No buyer brokerage</h4><p>Browsing and contacting is free.</p></div>
          <div className="whycard"><div className="ic">📱</div><h4>Easy on mobile</h4><p>Fast and simple on any phone.</p></div>
        </div>
      </div></section>

      {/* PROCESS */}
      <section id="process"><div className="wrap">
        <h2 className="sec">How it works</h2>
        <p className="sub">Find your home in 4 easy steps</p>
        <div className="steps">
          <div className="step"><div className="n">1</div><h4>Search</h4><p>Pick area, budget &amp; type.</p></div>
          <div className="step"><div className="n">2</div><h4>Shortlist</h4><p>Compare verified homes.</p></div>
          <div className="step"><div className="n">3</div><h4>Contact</h4><p>Call or WhatsApp the partner.</p></div>
          <div className="step"><div className="n">4</div><h4>Move in</h4><p>Visit and finalise the deal.</p></div>
        </div>
      </div></section>

      {/* ABOUT */}
      <section id="about" style={{ background: "var(--surface)" }}><div className="wrap">
        <div className="about">
          <img src={COACH_AREA_IMG} alt="About Prop100" />
          <div>
            <h2>About Prop100</h2>
            <p>We are a Kota-based property platform connecting buyers and tenants directly with trusted local partners. We started to fix a simple problem — fake listings, hidden prices and too many middlemen. Every home here is verified, with real photos and a direct line to the partner.</p>
            <p>From Talwandi to Kunhadi, we cover every corner of Kota — and we&apos;re especially handy for families looking near the coaching hubs.</p>
            <div className="aboutstats">
              <div><b>{properties.length}+</b><span>Properties</span></div>
              <div><b>{areas.length}</b><span>Areas</span></div>
              <div><b>500+</b><span>Happy families</span></div>
            </div>
          </div>
        </div>
      </div></section>

      {/* FOOTER + INQUIRY */}
      <footer id="contact"><div className="wrap">
        <div className="fgrid">
          <div className="finq">
            <h4>Send an enquiry</h4>
            <p>Tell us what you need — we&apos;ll call you back.</p>
            <form onSubmit={footerEnquiry}>
              <input placeholder="Your name" value={fName} onChange={(e) => setFName(e.target.value)} required />
              <input placeholder="Phone number" inputMode="numeric" value={fPhone} onChange={(e) => setFPhone(e.target.value)} required />
              <select value={fIntent} onChange={(e) => setFIntent(e.target.value)}>
                <option>I want to Buy</option><option>I want to Rent</option><option>I want to Sell / List</option>
              </select>
              <textarea rows={2} placeholder="e.g. 2 BHK on rent in Talwandi, budget ₹15k" value={fMsg} onChange={(e) => setFMsg(e.target.value)} />
              <button className="sbtn">Request a call back</button>
            </form>
          </div>
          <div>
            <h5>Quick links</h5>
            <a href="#listings" onClick={() => setTab("sale")}>Buy property</a>
            <a href="#listings" onClick={() => setTab("rent")}>Rent a home</a>
            <a href="#areas">Explore areas</a>
            <a href="#dealers">Our partners</a>
            <a href="#why">Why choose us</a>
            <a href="#about">About us</a>
            <a onClick={() => setAdminOpen(true)} style={{ cursor: "pointer" }}>📊 Track deals (Admin)</a>
          </div>
          <div>
            <h5>Contact us</h5>
            <a href="tel:+919829012345">📞 +91 98290 12345</a>
            <a href="mailto:hello@prop100.in">✉️ hello@prop100.in</a>
            <p>📍 Office: Vigyan Nagar, Kota,<br />Rajasthan 324005</p>
            <p>🕒 Open: 9 AM – 8 PM (Mon–Sat)</p>
          </div>
        </div>
        <div className="fbot">© 2026 Prop100 · Built with Next.js, Supabase &amp; Vercel.</div>
      </div></footer>

      {/* PROPERTY MODAL */}
      {modalProp && (
        <div className="mask show" onClick={(e) => { if (e.target === e.currentTarget) setModalProp(null); }}>
          <div className="modal">
            <div className="ph"><img src={modalProp.gallery[0]} alt={modalProp.title} /><button className="x" onClick={() => setModalProp(null)}>×</button></div>
            <div className="mb">
              <div className="price">{fmt(modalProp.price)}{modalProp.type === "rent" && <small style={{ fontSize: 13, color: "var(--muted)" }}> /month</small>}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{modalProp.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>📍 {modalProp.loc}, Kota{modalProp.coaching ? " · 🎓 near " + modalProp.coaching : ""}</div>
              <div className="specs">
                {modalProp.bhk ? <div className="s"><b>{modalProp.bhk}</b><span>Beds</span></div> : null}
                {modalProp.baths ? <div className="s"><b>{modalProp.baths}</b><span>Baths</span></div> : null}
                <div className="s"><b>{modalProp.sqft.toLocaleString("en-IN")}</b><span>Sqft</span></div>
                <div className="s"><b>{modalProp.ptype}</b><span>Type</span></div>
              </div>
              <p style={{ fontSize: 14, color: "#3a4452" }}>{modalProp.desc}</p>
              <div className="feat">{modalProp.features.map((f) => <span key={f}>✓ {f}</span>)}</div>
              <div className="dealer"><div className="av">{modalProp.dealer.name[0]}</div><div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{modalProp.dealer.name}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>✓ Verified · ⭐ {modalProp.dealer.rating} · {modalProp.furnish}</div></div></div>

              {/* lead-gated contact */}
              <div id="contactGate">
                {unlock.has(modalProp.id) ? (
                  revealPhones[modalProp.id] ? (
                    <div className="reveal">
                      <div className="tick">✓ Your details are shared with the partner.{unlockRef[modalProp.id] ? ` Reference: ${unlockRef[modalProp.id]}` : ""}</div>
                      <a className="btn" href={"tel:+" + revealPhones[modalProp.id]}>📞 Call {modalProp.dealer.name.split(" ")[0]}</a>
                      <a className="btn wa" href={`https://wa.me/${revealPhones[modalProp.id]}?text=${encodeURIComponent("Hi, I am interested in " + modalProp.title + " (Prop100)")}`} target="_blank" rel="noreferrer">💬 WhatsApp partner</a>
                      <p className="refnote">Mention this reference to the partner so your deal stays linked to Prop100.</p>
                    </div>
                  ) : (
                    <div className="reveal">
                      <div className="tick">✓ Your number was verified for this property.{unlockRef[modalProp.id] ? ` Reference: ${unlockRef[modalProp.id]}` : ""}</div>
                      <button className="btn" onClick={() => openLead({ propId: modalProp.id, dealerId: modalProp.dealer.id, title: modalProp.title, dealerName: modalProp.dealer.name, price: modalProp.price })}>Verify again to get contact</button>
                      <p className="refnote">Re-verify your number to reveal the partner&apos;s contact.</p>
                    </div>
                  )
                ) : (
                  <div className="lock">
                    <div className="lk">🔒</div><h4>Partner contact is protected</h4>
                    <p>We connect you directly to the partner — no middlemen. Share your details once to unlock the phone &amp; WhatsApp.</p>
                    <button className="btn" onClick={() => openLead({ propId: modalProp.id, dealerId: modalProp.dealer.id, title: modalProp.title, dealerName: modalProp.dealer.name, price: modalProp.price })}>Get contact details</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEALER-LEAD SUCCESS MODAL */}
      {dealerReveal && (
        <div className="mask show" onClick={(e) => { if (e.target === e.currentTarget) setDealerReveal(null); }}>
          <div className="modal">
            <div className="mb">
              <div style={{ textAlign: "center", fontSize: 42 }}>✅</div>
              <h2 style={{ textAlign: "center", fontSize: 20 }}>You&apos;re connected</h2>
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Reference <b>{dealerReveal.ref}</b> · {dealerReveal.name}</p>
              <a className="btn" href={"tel:+" + dealerReveal.phone}>📞 Call {dealerReveal.name}</a>
              <a className="btn wa" href={`https://wa.me/${dealerReveal.phone}?text=${encodeURIComponent("Hi (Prop100 Ref " + dealerReveal.ref + ")")}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
              <p className="refnote">Quote this reference so your deal stays linked to Prop100.</p>
              <button className="btn-more" style={{ width: "100%", marginTop: 12 }} onClick={() => setDealerReveal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* LEAD GATEWAY — step 1: form / step 2: OTP */}
      {leadCtx && (
        <div className="mask show" onClick={(e) => { if (e.target === e.currentTarget) { setLeadCtx(null); setGatewayStep("form"); } }}>
          <div className="modal"><div className="mb lf">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20 }}>
                {gatewayStep === "otp" ? "Enter OTP" : leadCtx.kind === "dealer" ? "Contact " + leadCtx.dealerName : "Get contact details"}
              </h2>
              <button onClick={() => { setLeadCtx(null); setGatewayStep("form"); }} style={{ fontSize: 22, color: "var(--muted)" }}>×</button>
            </div>

            {gatewayStep === "form" ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 14px" }}>
                  {leadCtx.kind === "dealer"
                    ? <>Share your details to connect with <b>{leadCtx.dealerName}</b>.</>
                    : <>Share your details to unlock the contact for <b>{leadCtx.title}</b>.</>}
                </p>
                <input placeholder="Your name *" value={ldName} onChange={(e) => setLdName(e.target.value)} />
                <input placeholder="Phone number *" inputMode="numeric" value={ldPhone} onChange={(e) => setLdPhone(e.target.value)} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input type="date" title="Moving in from?" value={ldMoveIn} onChange={(e) => setLdMoveIn(e.target.value)} style={{ marginBottom: 0 }} />
                  <select value={ldOccupants} onChange={(e) => setLdOccupants(e.target.value)} style={{ marginBottom: 0 }}>
                    <option value="1">1 person</option>
                    <option value="2">2 people</option>
                    <option value="3">3 people</option>
                    <option value="4">4+ people</option>
                  </select>
                </div>
                <button className="btn" onClick={sendOtp} disabled={submitting}>
                  {submitting ? "Saving…" : "Get contact details →"}
                </button>
                <p className="refnote">🔒 Your details are shared only with this partner — no spam, no brokerage fee.</p>
              </>
            ) : (
              <>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 14px" }}>
                  Code sent to <b>+91 {ldPhone.replace(/\D/g, "").slice(0, 5)}XXXXX</b>. Expires in 10 min.
                </p>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="6-digit OTP"
                  maxLength={6}
                  value={ldOtp}
                  onChange={(e) => { setLdOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                  style={{ letterSpacing: 8, fontSize: 22, textAlign: "center" }}
                  autoFocus
                  disabled={otpAttempts >= 3}
                />
                {otpError && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10, marginTop: -4 }}>{otpError}</p>}
                {otpAttempts >= 3 ? (
                  <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 10, textAlign: "center" }}>Too many incorrect attempts. Request a new OTP below.</p>
                ) : (
                  <button className="btn" onClick={submitLead} disabled={submitting}>
                    {submitting ? "Verifying…" : "Verify & unlock contact"}
                  </button>
                )}
                <button onClick={sendOtp} disabled={submitting || resendCooldown > 0} style={{ display: "block", width: "100%", marginTop: 10, color: "var(--muted)", fontSize: 13, padding: "8px 0", textAlign: "center" }}>
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend OTP"}
                </button>
                <button onClick={() => setGatewayStep("form")} style={{ display: "block", width: "100%", marginTop: 4, color: "var(--muted)", fontSize: 13, padding: "8px 0", textAlign: "center" }}>
                  ← Change phone number
                </button>
              </>
            )}
          </div></div>
        </div>
      )}

      {/* ADMIN DEAL TRACKER — full dashboard is item 5 in the build plan */}
      {adminOpen && (
        <div className="mask show" onClick={(e) => { if (e.target === e.currentTarget) setAdminOpen(false); }}>
          <div className="modal" style={{ maxWidth: 480 }}><div className="mb">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 20 }}>📊 Deal tracker</h2>
              <button onClick={() => setAdminOpen(false)} style={{ fontSize: 22, color: "var(--muted)" }}>×</button>
            </div>
            <div style={{ textAlign: "center", padding: "32px 10px" }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}>🗄️</div>
              <p style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>Leads are now saved to Supabase</p>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
                The admin dashboard is being built. Until then, view all leads in your Supabase project → Table Editor → leads table.
              </p>
              <button className="btn-more" onClick={() => setAdminOpen(false)}>Close</button>
            </div>
          </div></div>
        </div>
      )}

      {/* CHATBOT */}
      {!chatOpen && (
        <button className="chatfab" onClick={toggleChat}><span className="pulse" />💬</button>
      )}
      <div className={"chatbox" + (chatOpen ? " show" : "")}>
        <div className="chathead">
          <div className="bava">🤖</div>
          <div className="t"><b>Kota Assistant</b><span>● Online · ask me anything</span></div>
          <button className="cl" onClick={() => setChatOpen(false)}>×</button>
        </div>
        <div className="chatbody" ref={chatBodyRef}>
          {msgs.map((m, i) => {
            if ("text" in m) return <div key={i} className={"msg " + m.who} dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, "<br/>") }} />;
            if ("dealers" in m) return (
              <div key={i}>
                {m.dealers.map((d) => (
                  <div key={d.id} className="msg bot" style={{ marginBottom: 8 }}>
                    <b>{d.name}</b> · {d.role}<br />⭐ {d.rating} · <button onClick={() => dealerLead(d.name, d.id)} style={{ color: "var(--red)", fontWeight: 700 }}>Get contact →</button>
                  </div>
                ))}
              </div>
            );
            return (
              <div key={i}>
                {m.cards.map((p) => (
                  <div key={p.id} className="msg bot" style={{ padding: 8, maxWidth: "95%" }}>
                    <div className="chatmini" onClick={() => setModalProp(p)} style={{ cursor: "pointer" }}>
                      <img src={p.img} alt={p.title} />
                      <div><div className="pr">{fmt(p.price)}{p.type === "rent" ? " /mo" : ""}</div><div className="tt">{p.title}</div><div className="tt">📍 {p.loc}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {chatLoading && (
            <div className="msg bot" style={{ padding: "10px 14px", letterSpacing: 2 }}>
              <span style={{ animation: "none" }}>•••</span>
            </div>
          )}
        </div>
        <div className="qreplies">
          {!chatLoading && qreplies.map((q) => <button key={q} className="qr" onClick={() => handleChat(q)}>{q}</button>)}
        </div>
        <div className="chatin">
          <input
            placeholder="Type here… e.g. hostel near Allen"
            value={chatInput}
            disabled={chatLoading}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !chatLoading) { handleChat(chatInput.trim()); setChatInput(""); } }}
          />
          <button disabled={chatLoading} onClick={() => { handleChat(chatInput.trim()); setChatInput(""); }}>➤</button>
        </div>
      </div>

      {/* TOAST */}
      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
