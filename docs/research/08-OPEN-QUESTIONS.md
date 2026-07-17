# 08 — OPEN QUESTIONS: what I could not resolve, and how you find out

Ordered by how much the answer changes the plan.

---

## 1. Kostel — your closest competitor is a black box `[UNKNOWN]`
JS-rendered SPA; fetch got only the shell. SERP title claims "500+ Verified PGs & Flats", ranks #1-page
from a vercel.app subdomain.
**Find out (15 min, your phone):** open kostel.co.in — real inventory or scraped/placeholder? Prices with
mess in/out? Lead flow? Do they cover RGN/Talwandi densely? If they genuinely have 500 verified listings
with photos, your differentiation narrows to campus-anchored search + video + freshness — still viable,
but changes launch messaging. Also check: are their listings stale (their weakness will be re-verification,
which your 15-day nudge solves).

## 2. JustDial's Kota hostel pages `[UNKNOWN — blocked twice]`
They hold the `Hostels-in-Rajeev-Gandhi-Nagar` category URL. **Find out:** open on phone; count listings,
check if any show prices/photos. Expectation `[PRIOR]`: name+phone only, no prices — confirming your data-
richness wedge. Confirm, don't assume.

## 3. Campus coordinates need ground truth `[OBSERVED sources, unverified pins]`
Addresses in 03 §D2 come from secondary pages (Allen contact page, Quora, directory sites). **Find out:**
drop each pin in Google Maps yourself; while collecting in RGN, walk past Saakar and Motion and confirm.
Also settle which OTHER Allen campuses students in RGN/Talwandi hostels actually attend — ask 5 hostel
owners "yahan ke bachhe kaunse campus jaate hain?" That answer decides which campus chips ship.

## 4. Room-type price variance — is the matrix right-sized?
I designed occupancy × AC × attached-bath. If Kota owners also price by floor, cooler vs AC, or
with/without food per room, the grid grows. **Find out on day 1 of collection:** if the matrix can't hold
the first 5 hostels' pricing without "notes" overflowing, adjust the schema THAT evening, not after 50.

## 5. Refusal rate + real minutes-per-hostel
I assumed 8–10/morning and 20–30% refusals `[INFERRED]`. Day-1 data will set the real collection calendar
and therefore the launch date. If it's 4/morning, launch gate (RGN ≥40) moves out a week — decide then,
don't grind quality down to hit a date.

## 6. What do parents vs students each need on the detail page?
I've assumed budget/gender/campus-distance primary and bathroom-photo-as-trust `[INFERRED]`. Cheap test:
when leads start, ask the first 10 callback users one question — "photo ke alawa kya dekhna tha?" Watch for:
mess menu, warden/security detail, electricity rate, parent-stay options.

## 7. MSG91 WhatsApp template approvals
Owner-notify and availability-nudge templates need Meta approval lead time (days, sometimes rejections),
and CRON_SECRET setup is still pending from earlier work. **Do this week** — it gates the lead flow (03
§D6) and the freshness system (D4). OTP re-enable also pending (currently bypassed in code).

## 8. Legal/practical: displaying owner numbers
Consent line is in the capture script (05). Unresolved: do any owners demand a masked number or
"only callbacks"? If >10% do, you need the callback path to be first-class earlier than planned. Track it
as a form checkbox from day 1.

## 9. Talwandi vs RGN sequencing
I gated launch on RGN ≥40 and let Talwandi trail. If door-to-door reveals Talwandi is denser/easier
(Samanvaya + Unacademy pull), flip the order — the architecture doesn't care, the launch Instagram post does.

## 10. Instagram → site conversion (zero data)
The whole demand plan leans on IG reels + WhatsApp forwards `[INFERRED]`. Instrument from day 1: UTM on the
bio link, count hero-CTA taps and phone-reveals (you have the `leads` table). If a week of reels moves
nothing, the fallback demand channels are hostel-owner referral ("apne current students se share karwao")
and coaching-gate flyering during the next intake wave — plan B exists, measure so you know when to pull it.
