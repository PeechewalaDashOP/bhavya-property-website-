# 03 — SEARCH SPEC: prop100 discovery architecture at launch

Decisions, not options. Designed for: ≤200 building-level listings, 2 areas (Rajeev Gandhi Nagar,
Talwandi), mobile 4G Android, Hinglish users, solo dev on Next.js 14 + Supabase. Every choice justified
at THIS scale; several are explicitly wrong at 5,000 listings and flagged.

---

## D1. There is no search box

The primary discovery surface is **guided browse**: tap chips, never type.

```
[ Institute chip row ]  → Allen Saakar · Allen Samanvaya · Motion · Unacademy · Resonance · "Area se dhoondo"
[ Gender toggle ]       → Boys | Girls
[ Budget chips ]        → ≤6k | 6–9k | 9–12k | 12k+   (₹/month)
[ CTA ]                 → "Hostels dekho (23)"        ← live count on the button
```

**Why:** free-text at 200 listings is a zero-results generator (02 §8). Every meaningful query in this
market is enumerable: campus × gender × budget. Chips also solve Hindi/English — a chip has no spelling.
The live count on the CTA is the thin-inventory defence at the query layer: a user can see "(3)" before
tapping and self-correct; a chip combination that would yield 0 renders greyed with "(0)".
`[INFERRED from SpareRoom/NoBroker filter observation + Zolo zero-page failure]`

**Deferred to 500+ listings:** text autocomplete over hostel names + localities (Amber's
"City University or Property" pattern).

## D2. Spatial model: campus-anchored, computed from two coordinates

**Reference data — `campuses` table, seeded by hand (~30 min of work):**

| institute | campus | area | source |
|---|---|---|---|
| Allen | Saakar | Rajeev Gandhi Nagar (opp. City Mall) | `[OBSERVED]` |
| Allen | Samanvaya | Talwandi (C-210/2) | `[OBSERVED]` |
| Allen | Sankalp (HO) | Indra Vihar (CP-6) | `[OBSERVED]` |
| Allen | Samarth | Indra Vihar (CP-14) | `[OBSERVED]` |
| Allen | Samyak | Landmark City | `[OBSERVED]` |
| Allen | Sangyan | Landmark City | `[OBSERVED]` |
| Motion | Main | Rajeev Gandhi Nagar (No. 50) | `[OBSERVED]` |
| Unacademy | Kota Centre | Talwandi (285-B) | `[OBSERVED]` |
| Resonance | CG Tower | IPIA, Jhalawar Rd | `[OBSERVED]` |
| PW Vidyapeeth | Main | IPIA | `[OBSERVED]` |

⚠ Verify each pin on the ground / Google Maps before seeding — addresses observed from secondary sources.
Allen has 14 Kota centres total; add the rest lazily as coverage expands.

**Listing side:** `lat, lng` captured by one tap of the phone's GPS while you stand in the doorway
(see 05). No geocoding service, no Google API, ₹0.

**Distance computation:** Haversine in SQL (or a 20-line TS function), `walk_min =
ceil(haversine_m × 1.35 / 75)` (1.35 route factor, 75 m/min teen walking pace). At 200 listings × 10
campuses = 2,000 pairs — compute at query time, no caching, no PostGIS. If you already have PostGIS
enabled in Supabase, `earthdistance`/`ST_DistanceSphere` is fine too, but do not add the extension just
for this.

**Display rule:** always as walking minutes, never km: `"Allen Saakar se 6 min walk"`. Show the nearest
2 campuses on the card, full campus list on detail page. Label honestly: "approx. walking".
`[INFERRED from SpareRoom commute-duration model, 02 §1]`

## D3. Filter set

**First-class (always visible, chip UI):**

| Filter | Values | Justification at ~60 listings/area |
|---|---|---|
| Gender | Boys / Girls | Hard constraint; splits inventory ~50/50; every Kota competitor leads with it (HelloWorld "BOYS ONLY", NoBroker gender-primary `[OBSERVED]`) |
| Budget band | ≤6k / 6–9k / 9–12k / 12k+ | The #1 stated filter; bands not sliders — a slider on 60 items is false precision. Matches if ANY room type falls in band |
| AC | AC / Non-AC / Any | The single biggest price axis in Kota room matrices; binary, cheap to collect |
| Mess | Included / Any | Parent's second question; NoBroker "Food Included" is primary `[OBSERVED]` |

**Secondary (behind one "More filters" sheet):**

| Filter | Why demoted |
|---|---|
| Occupancy (Single/Double/Triple) | Matters, but budget band already proxies it; NoBroker keeps it primary at 85 listings — at 60 it over-slices |
| Attached bathroom | Real differentiator, but 4 primary filters is the ceiling on a 360px screen |
| Area (RGN/Talwandi) | Usually pre-selected by entry point (campus chip or area page) |
| Hostel vs PG | Users don't distinguish sharply; keep as data, expose as filter later |

**Explicitly cut:** move-in date (batch season replaces it), furnishing, floor, "verified only" (100% are),
price slider, keyword search, "posted by owner/agent" as a *filter* (shown as badge instead — SpareRoom
advertiser-type observation, but at 100 hand-collected listings filtering by it just shrinks results).

## D4. Ranking (cold-start, no reviews, no clicks)

Deterministic score, computed in the query — no ML, no engagement data:

```
score =
  freshness      (0–40)  days since availability_confirmed_at:
                         ≤7d→40, ≤15d→30, ≤30d→15, else 0
+ media          (0–30)  photos≥8 →15; video →15
+ completeness   (0–15)  all room-types priced →10; deposit+mess+curfew present →5
+ proximity      (0–15)  only when a campus is selected:
                         ≤5 min walk→15, ≤10→10, ≤15→5, else 0
```

Tie-break: deterministic daily shuffle — `md5(listing_id || current_date)` — so equal listings rotate
fairly for owners instead of alphabetical bias, but stay stable within a day (no reshuffle on pull-refresh).

**Why these signals:** freshness is the only signal that decays (Rightmove's "Added/Reduced today" as
trust `[OBSERVED]`); media+completeness reward exactly what you control during collection and what users
punish otherwise (SpareRoom "Photo ads only" `[OBSERVED]`); no paid placement ever (02 §8.5).
Sort options for the user: **Recommended (default) · Price ↓ low-to-high · Nearest to [campus]**. Three, no more.

## D5. Thin-inventory behaviour (exact)

| Result count | Behaviour |
|---|---|
| **≥8** | Normal grid. |
| **1–7** | Results, then divider **"Aur options — thoda alag budget/area me"** followed by up to 6 relaxed-match cards (relaxation order below), visually identical but labelled per-card with why: "₹9,500 — budget se thoda upar", "Talwandi — 15 min door". |
| **0** | Never an empty page. Auto-run the relaxation chain, render its results under **"Exact match nahi mila — ye sabse kareeb hain"**, plus concierge block (below). If even relaxed = 0 (shouldn't happen with greyed-out chips, D1), concierge block alone. |

**Relaxation chain (fixed order, one step at a time until ≥6 results):**
1. widen budget band by one step (up first, then down)
2. drop AC constraint
3. drop mess constraint
4. widen to the other area (relabel distances honestly)
5. drop occupancy/bathroom secondaries

**Concierge block (on every 0–3 result state):**
> "Batao kya chahiye — hum dhoondh denge. Har hostel humne khud dekha hai."
> [WhatsApp par batao] → wa.me/<your number> prefilled: "Mujhe {gender} hostel chahiye, budget {band}, {campus} ke paas — prop100.in se"

This is the Zolo empty-state lead-capture pattern `[OBSERVED]` made honest by real coverage, and it is
also your demand-intelligence log: every concierge message is a datapoint on what inventory to collect next.

## D6. Lead flow, end to end

```
Card/detail CTA: [WhatsApp karo]  [Call karo]      ← primary/secondary
        │ tap
        ▼
 OTP verify via MSG91 (once per device; number stored)   ← RE-ENABLE OTP (currently bypassed in SiteClient/PropertyDetail)
        │
        ▼
 INSERT leads(listing_id, seeker_phone, channel, room_type?, created_at)
        │
        ├─► reveal owner number + open wa.me/91XXXX with prefilled:
        │   "Namaste, prop100.in par aapka hostel dekha — {Hostel Name}, {area}.
        │    {Occupancy} {AC} room ke baare me baat karni hai. Available hai?"
        │
        └─► MSG91 WhatsApp template to OWNER (you already built dealer-notify):
            "prop100 se lead: {seeker_phone} ne {Hostel Name} ke liye enquiry ki — {room type}, {date}"
```

- **Gate = OTP only, not account creation.** NoBroker's login-wall pattern `[OBSERVED]` at minimum viable dose.
- **Prefilled WhatsApp text is load-bearing:** teens won't cold-compose; and "prop100.in se" inside every first message is your only deal-attribution mechanism (see 07 on why commission tracking beyond this is anti-scope).
- **Fallback for the shy:** "Number chhodo, hostel wale aapko call karenge" → callback lead (HelloWorld pattern `[OBSERVED]`), which pings YOUR WhatsApp — at launch volume you are the callback desk, and it keeps you in the deal loop.
- Every lead row is permanent. In 6 months, "we sent you 43 tenants" is your monetisation pitch to owners. The `leads` table is the business.

## D7. URL + SEO structure

**Indexable path pages (static params, ISR):**

```
/                                        homepage
/hostels/rajeev-gandhi-nagar             area hub          ← index
/hostels/talwandi                        area hub          ← index
/girls-hostels/rajeev-gandhi-nagar       gender × area     ← index when ≥5 live listings
/boys-hostels/rajeev-gandhi-nagar        gender × area     ← same rule
/hostels-near/allen-saakar-kota          campus page       ← index when ≥5 within 15 min walk
/hostels-near/motion-kota                (NoBroker /pg-near-{landmark} grammar [OBSERVED])
/hostel/{slug}                           listing detail    ← index; slug = "shanti-boys-hostel-rajeev-gandhi-nagar-a7f3"
```

**Rules:**
- Filter states (budget/AC/mess) = query params, `noindex,follow`, canonical → parent path page. Params never create pages.
- **≥5-listing indexing threshold** enforced in generateMetadata — below it, `noindex` until inventory catches up. A 2-listing "hub" page in Google is the Zolo fake-page smell `[OBSERVED]`; don't ship it.
- Listing slug carries name+gender-signal+area (NoBroker slug grammar `[OBSERVED]`) but NOT price (yours re-verify monthly; price-in-URL rots).
- JSON-LD: `ItemList` on hubs; on detail pages `Accommodation`/`LodgingBusiness` with `offers` per room type, `geo`, photos.
- Hinglish long-tail: each hub page gets ~150 words of real Hinglish copy + 4-question FAQ ("Allen Saakar ke paas girls hostel kitne ka milta hai?") with FAQPage schema. This is the content stratum competitors lack — HelloWorld's copy is generic English `[OBSERVED]`.
- Sitemap.xml from DB; Google Search Console day 1; `og:image` = lead photo (WhatsApp shares show the room — every share is an ad).
- Expectation setting: SEO pays in months 3–6, not week 1. Launch traffic = Instagram + WhatsApp forwards. Build the structure now because retrofitting URLs later breaks links; do not judge it by week-2 traffic.

## D8. Trust surface at launch (owning "we have nothing")

| Element | Where | Source pattern |
|---|---|---|
| "✓ prop100 ne khud visit kiya — {date}" | every card + detail | Urban Company platform-side verification (02 §3); TRUE for 100% of launch inventory |
| "Availability confirmed {X} din pehle" | detail + ranking | Rightmove freshness stamps `[OBSERVED]`; powered by your 15-day WhatsApp nudge |
| Lister badge: Owner / Manager / Agent | card | SpareRoom advertiser-type `[OBSERVED]`; field already required+immutable per your policy |
| Exact ₹ per room type, deposit, mess cost — never "price on request" | detail | Price transparency as trust (02 §3, NoBroker `[OBSERVED]`) |
| Photo count + "Video 🎥" badge | card | SpareRoom photo-count `[OBSERVED]`; video exceeds every observed platform |
| Founder block: your name, face, "RTU student, Kota" + WhatsApp | homepage + about | Local founder = feature, not embarrassment (02 §3) |
| The one honest stat: "Rajeev Gandhi Nagar ke SAB hostels — {n} listed" | homepage | Replaces the current "1 Properties / 30 Areas" stat block `[OBSERVED on prop100.in]`, which must be deleted |

**Do not ship:** star ratings (empty), review UI (empty), "trusted by X students" (false), Trustpilot-style
widgets (Amber's broken embed `[OBSERVED]` is the cautionary tale), "100% verified" phrasing (Amber-style
unverifiable claim — say *who* verified *when* instead).

## D9. Seasonality model (v1 = one field + copy)

- `availability_status`: `available_now | filling_fast | full — next batch`. Set by you/owner via the confirmation nudge. Full listings stay visible greyed-at-bottom with "Full — waitlist" concierge CTA (inventory breadth signal + lead capture), not hidden.
- Homepage/hub copy references the batch cycle ("July 2026 batch ke liye available: {n} hostels").
- No date pickers, no calendar, no per-bed availability counts in v1. Unite Students' academic-year model `[OBSERVED]` at minimum viable dose.

## D10. Brownfield notes (what this replaces on prop100.in, observed live)

1. Hero tabs Buy/Rent/PG/Plots/Commercial → **hostel-first hero (D1 chips)**. Buy/plots move to a footer link ("Other property — WhatsApp us"), pages stay live but de-emphasised.
2. "Coming Soon" locality dropdown (30 areas) → deleted. Two live areas only.
3. Stats block "1 Properties / 30 Areas / ₹0 Buyer Brokerage" → deleted (D8).
4. BHK/Furnishing filters → replaced by D3 set for hostel inventory.
5. OTP bypass in SiteClient + PropertyDetail → re-enabled before launch (D6 depends on it).
6. Existing property schema → extended per 04-LISTING-SCHEMA (building + room_types), not rebuilt.

## Build order (solo dev, collection-concurrent)

**Days 1–2 — unblock collection (nothing else matters until this ships):**
schema migration (04) + campuses seed + **field-capture form** (05): mobile page at `/collect`, auth-gated
to you, GPS button, room-matrix grid, direct-to-Supabase-Storage photo/video upload with retry. Test on
your own phone on 4G in a real hostel.

**Days 3–7 (collection runs mornings, ~8–10 hostels/day; code afternoons):**
listing card (D8 badges, price-from, walk-min) → area hub pages → filter chips + counts → ranking query.

**Week 2:** detail page (room matrix table, photo carousel, video, campus distances, map tab) → lead flow
D6 incl. OTP re-enable + owner-notify template → thin-result behaviours D5 → homepage rework (06).

**Week 3:** campus + gender×area SEO pages, JSON-LD, sitemap, GSC; Hinglish copy pass; 4G/Android QA
(Lighthouse on Moto-class device, target LCP <2.5s); soft-launch gate: **RGN ≥40 live listings** → publish
+ Instagram push. Talwandi rolls in as collected.
