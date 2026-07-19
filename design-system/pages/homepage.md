# Page override: Homepage (hostel-first rework — PLAN item 5, spec 06)

Overrides MASTER.md for `/` only. Everything not stated here inherits MASTER.

## Above the fold (~640px on a 375px device)

1. **Header 48px** (`--dark` band, existing `.hd`): logo `Prop100` · right: single CTA
   "Hostel list karo — FREE" (teal outline pill, links to `/dealer/post`). No hamburger,
   no tab row, no locality dropdown.
2. **Hero — the guided search (03 §D1):**
   - H1 28–32/800: **"Kota me hostel dhoondo"**
   - Sub 15/400 `--muted`: "Allen ke paas · apne budget me · har hostel humne khud dekha hai"
   - Chip row 1 (campus anchor, horizontal scroll if needed, inside own container):
     `Allen Saakar` `Allen Samanvaya` `Motion` `Unacademy` `Resonance` `Area se dekho ▾`
   - Chip row 2: `Boys | Girls` segmented toggle · budget chips `≤6k · 6–9k · 9–12k · 12k+`
   - CTA button (full-width, teal, 48px): **"{n} hostels dekho →"** — n is live from DB,
     updates on chip change, reserved width (tabular-nums) so the button doesn't jump.
   - NO text input. NO date picker. NO image carousel behind the hero (LCP).
3. **Proof strip** one line, real number: "✓ Rajeev Gandhi Nagar ke {n} hostels — sab
   visited & photographed by prop100".

## Below the fold, in order

4. **Area cards ×2** (RGN, Talwandi): real photo Bhavya took, name EN+HI, live count,
   "sab covered ✓" / "{n} hostels — aur aa rahe hain". Never a third "coming soon" card.
5. **Fresh listings rail**: horizontal scroll of 6–8 hostel cards (MASTER §5 card,
   the real component — no lite variant). `overscroll-behavior: contain`.
6. **Trust block "prop100 kya hai?"**: 3 steps + founder note (Bhavya photo, RTU line,
   WhatsApp button). This is the review-count substitute — do not add testimonials.
7. **Concierge band**: "Jo chahiye wo nahi mila? WhatsApp par batao — hum dhoondh
   denge, free." → prefilled wa.me link.
8. **FAQ** 5 Hinglish questions, FAQPage JSON-LD.
9. **Footer**: SEO link mesh (hubs, gender×area, campus pages) · owner CTA · one line
   for buy/rent legacy: "Ghar/flat chahiye? WhatsApp karo".

## Deletions from the current live homepage (03 §D10 — these ship OUT)

- Buy/Rent/PG/Plots/Commercial hero tabs (default tab is currently "sale" — gone)
- 30-locality dropdown incl. "Coming Soon" entries
- Stats block "{n} Properties / {n} Areas / ₹0 Buyer Brokerage"
- BHK/furnishing hero filters · stock imagery · dealer cards section on `/`

## Deliberately absent (do not add back)

City-wide map · login prompt (auth only at phone-reveal) · app-download nag ·
testimonial carousel · stats counters · English-first copy (Hinglish default) ·
chatbot FAB may stay but must not overlap the hero CTA on 375px.

## Note on CLAUDE.md "UI is FROZEN"

That rule predates the hostel pivot; 06 + this file supersede it **for this page**.
Update CLAUDE.md in the same PR that lands the new homepage so future sessions
don't revert the work. Visual language (tokens, chips, buttons) still comes from
globals.css — this is a re-architecture of `/`, not a restyle of the system.
