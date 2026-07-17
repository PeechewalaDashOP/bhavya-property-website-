# 01 — PLATFORM MATRIX

Research date: 2026-07-16. Method: live fetches of real pages (server-rendered content only — JS-rendered
UI states like autocomplete dropdowns and interactive zero-result flows are not observable this way).

**Tags:** `[OBSERVED]` = seen in a live fetch this session. `[PRIOR]` = from training knowledge of the
platform, not verified today — treat as probably-right but stale. `[INFERRED]` = reasoned from observed
evidence. `[UNKNOWN]` = could not observe, refusing to guess.

**Access failures (recorded, not guessed):** JustDial (blocked ×2), MagicBricks (blocked),
Housing.com (HTTP 406), Airbnb (HTTP 403), OLX (timeout), 99acres/Zillow/Booking (not fetchable via this
method in past attempts on similar bot-protected SPAs; rows below are `[PRIOR]` only).

---

## TIER K — DIRECT KOTA COMPETITORS (added tier; found via live SERP — more important than Tier A)

SERP for "hostel in Kota Rajeev Gandhi Nagar for JEE students price" `[OBSERVED]`:
ranking sites are **Homversity, HelloWorld, Zolo (SEO page, zero inventory), Kostel (kostel.vercel.app AND kostel.co.in), JustDial nct page, rajhostel.com**.
A `*.vercel.app` subdomain ranking on page 1 means this SERP has almost no competition. The market is winnable on SEO.

### Kostel (kostel.co.in) — the closest direct competitor
| Field | Finding |
|---|---|
| Positioning | "Hostel in Kota Near Allen \| 500+ Verified PGs & Flats" (SERP title) `[OBSERVED]` |
| Rendering | Pure JS shell — fetch returned only meta/header, no server-rendered content `[OBSERVED]` |
| SEO consequence | Client-rendered SPA ⇒ weak indexable surface; ranks anyway ⇒ competition is thin `[INFERRED]` |
| Everything else | `[UNKNOWN]` — needs a manual phone visit by you (5 min, do it) |

### HelloWorld (thehelloworld.com) — operator with the best Kota SEO observed
| Field | Finding |
|---|---|
| Model | Own-operated branded hostels (like Stanza), not a marketplace `[OBSERVED]` |
| Inventory on RGN page | 10 listings; e.g. "HelloWorld Raman ₹8,000/month", "HelloWorld Gamma ₹12,000/month" `[OBSERVED]` |
| Card anatomy | Name → "Rent Starting From ₹X/month" → "BOYS ONLY" tag → 3 amenity icons + "+X More" (Daily Cleaning, Food, Internet, Water, Power backup, CCTV) `[OBSERVED]` |
| Lead capture | "Request Callback" button per card + "Let us do the searching for you" form + support phone `[OBSERVED]` |
| Institute proximity | Only incidental text: "Behind Resonance Coaching". No proximity model. `[OBSERVED]` |
| URL structure | `/hostels-in-kota/[locality]/[property-name]`; locality pages × gender variants for 9 areas (Talwandi, Jawahar Nagar, Vigyan Nagar, Landmark City, IPIA…) `[OBSERVED]` |
| Seasonality | None. No batch-cycle messaging. `[OBSERVED]` |
|

 Gap for prop100 | Operator = capped inventory; no landmark search; no exact room-type pricing; boys-skewed `[INFERRED]` |

### Zolo's Kota pages (zolostays.com/hostels-in-rajeev_gandhi_nagar-kota)
| Field | Finding |
|---|---|
| Reality | Programmatic SEO page with **zero inventory**: "Zolo near , Kota has 0 Hostel properties" (broken template string included) `[OBSERVED]` |
| Zero-result behaviour | Page stays live; shows "We currently have only a few stays matching your criteria. However, we are expanding really fast" + name/mobile lead-capture form where results would be `[OBSERVED]` |
| URL family | `/{type}-in-{locality}-{city}` mass-generated `[OBSERVED]` |
| Lesson | They squat on YOUR keywords with fake pages and harvest leads. Beatable with real inventory. `[INFERRED]` |

### Homversity
| Field | Finding |
|---|---|
| Model | Pivoted to own-operated ("Every home is owned & operated by Homversity"); Pune launch focus; Kota not on homepage `[OBSERVED]` |
| First input | "Select a city or locality" + All/Hostels/PGs/Apartments toggle `[OBSERVED]` |
| Trust | "Zero brokerage, 48-hour move-in, Verified photos", 4.8/5 badge, VC + press logos `[OBSERVED]` |
| Kota RGN URL that ranks | Returned 404 on fetch — stale/removed page still in index `[OBSERVED]` |

### JustDial (Kota hostels category)
| Field | Finding |
|---|---|
| Page exists | `justdial.com/Kota-Rajasthan/Hostels-in-Rajeev-Gandhi-Nagar/nct-10253730` ranks `[OBSERVED]` |
| Page content | `[UNKNOWN]` — blocked both fetches |
| Model | `[PRIOR]` Paid "Verified"/priority placement; callback + SMS blast of provider numbers to the enquirer and enquirer's number to providers; ratings sparse for hostels; data = name/address/phone only, no prices, no photos in most hostel listings |

---

## TIER A — STUDENT / ROOM / SHARED HOUSING

### SpareRoom (UK) — deepest analogue, fully observed
| Field | Finding |
|---|---|
| First input | Homepage = 3 search boxes ("Search 96,051 rooms to rent" / flatmates / buddy-ups); location text input + "Advanced search" link `[OBSERVED]` |
| Spatial model | Location text + **radius dropdown, 15 steps "This area only" → 40 miles**; advanced adds: London travel zones, tube line, **commute duration (10–60 min from a station)**, **university campus** `[OBSERVED]` |
| Filter taxonomy (full, from advanced form) | Search type (rooms/wanted/buddy); property type (room in share / studio / whole flat); price range with **pw/pcm toggle**; "all bills included"; furnished; en-suite; shared living room; room size double/single; rooms-for (F/M/couples); ages; min/max stay; move-in date picker; flatmate prefs (couples, occupation professional/student, gender mix, age range, household size, LGBT household); **advertiser type (private / flatmates / live-in landlord / no live-in landlord)**; pets; parking; **"Photo ads only"**; "Free to contact"; low/no deposit; veg/vegan; short-term; disabled access; availability 7-day vs Mon–Fri; keywords `[OBSERVED]` |
| First-class vs buried | SRP shows only location + radius; everything else behind Advanced `[OBSERVED]` |
| Default sort | "Default sort order" (opaque blend); options: Newest, Last updated, Price ↑, Price ↓ `[OBSERVED]` |
| Result card | Badge (Featured/FREE TO CONTACT/Boosted/New today) → photo + count → title → location + postcode → "£XXX pcm (bills inc.)" → room type + available date → snippet → **advertiser photo + name + type** → verification badge → save `[OBSERVED]` |
| Trust surface | "verified user" label; advertiser-type declaration (agent vs live-in landlord etc.) `[OBSERVED]` |
| Lead capture | `[PRIOR]` In-platform messaging; "FREE TO CONTACT" implies paid contact tiers (Early-bird upgrade to contact new ads) |
| URL structure | Listing `/flatshare/london/[area]/[id]`; searches = query-param soup (not SEO pages) `[OBSERVED]` |
| Thin-inventory | Suggests "try filtering your search" link to advanced; radius widening is user-driven `[OBSERVED]`; zero-result auto-behaviour `[UNKNOWN]` |
| Monetisation | `[PRIOR]` Freemium: pay to contact new ads early ("Early Bird"), Featured/Boosted ads |
| Language | English only `[OBSERVED]` |

### AmberStudent
| Field | Finding |
|---|---|
| First input | Single search, placeholder "City University or Property" — 3-entity autocomplete `[OBSERVED]` |
| Spatial model | City OR university OR property name; university is a first-class geo anchor `[OBSERVED]` |
| Trust | "2M+ beds, 800+ universities, 250+ cities"; "100% Verified Listings"; "Lowest Price Guarantee"; "24x7 Assistance"; Trustpilot embed (showing "No reviews to show" — broken) `[OBSERVED]` |
| Lead capture | Full online booking flow ("instant bookings") + live chat/WhatsApp/email `[OBSERVED]` |
| Card anatomy / filters / thin-inventory | `[UNKNOWN]` — city results page 404'd on both URL guesses (JS app routes) |
| Monetisation | `[PRIOR]` Commission from property operators per booking |

### Stanza Living
| Field | Finding |
|---|---|
| Kota | **Not present.** 16 cities, no Kota `[OBSERVED]` — the biggest branded student-housing player skipped India's biggest student-housing market. Consistent with the operator model needing high-rent metros. `[INFERRED]` |
| Model | Own-operated residences; catalogue browse, not marketplace search `[PRIOR]` |
| Card | Residence name + "starting from ₹X/mo" + gender tag `[PRIOR]` |
| Lead capture | Phone/schedule-a-visit + app `[PRIOR]` |

### Zolo Stays
| Field | Finding |
|---|---|
| First input | "Find a Zolo near place of work / study" — POI-anchored framing, note: not locality-first `[OBSERVED]` |
| Filters | Gender (Men's/Women's/Unisex PG), shared vs private, locality `[OBSERVED]` |
| Cities | 10+ metros; Kota only as fake SEO pages (see Tier K) `[OBSERVED]` |
| Lead capture | App-push ("Continue In App") + phone + lead forms `[OBSERVED]` |
| Language | No Hindi `[OBSERVED]` |

### Unite Students (UK)
| Field | Finding |
|---|---|
| Model | Own-operated; **books by academic year ("Book now for 2026-27")** — availability is a season, not a date `[OBSERVED]` |
| Price display | Property-level "Rooms available from £156.80/week" → room-type matrix on property page `[OBSERVED]` |
| Trust | "Price Promise" (price-drop match), ANUK accreditation, "30+ years", "All bills included", "No deposit" `[OBSERVED]` |
| Seasonality | Separate **summer-stays product** (1 week–whole summer, 21 cities) alongside academic-year tenancies `[OBSERVED]` — the only platform observed that models the academic calendar explicitly |

### Your-Space / Colive / Settl / Housr / University Living / Uniplaces — consolidated row
All operator or booking-agent clones of Stanza/Amber patterns `[PRIOR]`: city → residence catalogue → "from ₹X" → schedule visit/book. No landmark search, no marketplace dynamics, no thin-inventory lessons beyond what Stanza/Amber show. Deliberately skipped to save budget for Tier K. `[INFERRED]`

---

## TIER B — INDIA BROAD PORTALS

### NoBroker — fully observed, the most relevant Tier B
| Field | Finding |
|---|---|
| First input | Location search with locality autocomplete, city preselected; tabs Buy/Rent/Commercial; PG under menu `[OBSERVED]` |
| PG filter taxonomy | **Primary: Gender (Male/Female/Anyone), Room type (Single/Double/Triple/Four), Rent range.** Secondary: Preferred-for (Student/Professional), Food included (B/L/D), "With Photos", "Attached Bathroom", hide-seen, new listings `[OBSERVED]` |
| Default sort | `nbrank,desc` — proprietary blend `[OBSERVED]`; signals `[UNKNOWN]` |
| PG result card (order) | Name → location + "Explore Nearby" → owner name + posted date → **Rent/Month large** → Deposit → room types → gender tag → food details → **gate closing time** → "Get Owner Details" button → photos `[OBSERVED]` |
| Lead capture | "Get Owner Details" behind login; contact-credit quota model `[OBSERVED]`+`[PRIOR]` |
| URL structure | Listing: `/property/pg/pg-hostel-for-girls-in-iisc-bangalore-bangalore-for-rs-7500/[ID]/detail` (keyword-stuffed slug incl. **price**); locality: `/pg-in-bangalore_bangalore`; **landmark: `/pg-near-[landmark]_bangalore`** `[OBSERVED]` |
| Trust | "World's Largest NoBrokerage Property Site", "₹130 cr+ brokerage saved monthly", 30L+ customers `[OBSERVED]` |
| Monetisation | Tenant/Owner/Buyer/Seller subscription plans; **abandoned the deal-commission idea years ago** `[OBSERVED]`+`[PRIOR]` |
| Language | No Hindi `[OBSERVED]` |

### 99acres / MagicBricks / Housing.com / Makaan / Square Yards / CommonFloor / Quikr — consolidated row `[PRIOR]`
Broker-dominated supply; lead-form gating (form fires your number to N brokers); paid listing tiers + featured placement; enormous programmatic SEO (`/property-for-rent-in-{locality}-{city}` × budget × BHK); stale/duplicate listings endemic; "price on request" common; PG verticals exist but thin outside metros. MagicBricks & Housing blocked live fetch `[OBSERVED]`. For Kota hostels their inventory is near-zero `[INFERRED from SERP absence]` — they do not rank for your queries. **Nothing here to copy except URL grammar.**

### OLX real estate `[PRIOR]`
C2C classifieds: title + price + photo + posted-date cards; in-app chat first, phone optional; no structure (no gender/mess/occupancy fields); trust = none, scam-prone. Lesson: unstructured supply is easy to acquire and worthless to search. Fetch timed out `[OBSERVED]`.

---

## TIER C — GLOBAL BENCHMARKS

### Rightmove — observed
| Field | Finding |
|---|---|
| Filters | Primary: location + radius (→40 mi), price min/max (PCM), beds min/max; secondary dropdowns: property type, "Filters" `[OBSERVED]` |
| Sort | Relevance default; Highest/Lowest price, Newest/Oldest; "Prioritise properties with…" feature-boost sort `[OBSERVED]` |
| Card (order) | Badge → photo carousel "1/9" → floorplan/tour icons → **£pcm + weekly equivalent** → address → type + beds/baths → snippet → **agent logo + name** → "Added [date]" → agent phone visible ungated → save `[OBSERVED]` |
| URLs | Listing `/properties/[ID]`; search `/property-to-rent/London-87490.html` `[OBSERVED]` |
| Trust | Agent brand IS the trust; "Reduced today", "Added today" freshness stamps `[OBSERVED]` |
| Lesson | Freshness stamps as trust surface — free to copy. Phone ungated works because supply is professional agents. `[INFERRED]` |

### Airbnb `[PRIOR]` (fetch 403'd)
Where → dates → guests; **flexible-date search**; map-bound "search as I move the map"; zero results → "Try changing or removing some of your filters" + auto-shows nearby/date-flexible alternatives; card = photo-dominant, "Guest favourite" badge, nightly + total price; trust = reviews + Superhost + ID verification + platform escrow. Relevant to you only for: photo standards, zero-result copy tone, and price-transparency norms.

### Booking.com `[PRIOR]`
Dates-first (availability is the product); urgency theatre ("Only 2 left"); review score 0–10 with count; **"properties are ranked by a mix of price, availability and other factors" with paid visibility (visibility boosters)**; zero results → auto-widens to nearby cities/dates. Its dates-first model maps to your batch-cycle: "available for July 2026 batch" is your check-in date. `[INFERRED]`

### Zillow / Idealista / Realtor `[PRIOR]`
Map-first browse, saved-search alerts as retention engine, Zestimate as proprietary data moat. Nothing transfers at 200 listings except: map as secondary view, never primary, on 4G Android. Not fetched.

---

## TIER D — COLD-START ANALOGUES (your actual situation)

### Zomato (Foodiebay, 2008) `[OBSERVED via secondary sources]`
- Founders **scanned physical menus** and uploaded them — data nobody else had, collected by hand
- ~1,400 restaurants in Delhi-NCR in year 1; **directory first, reviews came later**; zero marketing, word of mouth
- Won on **data completeness of unglamorous facts** (the menu = the price sheet). Your equivalent: the **room-type × price matrix + real photos**, which no Kota competitor publishes
- Launched city-by-city, exhaustive per city before expanding

### Practo (2008–09) `[OBSERVED via secondary sources]`
- "Feet-on-street" collection of doctor data, door to door — literally your plan
- Sold a SaaS tool (Practo Ray) to the supply side first; the directory rode on top
- Cautionary: later paid-priority listings eroded trust ("doctors paying more to be listed higher") — **do not sell ranking, ever**

### JustDial `[PRIOR]`
- Thin ugly data (name/address/phone) still functional because it had **coverage** (everything) + **liveness** (phones answered). Monetised via paid priority + verified badges
- Lesson: at launch, exhaustiveness beats richness — but you can have both at 100 listings

### Urban Company `[PRIOR]`
- Manufactured trust in unverified-worker market via **platform-side standardisation**: training, uniforms, kit, ratings floor, platform-set prices. The platform absorbed the trust burden instead of surfacing provider reputation
- Your equivalent: **prop100 visits, photographs, and price-verifies every listing itself** — platform-side verification, not owner self-declaration

### Zomato/Swiggy locality launches `[PRIOR]`
- Launched pincode by pincode; a locality went live only when restaurant density made the app feel full **inside that polygon**. Empty-feeling app = churn. Your Rajeev-Gandhi-Nagar-exhaustive instinct is this exact playbook.
