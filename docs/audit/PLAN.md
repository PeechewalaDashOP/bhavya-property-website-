# PLAN — everything after BLOCKERS, ranked by impact ÷ your hours

Assumes BLOCKERS.md is done and collection is running mornings (~8–10 hostels/day, 05).
Rule applied: solo-shippable only; anything needing a team or a paid service is cut or
flagged. Hours are focused-work estimates, not calendar days. Build in this order — each
item is useful the day it ships, while inventory grows underneath it.

---

## Tier 1 — ship while collecting (week 1 afternoons)

### 1. Extend-schema migration + seed `campuses` — ~2 h — 04, 03 §D2
The additive SQL from MIGRATION.md (verified_at, availability_status, notes_internal,
campuses table) + hand-seed ~10 campus pins from 03 §D2's table (verify each on Google Maps
first — the doc itself warns the addresses are secondhand). Everything in Tiers 1–3 reads
these. Do it before the first evening's photo-QC session.

### 2. Hostel card component — ~6 h — 03 §D8, 06 §5
The single highest-leverage UI piece: photo, "₹{min} se shuru" (min over `property_units`),
gender tag, "Allen Saakar {n} min walk" (Haversine → `ceil(m × 1.35 / 75)`; the formula is
in 03 §D2 and the Haversine function already exists twice in the codebase — extract to
`lib/geo.ts`), "✓ prop100 ne khud dekha — {date}" from `verified_at`, photo count + 🎥 badge.
Impact: every listing collected becomes visibly *better than every competitor's* the moment
it's approved. Reused by items 3, 4, 6, 9.

### 3. Area hub pages with the real filter set — ~8 h — 03 §D1, D3, D7
`/hostels/rajeev-gandhi-nagar`, `/hostels/talwandi` (data already flows through
`localities`). Chips: Boys|Girls (filter on `gender_preference` — the data is sitting there
unfiltered today), budget bands ≤6k/6–9k/9–12k/12k+ matching **ANY unit's**
`price_per_month` (not the building headline price — today's filter is wrong per spec),
AC (`has_ac` any unit), Mess included. Live count on the CTA; grey out zero-count chips.
This is the product. Existing `/kota/[slug]` pages give you the routing skeleton [OBSERVED].

### 4. Ranking query — ~4 h — 03 §D4
Deterministic score: freshness from `last_confirmed_at` (0–40) + media (0–30: photos≥8,
video) + completeness (0–15) + proximity when campus selected (0–15); tie-break
`md5(id || current_date)`. One SQL view or a TS sort over the fetched page — at ≤200 rows
either is fine. Without this, "Recommended" is insert order.

### 5. Homepage rework, hostel-first — ~8 h — 06 (all), 03 §D10
Replace the Buy-default tab hero (today `tab = "sale"` on load [OBSERVED SiteClient.tsx:71])
with the guided-browse chips (campus → gender → budget → live-count CTA). Delete: the
"{n} Areas / ₹0 Buyer Brokerage" stats block [OBSERVED SiteClient.tsx:504-508], the
coming-soon locality entries [OBSERVED :489], buy/plots tabs → footer line. Add proof strip,
2 area cards, fresh-listings rail (item 2's card), trust block with your founder note, FAQ.
⚠ This violates the "UI is FROZEN" rule in CLAUDE.md — that rule predates the hostel pivot;
06 explicitly supersedes it. Update CLAUDE.md the same day so future sessions don't fight you.

## Tier 2 — week 2, as inventory passes ~20 listings

### 6. Detail page: hostel-grade room matrix — ~5 h — 03 §D8, 04
The variant chip selector exists [OBSERVED PropertyDetail.tsx:446-531]. Add: per-unit price
WITH per-unit mess flag rendered ("₹7,500 mess incl." vs "+ mess ₹2,800"), deposit,
electricity line, curfew, nearest-2 campus walk-mins, "availability confirmed {n} din pehle"
from `last_confirmed_at`. Kills "price on request" ambiguity — the trust surface.

### 7. Thin-inventory behaviour + concierge — ~6 h — 03 §D5
Relaxation chain (budget step → drop AC → drop mess → other area → drop secondaries) with
honest per-card labels, and the WhatsApp concierge block on every 0–3-result state. At launch
inventory this fires constantly — it converts your thinnest weeks into leads and a
demand log. Cheap: it's the same card + filter code from item 3, re-parameterised.

### 8. Availability nudge loop — finish it — ~1 h + external wait — 03 §D8/D9
Code is done [OBSERVED /api/cron/nudge]. Remaining: MSG91 nudge template approval +
`CRON_SECRET` + `MSG91_NUDGE_TEMPLATE_ID` env vars + vercel.json cron entry (pending per
project notes). Freshness stamps (items 4, 6) are only honest if this loop runs. Do the
MSG91 template submission NOW — approval latency is out of your control.

### 9. Lead flow: hostel-owner variant + OTP re-enable — ~4 h + external wait — 03 §D6
Infra exists end-to-end (OTP hashing, rate limits, magic links, WhatsApp notify [OBSERVED]).
Remaining: prefilled wa.me message with hostel/room-type context, callback-lead fallback,
and re-enabling the OTP gate in SiteClient + PropertyDetail (bypassed pending WhatsApp
Business API approval [OBSERVED comments]). Blocked externally — same queue as item 8.
Until approval, keep the bypass; leads still save.

## Tier 3 — week 3, pre-soft-launch (gate: RGN ≥40 live listings)

### 10. SEO structure — ~8 h — 03 §D7
Gender×area pages (`/girls-hostels/rajeev-gandhi-nagar`), campus pages by **distance**
(`/hostels-near/allen-saakar-kota` — today's `/near/[hub]` filters by a text label, not
geo [OBSERVED near/[hub]/page.tsx:42]; rebuild on campuses+Haversine), the ≥5-listing
`noindex` threshold in generateMetadata, JSON-LD (`ItemList`, `LodgingBusiness` with per-unit
offers), sitemap from DB, GSC. ~150 words real Hinglish + FAQ per hub. Structure now, traffic
months 3–6 — as 03 says, don't judge it by week-2 numbers.

### 11. Seasonality v1 — ~2 h — 03 §D9
Wire `availability_status` (column from item 1) into the wizard, cards ("filling fast"),
and full-listings-greyed-at-bottom with waitlist-concierge CTA. Batch-cycle copy on hubs.

### 12. 4G/Android performance pass — ~4 h — 06 preamble
Lighthouse on a Moto-class device, LCP < 2.5 s on hubs + detail. Client-side image
compression before upload (04 media note — check what Step4Media does today; signed-URL
upload exists, compression unverified [INFERRED]). Lazy-load rails.

## Explicitly cut / deferred (and why)

- **Text search / autocomplete** — 03 §D1 defers to 500+ listings. Chips only.
- **Reviews, ratings, "trusted by X"** — 03 §D8 forbids empty/fake trust UI.
- **PostGIS / geocoding APIs** — Haversine at this scale; ₹0 (03 §D2).
- **Per-bed vacancy, floor plans, owner KYC, food menus, multi-video** — 04's v2 list.
- **Gemini chatbot revival** — blocked on Google billing; zero launch impact; a WhatsApp
  concierge (item 7) answers the same questions with a human — you — behind it.
- **`/map` and `/nearby` polish** — GPS-nearby is a v2 discovery mode; campus chips cover
  the real query. Leave the pages live, spend nothing.
- **Buy/plot legacy work of any kind** — demoted to a footer line (03 §D10). Don't delete,
  don't improve.
- **Commission/deal tracking beyond ref-codes** — anti-scope per 07 (03 §D6 note).

## Dependency notes

- 2 → (3, 5, 6, 7, 10) — the card is everywhere; build it first, once.
- 1 → (2's walk-mins, 4's proximity, 10's campus pages).
- 8's MSG91 template and 9's WhatsApp-API approval are external queues — file both
  submissions before writing any Tier-2 code.
