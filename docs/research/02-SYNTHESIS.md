# 02 — SYNTHESIS: the ten questions

Tags as in 01: `[OBSERVED]` / `[PRIOR]` / `[INFERRED]` / `[UNKNOWN]`.

---

## 1. The spatial question

Distinct models observed for "where":

| Model | Platforms | Works for "near Allen, 10 min walk"? |
|---|---|---|
| Free-text locality + autocomplete | NoBroker, 99acres, Housing `[OBSERVED/PRIOR]` | No — assumes user thinks in locality names |
| Location + radius dial | SpareRoom, Rightmove `[OBSERVED]` | Partially — radius is the right math, wrong UI for teens |
| Commute-time from a station | SpareRoom advanced `[OBSERVED]` | **Yes — this is the model.** Swap "station" for "coaching campus" |
| University as first-class anchor | Amber ("City University or Property"), SpareRoom's "university campus" option `[OBSERVED]` | Yes — direct analogue: institute campus = university |
| POI framing without POI data | Zolo ("near place of work / study") `[OBSERVED]` | Framing only — resolves to locality under the hood `[INFERRED]` |
| Landmark URL pages | NoBroker `/pg-near-[landmark]_bangalore` `[OBSERVED]` | Yes for SEO — copy this URL grammar |
| Map draw/bounds | Airbnb, Zillow `[PRIOR]` | No — heavy, useless at 200 listings on 4G |

**Finding: no platform does landmark-anchored search well as the PRIMARY model.** Amber and SpareRoom
have the ingredients (university anchor, commute-time) but bury them. In Kota the landmark IS the market.
Institute-campus anchoring as the default (not an option) is your differentiator, and it costs you one
static table of ~12 campus coordinates. Critical detail `[OBSERVED]`: "Allen" is 14 centres — Saakar (Rajeev
Gandhi Nagar), Samanvaya (Talwandi), Sankalp + Samarth (Indra Vihar), Samyak + Sangyan (Landmark City)…
Anchor to **campuses, not institutes**.

## 2. The thin-inventory question

Techniques observed, ranked for 50 listings:

1. **Auto-relax + label honestly** (Airbnb shows nearby/date-flexible on zero results `[PRIOR]`) — best.
   At 50 listings every "no result" is one filter away from 5 results; relax budget band → AC → occupancy, in that order, and SAY you did.
2. **Concierge lead capture in the empty slot** (Zolo's zero-inventory pages: name+mobile form where results would be `[OBSERVED]`) — second best, and dirt cheap: a WhatsApp "batao kya chahiye" button. For Zolo it's a scummy squat; backed by your real coverage it's a service.
3. **User-driven radius widening** (SpareRoom 15-step radius `[OBSERVED]`) — decent, but don't make the user do work software can do.
4. **Never show a dead end with a search-tips lecture** (SpareRoom's "try filtering your search" `[OBSERVED]`) — weak.
5. **Fake-density pages** (Zolo Kota `[OBSERVED]`) — falls apart; broken template strings ("Zolo near , Kota") visible to users. Do not.

**Graceful:** Airbnb, Booking (auto-widen) `[PRIOR]`. **Falls apart:** Zolo (fake pages), big Indian portals
(dead SERPs with ads) `[OBSERVED/PRIOR]`.
**Deeper point `[INFERRED]`:** the real thin-inventory strategy is upstream, in the query surface — with no
free-text box and only chip-filters whose counts you control, impossible queries become unaskable. You can
even hide/grey a budget chip that would return 0.

## 3. The trust question

What actually works pre-reviews vs theatre:

| Works | Platform evidence |
|---|---|
| **Platform-side verification the platform itself performed** | Urban Company training/standards `[PRIOR]`; Homversity "Verified photos" `[OBSERVED]`; Zomato's hand-scanned menus = implicit "we were there" `[OBSERVED-secondary]` |
| **Freshness stamps** | Rightmove "Added today"/"Reduced today" `[OBSERVED]` — costs nothing, signals liveness |
| **Advertiser identity declaration** | SpareRoom advertiser type (live-in landlord vs agent) `[OBSERVED]`; NoBroker owner name on card `[OBSERVED]` |
| **Price transparency itself** | NoBroker rent+deposit on card `[OBSERVED]` vs portals' "price on request" — showing the number IS a trust signal |
| **Founder visibility** | Practo feet-on-street era `[OBSERVED-secondary]`; small-market pattern `[INFERRED]` |

| Theatre | Evidence |
|---|---|
| "100% Verified" with no mechanism shown | Amber `[OBSERVED]` — unverifiable claim |
| Big-number stats | Amber "2M+ beds"; your own site's "1 Properties / 30 Areas / ₹0 Buyer Brokerage" `[OBSERVED]` — a stat block showing "1" is anti-trust |
| Broken trust widgets | Amber's Trustpilot embed showing "No reviews to show" `[OBSERVED]` — worse than nothing |
| Paid "Verified" badges | JustDial `[PRIOR]` — users learn it's bought |

**Your answer: "Visited & photographed by prop100 on [date]" on every listing — true for 100% of your
inventory, and no competitor can say it (HelloWorld can, but only for their ~15 own properties).**

## 4. The photo question

- SpareRoom has a **"Photo ads only" filter** `[OBSERVED]` — the market treats photoless listings as a separate lower caste. NoBroker: "With Photos" filter `[OBSERVED]`. Photoless listings effectively don't exist.
- Card layer needs exactly ONE good lead photo (SpareRoom/Rightmove cards are single-photo + count `[OBSERVED]`).
- Rightmove carousel norm ~9 photos `[OBSERVED: "1/9"]`; Airbnb quality floor high `[PRIOR]`; JustDial survives at zero photos only via exhaustive coverage `[PRIOR]`.
- **Floor for you (phone camera): 8 photos + 1 video** — building front, the room (2 angles, one per rentable room-type), bathroom, mess/kitchen, corridor, terrace/common, street context. Full shot-list in 05-FIELD-CAPTURE. Your existing rule of ≥1 video per listing already exceeds every platform observed — video walkthrough was observed on none of them as a requirement. Keep it; it's a differentiator.
- Daylight, landscape, no filters; the bathroom photo is the trust photo — it is the one thing parents don't believe about Kota hostels. `[INFERRED]`

## 5. The SEO question

Best structure per listing for a thin catalogue: **NoBroker's URL grammar** `[OBSERVED]`:

```
/pg-in-{locality}_{city}          ← locality hub
/pg-near-{landmark}_{city}        ← LANDMARK page (the killer pattern for you)
/property/pg/pg-hostel-for-girls-in-{poi}-{city}-for-rs-{price}/{id}/detail
                                  ← listing slug carries gender+POI+price
```

Plus HelloWorld's Kota-specific tree `[OBSERVED]`: `/hostels-in-kota/{locality}/{property}` with
gender×locality variants — 9 localities × 2 genders ≈ 18 pages carrying an operator with ~15 properties.
That's the scale-per-listing benchmark: **~1 indexable page per listing** is achievable and sufficient.
SpareRoom is the anti-model: query-param searches, no programmatic pages `[OBSERVED]` — it can afford
brand-type-in traffic; you can't.
Zolo proves locality pages rank in Kota even with zero inventory `[OBSERVED]` — with 60 real listings you
out-rank them on content alone. Kostel ranking from a vercel.app subdomain `[OBSERVED]` confirms near-zero
domain-authority competition.

## 6. The lead question

Models observed: in-app chat (SpareRoom/OLX `[PRIOR]`), login-gated phone reveal (NoBroker "Get Owner
Details" `[OBSERVED]`), ungated agent phone (Rightmove `[OBSERVED]`), callback request (HelloWorld
`[OBSERVED]`, JustDial `[PRIOR]`), full online booking (Amber/Unite `[OBSERVED]`).

For Kota teens + parents `[INFERRED from Indian phone behaviour + observed models]`:
- In-app chat: dies — nobody returns to a website they visited once; WhatsApp is where chat lives.
- Online booking: absurd for a ₹8k/mo hostel chosen after a physical visit.
- Ungated phone: gets scraped by dalals; you also lose the lead log that is your future commission evidence.
- **Winner: OTP-gated reveal (NoBroker pattern) + WhatsApp deep link with prefilled message + callback fallback (HelloWorld pattern).** Prefilled message matters twice: shy 17-year-olds won't compose a cold message, and it stamps "via prop100.in" on every deal for later monetisation claims. Full flow in 03-SEARCH-SPEC.

## 7. The schema question — superset → doorway-collectable minimum

Superset observed across SpareRoom + NoBroker + HelloWorld + Unite + Rightmove cards/filters:
name, location, price (pw/pcm), deposit, bills-included, room type/size, occupancy, gender, en-suite,
furnished, food/meals (B/L/D), **gate closing time** (NoBroker PG `[OBSERVED]` — Kota-perfect field),
availability date/season, min/max stay, advertiser type, amenities (wifi, laundry, cleaning, power backup,
CCTV, parking, disabled access), pets, photos count, video, description, posted/updated date, owner name,
landmark proximity, floor/beds counts, preferred-for (student/professional).

**Cut to the 10-minute doorway form** (full version with Hinglish prompts in 05-FIELD-CAPTURE):
identity (name, gender served, lister type, phone/WhatsApp), GPS pin (one tap, standing there),
room-type × price matrix (occupancy × AC × attached-bath → ₹/mo), mess (included? veg? cost),
deposit, electricity billing, curfew/gate time, 10-item amenity checklist, availability now?,
8 photos + 1 video. Everything else is v2 or derivable.

## 8. The anti-pattern question — common everywhere, wrong for you

1. **Free-text search box** (every Tier A/B platform) — at ≤200 listings it's a zero-results generator and an SEO-crawl trap. Chips, not keyboards.
2. **Login-walled browsing / contact-credit quotas** (NoBroker) — works at 2L listings/month; at your scale every bounced teen is 1% of the day's demand. Gate only the phone number, with OTP you already have.
3. **Big-number trust stats** (Amber, your current homepage) — "1 Properties" is worse than silence. Replace with the one honest superlative: "every hostel in Rajeev Gandhi Nagar".
4. **Broker lead-blasting** (99acres model) — one enquiry → 5 dalals call the parent. The precise thing your market hates; your differentiator is that this never happens.
5. **Paid ranking / featured listings** (SpareRoom Boosted, JustDial, Practo's decay) — selling rank with 60 listings burns the only asset you have. Revisit at 500+.
6. **Map-first UI** (Zillow) — Leaflet tiles on 4G mid-range Android as the primary surface = 10s first paint. Map is a tab on the detail page, nothing more.
7. **In-app chat** (SpareRoom/OLX) — you'd be building a worse WhatsApp.
8. **30 "Coming Soon" areas** (your current site `[OBSERVED]`) — advertises emptiness. Two live areas, everything else invisible.
9. **Buy/Plots/Commercial tabs above the fold** (your current site) — you are a hostel site for the next 6 months. The tabs dilute the one thing you're exhaustive at.

## 9. The seasonality question

- Only Unite Students models it properly: **book by academic year ("Book now for 2026-27"), separate summer-stays product** `[OBSERVED]`. Amber/Unite treat availability as season-level, not date-level.
- Booking.com is date-first but that's nightly logic `[PRIOR]`. Indian portals: nothing — "available from" date at best `[PRIOR]`. HelloWorld Kota: zero batch messaging `[OBSERVED]` — a gap.
- **Transfer:** your unit of availability is the batch season, not the date. "July 2026 batch ke liye available" chip beats any date picker. Also `[OBSERVED via news]`: Kota admissions up 20–25% for 2026–27 after a 200k→125k slide — you're launching into recovering demand with high vacancy: owners will say yes to listing, and "available now" inventory is abundant. Off-season strategy = collect supply now, demand push aligned to the next admission wave.

## 10. The Tier D question — what Zomato/Practo/JustDial did that property portals never had to

1. **They created the data by hand** (Zomato scanned menus; Practo feet-on-street) instead of waiting for supply to self-list. Portals outsourced data entry to brokers and got broker garbage. You = Zomato model. The scanned menu's modern equivalent is your **room-price matrix + bathroom photo**.
2. **Directory before marketplace.** Zomato had no reviews, no ordering, no booking — just complete, accurate, findable information, and that was enough to win Delhi `[OBSERVED-secondary]`. prop100 v1 is a directory with a WhatsApp button. That is not a lesser product; it is the product.
3. **Exhaustive in a polygon before expanding** (Zomato city-by-city; Swiggy pincode-by-pincode `[PRIOR]`). Validates your RGN+Talwandi call.
4. **Supply-side tool as wedge** (Practo Ray SaaS before the consumer directory). Post-launch echo for you: the availability-confirmation WhatsApp loop is a free "vacancy manager" for owners — the hook that keeps data fresh (your 15-day nudge system is exactly this).
5. **Coverage beats richness when you must choose** (JustDial) — but at 100 listings you don't have to choose.
6. **What they teach about monetisation:** all three monetised the supply side AFTER owning demand — and the two that sold ranking (JustDial, Practo) damaged themselves doing it. Sequence: demand first, subscriptions/soft-fees later, never paid rank.
