# 07 — ANTI-SCOPE: what you will be tempted to build, and must not

Each entry: the temptation → why it's wrong at ≤200 listings / solo dev → when it earns reconsideration.

---

## 1. The commission/deal-tracking system ← the big one, discussed and decided
**Temptation:** "10% of one month's rent when a deal closes, paid by the owner" — so build deal marking,
payment links, owner dashboards.
**Why not:** the model has a hole no code fixes: **you learn about a closed deal only if the owner tells
you, and telling you costs them ₹500–1000.** Reporting rate will approach zero. NoBroker — with lawyers and
a call centre — abandoned owner-success-fees for subscriptions `[PRIOR]`; Practo/JustDial monetised
placement instead and damaged trust doing it (02 §10).
**What to do instead (already in scope):** log every lead (03 §D6) and stamp "prop100.in se" into every
prefilled WhatsApp message. That's your attribution evidence. Launch = ₹0 revenue by design; in 3–6 months
sell owners what the leads prove: featured-photo shoots, "filling fast" placement on Instagram, or a flat
seasonal listing fee — all prepaid, none requiring deal detection.
**Reconsider:** never in this form. Commission works only when you control the transaction (booking +
payment), which is a different, much later product.

## 2. Free-text search / Algolia / Elasticsearch / pg_trgm autocomplete
Zero-results generator at 200 listings; chips enumerate every real query (03 §D1). **Reconsider at 500+
listings / 3+ areas.**

## 3. Reviews & ratings
Empty shelves at launch; gameable by owners the moment they're not empty; moderation is an ops job you
don't have. Your verification badge substitutes (02 §3). **Reconsider post-first-batch-cycle** with
tenant-verified reviews (phone matched against `leads`).

## 4. In-app chat
A worse WhatsApp, plus notification infra, plus moderation. WhatsApp deep links are the product. **Never**, probably.

## 5. Map-first search
Leaflet tiles + 200 markers on 4G mid-Android = dead first paint; teens navigate by campus name, not
cartography. Static map tab on detail page only (03). **Reconsider at multi-city.**

## 6. Owner self-serve listing portal (polishing the existing post-a-property flow)
Self-listed data is broker garbage (every Tier B platform proves it `[PRIOR]`); at launch YOU are the
capture pipeline — /collect (05) is the only intake that matters. Keep the public form as a lead-catcher:
name+phone+"hum aake photo le lenge". **Reconsider when a second collector joins.**

## 7. Native app / PWA push / app-download banners
Zolo pushes "Continue In App" `[OBSERVED]` because retention is their business; yours is a 2-week
once-a-year decision. Mobile web IS the product. **Reconsider: basically never for search side.**

## 8. Full i18n framework (next-intl etc.)
You need one voice — Hinglish in Devanagari-light — not a translation matrix. Hardcode the strings.
**Reconsider if a real EN/HI toggle is demanded by data.**

## 9. Saved searches, alerts, favourites-with-accounts
Retention machinery for a market with no repeat usage inside a season. Share-to-WhatsApp button on every
listing does the "save" job socially. **Reconsider at multi-city scale.**

## 10. Agent features (dashboards, multi-listing management, badges beyond the label)
Agents are allowed to list (policy decided: immutable owner/manager/agent declaration) but get zero
custom UI. Agent tooling monetises YOUR demand for them. **Reconsider when agents bring inventory you
can't collect yourself.**

## 11. Blog/CMS for SEO content
Hub-page Hinglish copy + FAQs (03 §D7) outrank a blog nobody links to; a CMS is a week of yak-shaving.
Write copy directly in the page components. **Reconsider month 3+ if GSC shows long-tail gaps.**

## 12. The 30-area dropdown & city-wide ambition in UI
Advertising emptiness (02 §8). Two areas live, period. Expansion = new area goes live only when
collection there passes ~40 listings (Swiggy pincode discipline, 02 §10).

## 13. Chatbot on the search path
There's a Gemini chatbot in the codebase (billing currently pending). Do not put it in the discovery flow —
a teen asking "hostel batao" must hit chips + concierge WhatsApp (a human who knows every building), not an
LLM. Park it. **Reconsider for owner-side FAQ automation later.**

## 14. React Three Fiber / GSAP / scroll-jacked landing polish
You said it yourself — not a priority. On 4G Android it's negative value. Founder credibility here =
load speed + real photos, not animation.
