# 05 — FIELD CAPTURE: door-to-door form + shot list

This goes to the field with you. Target: **≤10 min per hostel** (2 min talk, 4 min form, 4 min photos).
Build it as a mobile page `/collect` (auth-gated to you) writing straight to Supabase as `draft`.
8–10 hostels per morning ≈ RGN exhaustive in ~1 week.

---

## Opening script (doorway, Hindi)

> "Namaste, main Bhavya — RTU ka student hoon. prop100.in bana raha hoon — Kota ke hostels ki website,
> students ke liye. **Aapka hostel FREE me list** karna hai — photo main khud le lunga, 10 minute lagenge.
> Jab student aayega, seedha aapke number par call/WhatsApp aayega — beech me koi dalal nahi, koi charge nahi."

If asked "paise kya lagenge?": "Kuch nahi. Aage jaake agar hamse deal hui to baat karenge, abhi sab free hai."
If refused: note name + location in a refusals list, move on — full coverage means you WILL come back with
"aapke bagal wale 12 hostel already listed hain."

**Consent line (must say, tick a checkbox in the form):**
> "Aapka number website par login kiye hue students ko dikhega, aur photos website par lagengi — theek hai?"

## The form (in speaking order, not schema order)

**1 — Standing outside (before knocking): 60 sec**
- [ ] 📍 GPS button — captures lat/lng (the hardest schema field, one tap)
- [ ] Hostel name (from the signboard)
- [ ] Area: RGN / Talwandi ·  Type: hostel / PG / rooms ·  Gender: Boys / Girls / Coed
- [ ] Photo #1–2 now (front + street) — done before the conversation starts

**2 — Who am I talking to: 30 sec**
- [ ] Name · Phone · WhatsApp on this number? Y/N
- [ ] "Aap owner hain, manager, ya agent?" → owner/manager/agent (immutable — required)

**3 — The price matrix (the core 3 minutes).** Grid UI, one row per combination that exists:

| Room | AC? | Bath attached? | ₹/month | Mess incl.? | Khaali hai? |
|---|---|---|---|---|---|
| Single / Double / Triple / 4+ | Y/N | Y/N | ____ | Y/N | Y/N |

Script: "Kaun-kaun se room hain — single, double? AC wale? … Single AC kitne ka? … Ye mess ke saath ya
alag?" **Every price: confirm mess-in-or-out. This is the field that makes prop100 comparable and every
competitor ambiguous.** If owner says "depends" → record the standard asking rate, note "negotiable".

**4 — Money & rules: 90 sec**
- [ ] Deposit ₹ (0 allowed) · Electricity: included / meter / fixed
- [ ] Mess: included / optional (₹__/mo) / none · veg / veg+nonveg
- [ ] Gate band hota hai? → curfew time or none
- [ ] Total rooms (approx) · Abhi khaali? → available_now / filling_fast / full

**5 — Amenity checklist: 45 sec, tap-tap.** wifi · RO paani · power backup · CCTV · warden ·
laundry · daily cleaning · cooler · common fridge · parking · study table · attached bath (any)

**6 — Two lines in your words** (not the owner's): "Saaf hostel, naya building, mess ka khana average.
Allen Saakar 5 min." Honest > glossy — this is the description field.

**7 — Photos + video (4 min).** Shot list, in walking order:

| # | Shot | Why |
|---|---|---|
| 1 | Building front incl. signboard | identity + og:image candidate |
| 2 | Street/gali context toward main road | parents judge the area |
| 3–4 | Best available room of EACH rentable type: bed+window angle, then door angle | the product |
| 5 | **Bathroom** | the trust photo — the one parents don't believe |
| 6 | Mess/kitchen (if any) | second trust photo |
| 7 | Corridor or stairs | cleanliness signal |
| 8 | Common area / terrace / study room | best remaining asset |
| 🎥 | 45–60s walkthrough: gate → corridor → room → bathroom, phone landscape, walk slow, no talking needed | existing platform rule: ≥1 video; no competitor has this |

Rules: landscape, daylight/lights on, no people in frame, no filters. Lead photo = best ROOM shot, not the
building. Retake once if blurry, then move on — floor beats polish, you can reshoot top listings later.

**8 — Exit (30 sec):** "Kal-parso live ho jayega, main WhatsApp par link bhejunga. Rate change ho ya
full ho jaye to mujhe WhatsApp kar dena — main har 15 din khud puchunga." ← primes the availability-nudge
loop so it's expected, not spam.

## Daily rhythm
- Morning 8–12: collect (owners free, light good) → afternoon: photo QC, publish drafts, code
- Refusal expectation: 20–30% first pass. Log and revisit with social proof.
- End of day: every collected listing published or annotated why not. No draft backlog past 48h.

## Print checklist (one line)
GPS 📍 → name/board 📸 → owner+type → **price grid (mess in/out!)** → deposit/electricity/curfew →
amenity taps → 2 honest lines → 8 photos + video → consent ✔ → exit script.
