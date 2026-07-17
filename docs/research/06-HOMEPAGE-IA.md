# 06 — HOMEPAGE IA

Visitor model: 16–20yo (or parent), mid-range Android, 4G, arrived from an Instagram reel or a WhatsApp
forward, never heard of prop100, more comfortable in Hindi. They will decide in ~5 seconds whether this is
"a real thing". Weight budget: LCP < 2.5s on a Moto-class device; one system font stack or preloaded Inter
subset; hero has NO image carousel, NO map, NO 3D/GSAP.

Replaces the current live homepage `[OBSERVED]`: buy-first hero, 30-locality "Coming Soon" dropdown,
"1 Properties / 30 Areas / ₹0 Buyer Brokerage" stats, stock imagery — all deleted (03 §D10).

---

## Above the fold (one screen, ~640px)

**1. Header (48px):** `prop100` logo · right: "Hostel list karo — FREE" (owner-side CTA lives here and
only here) · no hamburger menu-forest.

**2. Hero (the guided search, 03 §D1):**
- H1: **"Kota me hostel dhoondo"**
- Sub: "Allen ke paas · apne budget me · har hostel humne khud dekha hai"
- Chip row 1 — anchor: `Allen Saakar` `Allen Samanvaya` `Motion` `Unacademy` `Resonance` `Area se dekho ▾`
- Chip row 2 — `Boys | Girls` toggle · budget chips `≤6k · 6–9k · 9–12k · 12k+`
- CTA button with live count: **"23 hostels dekho →"**
- No text input. No date picker. Chips are 44px tap targets.

**3. Proof strip (single line, real numbers from DB):**
"✓ Rajeev Gandhi Nagar ke {n} hostels — sab visited & photographed by prop100"

## Below the fold, in order

**4. Browse by area — 2 cards** (photo you took, name EN+HI, live count, "sab covered ✓"). No third
"coming soon" card. If Talwandi isn't exhaustive at launch its card says "{n} hostels — aur aa rahe hain",
nothing weaker.

**5. Fresh listings rail** — horizontal scroll of 6–8 listing cards (the real card component: photo,
"₹6,000 se", gender tag, "Allen Saakar 6 min", ✓visited badge, 🎥). Purpose: prove real inventory within
one thumb-flick of the hero. Deep-links into hubs.

**6. Trust block — "prop100 kya hai?"** 3 steps with icons:
"Hum har hostel khud jaake dekhte hain 📸" · "Sahi rate, sahi photo — koi dalali nahi" · "Seedha owner se
WhatsApp par baat karo". Below: founder note — your photo, "Main Bhavya, RTU Kota ka student. Har listing
maine khud visit ki hai." + WhatsApp button. This section is the review-count substitute (03 §D8).

**7. Concierge band:** "Jo chahiye wo nahi mila? WhatsApp par batao — hum dhoondh denge, free." → wa.me
prefilled. (Zolo empty-state pattern `[OBSERVED]`, made honest; also your demand log.)

**8. FAQ (Hinglish, 5 Q, FAQPage schema):** hostel kitne ka? · Allen ke paas kaunsa area? · dalali lagti
hai kya? (NAHI — the positioning answer) · number kaise milega? · hostel wale list kaise karein?

**9. Footer:** SEO link mesh — area hubs, gender×area, campus pages (03 §D7) · owner CTA · about/contact ·
"Ghar/flat chahiye? WhatsApp karo" (the buy/rent legacy demoted to one line).

## What is deliberately absent
City-wide map · buy/plots/commercial tabs · login prompt (auth appears only at phone-reveal) · app-download
nag · testimonial carousel (you have none — silence beats fakes) · stats counters · locality dropdown of 30
areas · English-first copy (default Hinglish; an EN toggle is v2 at best).
