"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Area, Dealer, Lead, Property } from "@/lib/types";
import { fmt } from "@/lib/format";
import { saveLead } from "@/lib/getData";

type Props = { properties: Property[]; dealers: Dealer[]; areas: Area[] };
type Tab = "sale" | "rent" | "PG" | "Plot" | "Shop";
type GateCtx = { kind?: "dealer"; propId?: number; title: string; dealerName?: string; dealerPhone?: string; price?: number };
type ChatMsg =
  | { who: "bot" | "me"; text: string }
  | { who: "bot"; dealers: Dealer[] }
  | { who: "bot"; cards: Property[] };

const STATUSES = ["New", "Dealer contacted", "Visit done", "Deal closed – Won", "Closed – Lost"];
const COACH_AREA_IMG = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80";

export default function SiteClient({ properties, dealers, areas }: Props) {
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
  const [leads, setLeads] = useState<Lead[]>([]);

  // lead form fields
  const [ldName, setLdName] = useState("");
  const [ldPhone, setLdPhone] = useState("");
  const [ldIntent, setLdIntent] = useState("I want to Buy");

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
  const chatStarted = useRef(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  /* ---------------- effects ---------------- */
  useEffect(() => {
    try {
      setUnlock(new Set(JSON.parse(localStorage.getItem("kp_unlock") || "[]")));
      setLeads(JSON.parse(localStorage.getItem("kp_leads") || "[]"));
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
  function newRef() {
    return "KP-" + new Date().getFullYear() + "-" + String(leads.length + 1).padStart(4, "0");
  }

  /* ---------------- list ---------------- */
  const list = useMemo(() => {
    let l = properties.slice();
    if (tab === "sale") l = l.filter((p) => p.type === "sale");
    else if (tab === "rent") l = l.filter((p) => p.type === "rent");
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
  function persistLeads(next: Lead[]) {
    try { localStorage.setItem("kp_leads", JSON.stringify(next)); } catch {}
  }
  function openLead(ctx2: GateCtx) {
    setLeadCtx(ctx2);
    setLdName("");
    setLdPhone("");
    setLdIntent("I want to Buy");
  }
  function submitLead() {
    if (!leadCtx) return;
    const name = ldName.trim();
    const phone = ldPhone.replace(/\D/g, "");
    if (name.length < 2) return showToast("Please enter your name");
    if (phone.length < 10) return showToast("Enter a valid 10-digit phone");
    const ref = newRef();
    const lead: Lead = {
      ref, date: new Date().toISOString().slice(0, 10), name, phone, intent: ldIntent,
      prop: leadCtx.title || "(dealer enquiry)", dealer: leadCtx.dealerName || "—",
      price: leadCtx.price || 0, status: "New"
    };
    const nextLeads = [...leads, lead];
    setLeads(nextLeads); persistLeads(nextLeads);
    saveLead({ ref, name, phone, intent: ldIntent, prop: lead.prop, dealer: lead.dealer, price: lead.price });
    if (leadCtx.propId != null) {
      const next = new Set(unlock); next.add(leadCtx.propId);
      setUnlock(next); persistUnlock(next);
      setUnlockRef((m) => ({ ...m, [leadCtx.propId as number]: ref }));
    }
    const wasDealer = leadCtx.kind === "dealer";
    const dealerCtx = leadCtx;
    setLeadCtx(null);
    showToast("Contact unlocked ✓ Ref " + ref);
    if (wasDealer) {
      // open a small success modal reusing the property modal slot
      setModalProp(null);
      setDealerReveal({ ref, name: dealerCtx.dealerName || "", phone: dealerCtx.dealerPhone || "" });
    }
  }
  const [dealerReveal, setDealerReveal] = useState<{ ref: string; name: string; phone: string } | null>(null);
  function dealerLead(name: string, phone: string) {
    openLead({ kind: "dealer", dealerName: name, dealerPhone: phone, title: "(dealer enquiry)" });
  }

  function footerEnquiry(e: React.FormEvent) {
    e.preventDefault();
    const name = fName.trim(); const phone = fPhone.replace(/\D/g, "");
    if (name.length < 2 || phone.length < 10) return showToast("Please enter name and a valid phone");
    const ref = newRef();
    const lead: Lead = { ref, date: new Date().toISOString().slice(0, 10), name, phone, intent: fIntent, prop: "General enquiry", dealer: "—", price: 0, status: "New", msg: fMsg };
    const next = [...leads, lead]; setLeads(next); persistLeads(next);
    saveLead({ ref, name, phone, intent: fIntent, prop: "General enquiry", dealer: "—", price: 0, msg: fMsg });
    setFName(""); setFPhone(""); setFIntent("I want to Buy"); setFMsg("");
    showToast("Thanks! Ref " + ref + " — we will call you back ✓");
  }
  function setStatus(i: number, v: string) {
    const next = leads.map((l, idx) => (idx === i ? { ...l, status: v } : l));
    setLeads(next); persistLeads(next);
  }

  /* ---------------- chatbot ---------------- */
  function toggleChat() {
    const open = !chatOpen; setChatOpen(open);
    if (open && !chatStarted.current) {
      chatStarted.current = true;
      setMsgs([{ who: "bot", text: "Hi! 👋 I'm your Kota property assistant. Tell me what you're looking for and I'll find it." }]);
      setQreplies(["🏠 Homes to buy", "🔑 Homes for rent", "🎓 Near coaching", "📞 Talk to a dealer"]);
    }
  }
  function pushMsg(m: ChatMsg) { setMsgs((prev) => [...prev, m]); }
  function handleChat(text: string) {
    if (!text) return;
    pushMsg({ who: "me", text });
    setQreplies([]);
    setTimeout(() => reply(text), 350);
  }
  function reply(text: string) {
    const t = text.toLowerCase();
    if (/start over/.test(t)) {
      setMsgs([{ who: "bot", text: "Let's start again 🙂 What are you looking for?" }]);
      setQreplies(["🏠 Homes to buy", "🔑 Homes for rent", "🎓 Near coaching", "📞 Talk to a dealer"]);
      return;
    }
    if (/dealer|agent|contact|call/.test(t)) {
      pushMsg({ who: "bot", text: "Sure! Share your details once and we'll connect you directly with a verified dealer:" });
      pushMsg({ who: "bot", dealers: dealers.slice(0, 3) });
      setQreplies(["🏠 Show homes to buy", "🔑 Show rentals"]);
      return;
    }
    const type = /rent|kiraya|lease/.test(t) ? "rent" : /buy|sale|kharid/.test(t) ? "sale" : null;
    const area = areas.find((a) => t.includes(a.name.toLowerCase().split(" ")[0]));
    const bhkM = t.match(/(\d)\s*bhk/);
    const bhk = bhkM ? +bhkM[1] : null;
    const coaching = /coaching|allen|resonance|motion|study/.test(t);
    let l = properties.slice();
    if (type) l = l.filter((p) => p.type === type);
    if (area) l = l.filter((p) => p.loc === area.name);
    if (bhk) l = l.filter((p) => (bhk >= 4 ? p.bhk >= 4 : p.bhk === bhk));
    if (coaching) l = l.filter((p) => p.coaching);
    if (!type && !area && !bhk && !coaching && !/home|flat|house|villa|plot|pg|property|ghar/.test(t)) {
      pushMsg({ who: "bot", text: "I can help you find homes to buy or rent in Kota. Try: <i>“2 BHK in Talwandi”</i> or tap an option below 👇" });
      setQreplies(["🏠 Homes to buy", "🔑 Homes for rent", "🎓 Near coaching", "📞 Talk to a dealer"]);
      return;
    }
    if (!l.length) {
      pushMsg({ who: "bot", text: "I couldn't find an exact match 😅 — here are some popular homes instead:" });
      l = properties.filter((p) => p.verified).slice(0, 3);
    } else {
      pushMsg({ who: "bot", text: `Found <b>${l.length}</b> ${type === "rent" ? "rentals" : type === "sale" ? "homes for sale" : "homes"}${area ? " in " + area.name : ""}${bhk ? " (" + bhk + " BHK)" : ""}. Here are my top picks:` });
    }
    pushMsg({ who: "bot", cards: l.slice(0, 3) });
    setQreplies(["Show more options", "📞 Talk to a dealer", "🔁 Start over"]);
  }

  /* ---------------- derived display ---------------- */
  const areaCount = (name: string) => properties.filter((p) => p.loc === name).length;
  const dealerCount = (name: string) => properties.filter((p) => p.dealer.name === name).length;
  const wonLeads = leads.filter((l) => l.status === "Deal closed – Won");
  const wonValue = wonLeads.reduce((s, l) => s + (l.price || 0), 0);

  /* ===================================================================== */
  return (
    <>
      {/* HEADER */}
      <header className="hd"><div className="wrap in">
        <div className="logo">Kota<b>Property</b></div>
        <nav>
          <a href="#listings" onClick={() => setTab("sale")}>Buy</a>
          <a href="#listings" onClick={() => setTab("rent")}>Rent</a>
          <a href="#areas">Areas</a>
          <a href="#dealers">Dealers</a>
          <a href="#why">Why Us</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="sp" />
        <button className="post" onClick={() => scrollToId("contact")}>+ Post Property</button>
        <button className="ham" onClick={() => setMobOpen((v) => !v)}>☰</button>
      </div></header>
      <div className={"mob" + (mobOpen ? " show" : "")} onClick={() => setMobOpen(false)}>
        <a href="#listings" onClick={() => setTab("sale")}>Buy</a>
        <a href="#listings" onClick={() => setTab("rent")}>Rent</a>
        <a href="#areas">Explore Areas</a>
        <a href="#dealers">Our Dealers</a>
        <a href="#why">Why Choose Us</a>
        <a href="#process">How It Works</a>
        <a href="#about">About Us</a>
        <a href="#contact">Contact / Enquiry</a>
      </div>

      {/* HERO + SEARCH */}
      <div className="hero" id="home"><div className="wrap">
        <h1>Find your home in Kota</h1>
        <p>Verified houses, flats, plots &amp; rentals — direct from trusted dealers</p>
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
              {areas.map((a) => <option key={a.name}>{a.name}</option>)}
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
          <span><b>{areas.length}</b> Areas</span>
          <span><b>{dealers.length}</b> Verified Dealers</span>
          <span><b>₹0</b> Buyer Brokerage</span>
        </div>
      </div></div>

      {/* EXPLORE AREAS */}
      <section id="areas"><div className="wrap">
        <h2 className="sec">Explore Kota area-wise</h2>
        <p className="sub">Tap an area to see all homes available there</p>
        <div className="areagrid">
          {areas.slice(0, 8).map((a) => (
            <div className="areacard" key={a.name} onClick={() => goArea(a.name)}>
              <img src={a.img} loading="lazy" alt={a.name} />
              <div className="ov"><b>{a.name}</b><span>{areaCount(a.name)} homes{a.coaching ? " · 🎓" : ""}</span></div>
            </div>
          ))}
        </div>
      </div></section>

      {/* LISTINGS */}
      <section id="listings" style={{ paddingTop: 10 }}><div className="wrap">
        <h2 className="sec">Properties in Kota</h2>
        <p className="sub">Filter and find what fits you</p>
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
        </div></div>
        <div className="rcount"><span>{ctx}</span> <b>{list.length}</b> properties</div>
        <div className="list">
          {list.slice(0, shown).map((p) => (
            <div className="card" key={p.id}>
              <div className="ph" onClick={() => setModalProp(p)}>
                <img src={p.img} loading="lazy" alt={p.title} />
                <span className="tag">{p.type === "sale" ? "For Sale" : "For Rent"}</span>
                {p.verified && <span className="ver">✓ Verified</span>}
                <span className="photos">📷 {p.photos}</span>
              </div>
              <div className="b">
                <div className="price">{fmt(p.price)}{p.type === "rent" && <small> /month</small>}</div>
                <div className="tt" onClick={() => setModalProp(p)}>{p.title}</div>
                <div className="lc">📍 {p.loc}, Kota{p.coaching ? " · 🎓 " + p.coaching : ""}</div>
                <div className="sp">
                  {p.bhk ? <span><b>{p.bhk}</b> BHK</span> : null}
                  {p.baths ? <span><b>{p.baths}</b> Bath</span> : null}
                  <span><b>{p.sqft.toLocaleString("en-IN")}</b> sqft</span>
                </div>
                <div className="ft"><div className="dl">Dealer: <b>{p.dealer.name}</b></div><button className="ct" onClick={() => setModalProp(p)}>Contact</button></div>
              </div>
            </div>
          ))}
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
        <h2 className="sec">Our verified dealers</h2>
        <p className="sub">Trusted local property dealers across Kota</p>
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
              <button className="cl" onClick={() => dealerLead(d.name, d.phone)}>📞 Contact dealer</button>
            </div>
          ))}
        </div>
      </div></section>

      {/* WHY US */}
      <section className="why" id="why"><div className="wrap">
        <h2 className="sec">Why choose KotaProperty</h2>
        <p className="sub">Simple, honest and made for Kota</p>
        <div className="whygrid">
          <div className="whycard"><div className="ic">🛡️</div><h4>Verified listings</h4><p>Real photos, real prices. No fake posts.</p></div>
          <div className="whycard"><div className="ic">🤝</div><h4>Direct to dealer</h4><p>Talk straight to the owner/dealer.</p></div>
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
          <div className="step"><div className="n">3</div><h4>Contact</h4><p>Call or WhatsApp the dealer.</p></div>
          <div className="step"><div className="n">4</div><h4>Move in</h4><p>Visit and finalise the deal.</p></div>
        </div>
      </div></section>

      {/* ABOUT */}
      <section id="about" style={{ background: "var(--surface)" }}><div className="wrap">
        <div className="about">
          <img src={COACH_AREA_IMG} alt="About KotaProperty" />
          <div>
            <h2>About KotaProperty</h2>
            <p>We are a Kota-based property platform connecting buyers and tenants directly with trusted local dealers. We started to fix a simple problem — fake listings, hidden prices and too many middlemen. Every home here is verified, with real photos and a direct line to the dealer.</p>
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
            <a href="#dealers">Our dealers</a>
            <a href="#why">Why choose us</a>
            <a href="#about">About us</a>
            <a onClick={() => setAdminOpen(true)} style={{ cursor: "pointer" }}>📊 Track deals (Admin)</a>
          </div>
          <div>
            <h5>Contact us</h5>
            <a href="tel:+919829012345">📞 +91 98290 12345</a>
            <a href="mailto:hello@kotaproperty.in">✉️ hello@kotaproperty.in</a>
            <p>📍 Office: Vigyan Nagar, Kota,<br />Rajasthan 324005</p>
            <p>🕒 Open: 9 AM – 8 PM (Mon–Sat)</p>
          </div>
        </div>
        <div className="fbot">© 2026 KotaProperty · Built with Next.js, Supabase &amp; Vercel.</div>
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
                  <div className="reveal">
                    <div className="tick">✓ Your details are shared with the dealer.{unlockRef[modalProp.id] ? ` Reference: ${unlockRef[modalProp.id]}` : ""}</div>
                    <a className="btn" href={"tel:+" + modalProp.dealer.phone}>📞 Call {modalProp.dealer.name.split(" ")[0]}</a>
                    <a className="btn wa" href={`https://wa.me/${modalProp.dealer.phone}?text=${encodeURIComponent("Hi, I am interested in " + modalProp.title + " (KotaProperty)")}`} target="_blank" rel="noreferrer">💬 WhatsApp dealer</a>
                    <p className="refnote">Mention this reference to the dealer so your deal stays linked to KotaProperty.</p>
                  </div>
                ) : (
                  <div className="lock">
                    <div className="lk">🔒</div><h4>Dealer contact is protected</h4>
                    <p>We connect you directly to the dealer — no middlemen. Share your details once to unlock the phone &amp; WhatsApp.</p>
                    <button className="btn" onClick={() => openLead({ propId: modalProp.id, title: modalProp.title, dealerName: modalProp.dealer.name, dealerPhone: modalProp.dealer.phone, price: modalProp.price })}>Get contact details</button>
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
              <a className="btn wa" href={`https://wa.me/${dealerReveal.phone}?text=${encodeURIComponent("Hi (KotaProperty Ref " + dealerReveal.ref + ")")}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
              <p className="refnote">Quote this reference so your deal stays linked to KotaProperty.</p>
              <button className="btn-more" style={{ width: "100%", marginTop: 12 }} onClick={() => setDealerReveal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* LEAD GATEWAY FORM */}
      {leadCtx && (
        <div className="mask show" onClick={(e) => { if (e.target === e.currentTarget) setLeadCtx(null); }}>
          <div className="modal"><div className="mb lf">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 20 }}>{leadCtx.kind === "dealer" ? "Contact " + leadCtx.dealerName : "Get contact details"}</h2>
              <button onClick={() => setLeadCtx(null)} style={{ fontSize: 22, color: "var(--muted)" }}>×</button>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 14px" }}
               dangerouslySetInnerHTML={{ __html: leadCtx.kind === "dealer" ? `Share your details and we'll connect you directly with <b>${leadCtx.dealerName}</b>.` : `Share your details once to unlock the contact for <b>${leadCtx.title}</b>.` }} />
            <input placeholder="Your name" value={ldName} onChange={(e) => setLdName(e.target.value)} />
            <input placeholder="Phone number" inputMode="numeric" value={ldPhone} onChange={(e) => setLdPhone(e.target.value)} />
            <select value={ldIntent} onChange={(e) => setLdIntent(e.target.value)}>
              <option>I want to Buy</option><option>I want to Rent</option><option>Just exploring</option>
            </select>
            <button className="btn" onClick={submitLead}>Unlock contact details</button>
            <p className="refnote">🔒 Your details are safe and shared only with the dealer — no brokerage to you.</p>
          </div></div>
        </div>
      )}

      {/* ADMIN DEAL TRACKER */}
      {adminOpen && (
        <div className="mask show" onClick={(e) => { if (e.target === e.currentTarget) setAdminOpen(false); }}>
          <div className="modal" style={{ maxWidth: 780 }}><div className="mb">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 20 }}>📊 Deal tracker</h2>
              <button onClick={() => setAdminOpen(false)} style={{ fontSize: 22, color: "var(--muted)" }}>×</button>
            </div>
            <p className="dim" style={{ margin: "6px 0" }}>Every enquiry is logged with a reference code. Update the status as it progresses — mark <b>Deal closed – Won</b> when a customer buys or rents through us.</p>
            <div className="adminstats">
              <div className="ab"><b>{leads.length}</b><span>Total leads</span></div>
              <div className="ab"><b>{leads.filter((l) => l.status !== "New").length}</b><span>In progress</span></div>
              <div className="ab"><b>{wonLeads.length}</b><span>Deals won</span></div>
              <div className="ab"><b>{fmt(wonValue)}</b><span>Deal value</span></div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead><tr><th>Ref / Date</th><th>Customer</th><th>Property / Dealer</th><th>Status</th></tr></thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>No leads yet. Submit an enquiry to see it here.</td></tr>
                  ) : (
                    leads.map((l, i) => (
                      <tr key={l.ref}>
                        <td><b>{l.ref}</b><br /><span className="dim">{l.date}</span></td>
                        <td>{l.name}<br /><a className="dim" href={"tel:+91" + l.phone}>{l.phone}</a><br /><span className="dim">{l.intent}</span></td>
                        <td>{l.prop}<br /><span className="dim">{l.dealer || "—"}{l.price ? " · " + fmt(l.price) : ""}</span></td>
                        <td><select value={l.status} onChange={(e) => setStatus(i, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
            if ("text" in m) return <div key={i} className={"msg " + m.who} dangerouslySetInnerHTML={{ __html: m.text }} />;
            if ("dealers" in m) return (
              <div key={i}>
                {m.dealers.map((d) => (
                  <div key={d.id} className="msg bot" style={{ marginBottom: 8 }}>
                    <b>{d.name}</b> · {d.role}<br />⭐ {d.rating} · <button onClick={() => dealerLead(d.name, d.phone)} style={{ color: "var(--red)", fontWeight: 700 }}>Get contact →</button>
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
        </div>
        <div className="qreplies">
          {qreplies.map((q) => <button key={q} className="qr" onClick={() => handleChat(q)}>{q}</button>)}
        </div>
        <div className="chatin">
          <input placeholder="Type here… e.g. 2 BHK in Talwandi" value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") { handleChat(chatInput.trim()); setChatInput(""); } }} />
          <button onClick={() => { handleChat(chatInput.trim()); setChatInput(""); }}>➤</button>
        </div>
      </div>

      {/* TOAST */}
      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}
