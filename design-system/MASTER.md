# prop100 Design System — MASTER

Source of truth for all hostel-first UI (PLAN Tier 1–3: hostel card, area hubs, homepage
rework, detail page). Page-specific overrides live in `design-system/pages/<page>.md` —
if a page file exists, its rules win; otherwise this file rules alone.

Generated with the ui-ux-pro-max skill, then **anchored to the live site's existing
tokens** — the skill's generic suggestion (purple, oversized display type, new fonts)
was rejected: prop100 already has a brand (teal + navy + Inter) and a hard perf budget
(LCP < 2.5s on a Moto-class phone, 06 spec). We extend, we don't rebrand.

---

## 1. Pattern: Marketplace / Directory (mobile-first)

- **The chips ARE the search bar.** No free-text input anywhere (03 §D1). Hero =
  guided browse: campus chips → Boys|Girls toggle → budget chips → CTA with live count.
- Page order (homepage, per 06): Hero chips → proof strip → area cards (2) → fresh
  listings rail → trust/founder block → concierge band → FAQ → footer link mesh.
- Owner-side CTA ("Hostel list karo — FREE") lives in the header and only there.
- **Reduce friction to zero:** a chip combination that would yield 0 results renders
  greyed with "(0)" — never a dead end (skill rule: no-results dead ends; 03 §D5).

## 2. Color tokens (existing — do not invent new ones)

Use the semantic tokens from `app/globals.css`. Never raw hex in components.

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#0F766E` (teal-700) | CTAs, active chips, links, badges. 5.2:1 on white — AA ✓ |
| `--color-primary-rgb` | — | rgba() tints: active-chip fill `rgba(...,.04)`, shadows |
| `--dark` | navy | Header/footer bands, wizard top bar |
| `--ink` / `--color-heading` | near-black | Headings, price figures |
| `--muted` | grey | Secondary text — never below 4.5:1 on `--bg` for body-size text |
| `--bg`, `--color-surface` | off-white / white | Page / card surfaces |
| `--line` | light grey | Borders, dividers |
| `--red` | aliased to primary | Legacy alias — keep working, don't reintroduce true red except destructive |
| `--color-destructive` | red | Destructive/error only, always paired with icon or text (never color alone) |

**Status colors** (cards/detail): available = primary teal; "filling fast" = amber
`#B45309` (4.5:1 on white); "full" = `--muted` + greyed card. Each status always has a
text label — color is never the only signal.

## 3. Typography (existing)

- **Inter** (already loaded in `app/layout.tsx`) for everything. No new font families,
  no display faces — every added font is LCP tax on 4G (06 hard rule).
- Scale: 12.5 (badge/caption) · 13–14 (secondary) · 15–16 (body, min 16px on inputs to
  stop iOS zoom) · 18 (card title) · 22–24 (section) · 28–32 (hero H1). Line-height 1.5
  body, 1.2 headings.
- Weights: 800 hero/prices, 700 buttons/titles, 600 labels, 400 body.
- **Prices are content, not decoration:** `₹6,000 se` in `--ink` 700–800, tabular-nums
  so list columns don't wobble. Never "price on request" (03 §D8).
- Hinglish is the default copy voice (06). Devanagari not needed — Hinglish is Latin
  script; Inter covers it.

## 4. Spacing, radius, elevation (existing rhythm)

- 4/8px scale: 4 · 8 · 12 · 16 · 24 · 32 · 48. Section padding 24–32 mobile.
- Radius + shadows: reuse `--radius-sm/md/full` and `--shadow-1` from globals.css —
  one elevation scale, no ad-hoc shadow values.
- Container: existing `.wrap` max-width; cards full-bleed minus 16px gutters on 375px.
- z-index scale: content 0 · sticky header 50 · overlays/sheets 80 · modals 100 —
  match existing usage (chatfab is 80, wizard bar 50).

## 5. Components (specs for the Tier-1 build)

### Chip (filter/campus/budget) — extends existing `.fchip`
- Min 44×44px tap area (pad the hit area, not necessarily the visual), ≥8px gaps,
  `touch-action: manipulation`, `cursor-pointer`, `aria-pressed`.
- States: default (border `--line`) · active (border+text primary, 4% primary fill —
  the existing `.fchip.on` recipe) · zero-count (opacity .45, `aria-disabled`, still
  shows "(0)" — explain, don't hide).
- Counts render inside the chip label: `Girls (12)`. Live count on the CTA button:
  `"23 hostels dekho →"`.

### Hostel card (the workhorse — built once, reused on hub, rail, relaxed results)
- Anatomy top→bottom: photo (aspect-ratio 4/3 reserved — zero CLS; lazy-loaded except
  first card; `<img>` per repo rule, not next/image) · gender tag + availability status ·
  name (18/700, 2-line clamp) · `₹{min} se shuru` (`--ink`, 800) + "+ mess" hint when
  cheapest unit excludes mess · walk-min line "Allen Saakar se 6 min walk" (13.5,
  `--muted`) · trust row: "✓ prop100 ne khud dekha — {date}" + photo count + 🎥 badge.
- Whole card is the tap target (min height comfortably >44px); press feedback via
  existing card hover/active shadow transition (150–300ms, transform/opacity only).
- Full listings: greyscale photo + "Full — waitlist" chip, sorted to bottom, never hidden.

### Badges
- Visited badge: teal outline pill, 12.5/700. Lister badge: Owner/Manager/Agent neutral
  pill. Video: "🎥 Video" pill. Emoji inside pills follows the existing site convention
  (see §7 deviation note).

### Empty / thin states (03 §D5 — every result surface must implement)
- 0 results is never a blank page: relaxed-match cards under an honest Hinglish divider
  + concierge WhatsApp block. 1–7 results: results, divider, up to 6 relaxed cards each
  labelled with *why* ("₹9,500 — budget se thoda upar").

### Forms (wizard + lead gateway — already largely compliant, keep it so)
- Visible labels (never placeholder-only), errors below the field, `inputmode` per type
  (numeric for phone/rent — already done), submit buttons disable + show progress during
  async, required marks, autosave drafts (exists). Inputs ≥44px tall, 16px text.

## 6. Motion & performance budget

- Micro-interactions only: 150–300ms, `ease-out` in / `ease-in` out, existing
  `--duration-*`/`--ease` tokens. Animate transform/opacity only — never width/height/top.
- Max 1–2 animated elements per view. No scroll choreography, no GSAP, no Framer Motion,
  no parallax (CLAUDE.md hard rule + 4G budget). Respect `prefers-reduced-motion`.
- Images: WebP (upload pipeline already compresses client-side), explicit dimensions or
  `aspect-ratio` everywhere, `loading="lazy"` below the fold, hero/first card eager.
- Reserve space for async content (counts, rails) — CLS < 0.1. Skeleton shimmer over
  spinners for >300ms loads.
- `overscroll-behavior: contain` on horizontal rails so the fresh-listings rail doesn't
  fight vertical scroll; rail scrolls horizontally *inside its own container* only.

## 7. Deliberate deviations from the skill's generic rulebook

| Skill rule | Our call | Why |
|---|---|---|
| "No emoji as icons — use SVG library" | **Keep emojis** as label decorations (existing site-wide convention: chips, badges, steps) | Zero bundle cost on 4G; consistency with the live product beats icon purity. Emojis are never the *only* signal — always paired with text. Revisit post-launch. |
| "Autocomplete search" | **No search box at all** | 03 §D1: at ≤200 listings free text is a zero-results generator; chips have no spelling. |
| New font pairing suggestion | **Inter only** | LCP < 2.5s on Moto-class 4G (06). |
| Purple palette suggestion | **Existing teal `#0F766E`** | Live brand; teal passes AA on white; rebrand = zero user value. |
| Dark mode support | **Light only for v1** | Solo dev; not in any launch spec; halving QA surface. |

## 8. Pre-delivery checklist (every Tier-1 PR)

- [ ] Works at 375px; no horizontal page scroll (rails scroll internally)
- [ ] All tap targets ≥44px with ≥8px gaps; `touch-action: manipulation`
- [ ] Body text ≥16px; contrast ≥4.5:1 (check `--muted` on `--bg` usages)
- [ ] Images: aspect-ratio reserved, lazy below fold — CLS < 0.1
- [ ] Zero-count chips greyed not hidden; 0-result pages show relaxed cards + concierge
- [ ] Status/error states carry text, never color alone
- [ ] Keyboard: visible focus, logical tab order; `aria-pressed` on toggles
- [ ] `prefers-reduced-motion` respected; animations transform/opacity only
- [ ] No new npm packages, no new fonts, no `console.log`
- [ ] Lighthouse mobile on a hub page: LCP < 2.5s before merge
