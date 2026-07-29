# Future Features — Not in MVP

Every idea below was deliberately deferred out of the Sale-module MVP (see
`docs/sale-architecture.md` for what IS being built). Nothing here should be
implemented without Bhavya explicitly asking for it first — this file exists
so good ideas aren't lost, and so whoever picks one up later has a running
start on where it plugs into the schema, not so anyone treats it as a
backlog to just start working through.

Each entry has a one-line description plus, where there's an obvious one, a
suggested database hook against the schema in `docs/sale-architecture.md` —
so adding it later doesn't require rediscovering the data model.

---

## AI

- **AI-generated property description** — Step 2's "✨ Generate Description"
  button exists in the MVP UI as a disabled placeholder only. Hook: a new
  `POST /api/dealer/property/generate-description` taking the already-filled
  `SaleForm` (ptype, area, price, amenity labels, location) as context,
  returning draft text into the existing `description` textarea — same
  request/response shape a chatbot completion would use elsewhere in this
  app (see `app/api/chat/route.ts`'s pattern).
- **AI photo quality scoring** — flag blurry/dark/duplicate photos at
  upload time. Hook: a `quality_score numeric` + `quality_flags text[]`
  column on a per-photo basis would need a proper `property_photos` table
  (photos are currently just a `text[]` on `properties.gallery` — this
  feature is the actual forcing function to normalize photos into their own
  table with metadata, which isn't done today for any property type).
- **AI image enhancement suggestions** — same prerequisite as above
  (a real `property_photos` table, not a bare URL array).
- **AI duplicate listing detection** — compare new submissions against
  existing `properties` by (loc, price range, sqft range, dealer_id) plus
  perceptual image hashing. Hook: a `duplicate_of_property_id` nullable
  self-FK on `properties`, populated by a background job at submit time.
- **AI property price estimation** — suggest a price range based on
  comparable `sale_property_details` rows (same ptype, locality_id, area
  range). Purely a read-side feature — no new schema needed, just a new
  API route doing an aggregate query.
- **AI missing-fields suggestions** — nudge the seller ("Warehouse listings
  with Loading Dock filled in get 2x more views") — purely a UI/copy
  feature layered on the existing wizard, no schema change.
- **AI lead qualification** — this already exists as a built (but disabled)
  system elsewhere in the app: `lib/concierge/engine.ts` +
  `lib/concierge/objectives/registry.ts` (slot-filling qualification over
  WhatsApp, `CONCIERGE_AI_ENABLED` currently off). Extending its
  `ObjectiveDefinition`s to cover Sale-specific objectives (buyer budget,
  purpose, timeline, financing) is mostly config, not new architecture —
  `RESIDENTIAL_BUY`/`PLOT`/`COMMERCIAL` objective definitions already exist
  in that registry today, unused because Sale currently reuses the generic
  `StandardFlow`. Once buyers browse the new Sale listings, wiring those
  existing objectives up is nearly free.
- **AI buyer-property matching** — needs a buyer preferences/saved-search
  table that doesn't exist yet anywhere in this app.
- **AI multilingual description generation** — same hook as
  AI-generated description, just asking for Hindi/English variants and
  storing both (`description` + `description_hi`, or a `descriptions
  jsonb` map).
- **AI fraud detection** — pattern-matching across `dealers`/`properties`
  (many listings, one phone, price outliers, etc.) — a background scoring
  job, no schema change required beyond maybe a `fraud_score` column.
- **AI chatbot for seller assistance** — a Sale-specific guided-help widget
  during the wizard itself (distinct from the site's existing `/api/chat`
  buyer-facing widget). Would need its own lightweight route, no new tables.

## Verification

- **Verified Property Badge** — `properties.is_verified` already exists and
  is used by Hostel; Sale can reuse it as-is once a verification workflow
  exists to set it (currently only admin-toggled).
- **Verified Owner Badge** — would live on `dealers` (e.g.
  `owner_verified_at timestamptz`), separate from per-listing verification.
- **Document Verification Workflow** — the MVP already uploads sale
  deed/registry/patta/RERA/mutation documents (upload-only, unverified).
  Hook: a `property_documents` table (`property_id, doc_type, url,
  verification_status, verified_by, verified_at`) instead of stuffing
  document URLs onto `properties` directly — this is the natural next
  table once verification becomes real.
- **Video Verification Workflow** — same shape as document verification,
  applied to the required video-tour upload.
- **Government ID Verification** — would attach to `dealers`
  (`id_doc_url`, `id_verification_status`), a KYC-style addition, not
  listing-specific.
- **Face Verification** — same owner-level KYC bucket as government ID.

## Seller Dashboard

- **Listing analytics** (view count / save count / share count) — needs
  event tracking. Hook: a lightweight `property_events` table
  (`property_id, event_type, created_at`, no PII) rather than counter
  columns on `properties`, so multiple event types can be added later
  without more schema churn.
- **Lead analytics / lead timeline / lead source tracking** — this app
  already has a real `leads` table with `source_url`, `status`,
  `contacted_at`/`closed_at` timestamps (see CLAUDE.md's Lead Gateway
  section) — a seller dashboard surfacing this per-property is mostly a
  new read-only admin/dealer page, not new schema.
- **Buyer inquiry management** — same underlying `leads` table, scoped to
  `dealer_id`, surfaced in a dealer-facing UI (`/dealer/leads` or similar)
  that doesn't exist yet.
- **Property performance insights** — derived entirely from
  `property_events` + `leads`, no new raw data needed beyond those two.

## Marketing

- **Featured Listings / Boost Property / Premium Listing** —
  `properties.is_featured` already exists (boolean, admin-only today).
  A paid self-serve version would need a `featured_until timestamptz` +
  a payment/order record — likely reusing the wallet infrastructure
  already built for lead billing (`lib/leadService.ts`,
  `supabase/migration_wallet.sql`) rather than inventing a second payment
  system.
- **Homepage Promotion** — purely a query-ordering feature
  (`is_featured`/`featured_until`), no new schema beyond the above.
- **Social Media Auto Sharing** — an outbound integration (e.g. posting to
  a Facebook/Instagram API on publish) — no schema hook, purely a
  post-submit side effect hung off `POST /api/dealer/property`.

## Buyer Experience

- **Schedule Visit / Calendar Integration** — needs a `property_visits`
  table (`property_id, buyer_lead_id, scheduled_at, status`) — a genuinely
  new concept, doesn't exist anywhere in this app today.
- **Virtual Tour (360°) / Floor Plan Upload / Drone Video Upload** — all
  three are just additional media categories. Hook: extend the
  `prepare-upload` route's `category` enum (`photo|video|document`) with
  `floor_plan`/`tour_360`/`drone_video`, store the resulting URLs on
  `properties` (new `floor_plan_url`, `tour_360_url` columns) or, better,
  once `property_photos`-style normalization happens (see AI photo scoring
  above), as rows with a `media_type` column there instead.
- **Download Brochure** — a generated PDF from existing listing data, no
  new schema, purely a rendering feature.
- **Nearby Places Auto Detection** — this already has a real, working
  precedent this week: `hostel_meta.nearby_places` (manually entered) and
  the `localities` table's new Locality Guide columns
  (`average_rent`/`popular_coachings`/`best_cafes`/`transport`/
  `safety_note`, see `supabase/migration_locality_guide.sql`). An
  "auto-detect" version would call a places API (Google Places or
  similar) at submit time and populate the same shape automatically —
  genuinely new integration, but the storage shape already exists.
- **EMI Calculator / Home Loan Eligibility** — pure client-side calculation
  using `properties.price`, no schema needed at all.
- **Price History Graph** — needs a `property_price_history` table
  (`property_id, price, changed_at`) populated by a trigger or app-level
  hook whenever `properties.price` changes.
- **Similar Property Suggestions** — a query feature (same ptype +
  locality_id + price range), no new schema — same underlying data as
  the "AI price estimation" comparable-lookup above.
- **Compare Properties** — pure frontend feature (client-side selection of
  N properties), no schema needed.
- **Wishlist** — needs a `wishlists` table (`buyer_identifier, property_id,
  created_at`) — but "buyer_identifier" implies buyer accounts, which
  don't exist yet anywhere in this app (customers are only OTP-verified
  per-lead today, not persistent accounts) — this is a bigger prerequisite
  than it looks.

## Communication

- **In-app Chat** — the site already has a buyer-facing AI widget
  (`/api/chat`, Gemini-backed) and a separate, currently-disabled
  WhatsApp concierge system (`lib/concierge/`, full slot-filling engine +
  provider abstractions for LLM and WhatsApp transport, see
  `lib/concierge/engine.ts`) — a Sale-specific in-app chat would most
  naturally extend the concierge system's existing `concierge_enquiries`/
  `concierge_messages` tables rather than build a third messaging system.
- **WhatsApp AI Assistant** — this is literally what the disabled
  concierge system already is, end-to-end, just switched off
  (`CONCIERGE_AI_ENABLED` unset). See the "AI lead qualification" note
  above — this was scoped and discussed with Bhavya in this same session,
  separately from the Sale-module work, and deliberately parked for later.
- **Call Tracking / Missed Call Automation** — needs a telephony
  integration (virtual numbers per listing/dealer) — no existing hook in
  this codebase at all; a genuinely new vendor integration.
- **Notification Center / Push Notifications** — needs a
  `notifications` table (`recipient_type, recipient_id, type, payload
  jsonb, read_at, created_at`) and, for push specifically, a device-token
  registration table — neither exists today (all current notifications
  are one-way WhatsApp sends via MSG91, no in-app inbox).

## Admin

- **Manual Review Queue / Property Moderation / Approval Workflow** —
  the MVP already lands every Sale submission as `is_approved: false`,
  `listing_status: 'pending'` in the existing admin properties panel
  (`app/admin/properties/page.tsx`) — this is the review queue today,
  just without Sale-specific fields visible in the edit view yet (see
  "Explicitly out of scope" in the Sale architecture doc — that's the
  concrete next step here, not a new system).
- **Fraud Detection Dashboard / Duplicate Detection Dashboard** — surfaces
  the AI fraud/duplicate-detection hooks noted above, once those exist.
- **Audit Logs** — needs a generic `audit_log` table
  (`actor_type, actor_id, action, entity_type, entity_id, diff jsonb,
  created_at`) — no existing precedent in this codebase; every admin
  action today is a direct DB write with no history trail.

## Enterprise Scalability

- **Multi-city support** — `localities` already has a `level: 'city' |
  'locality' | 'sublocality'` hierarchy (`parent_id` self-FK) built for
  exactly this, currently only populated for Kota. Expanding cities is a
  data-seeding exercise against the existing table, not a schema change.
- **Builder Projects** — a builder posting many units under one
  development needs a new `builder_projects` table (`id, builder_dealer_id,
  name, locality_id, ...`) with `properties.builder_project_id` as an
  optional FK — a real new concept, doesn't exist today.
- **Bulk Property Upload / CSV/Excel Import** — a batch-processing layer
  on top of the same `POST /api/dealer/property` contract (§4.2 in the
  Sale architecture doc) — the per-property validation/insert logic is
  reusable as-is; the new part is a file-parsing + row-by-row submission
  loop.
- **API for Builders** — an authenticated API surface (API keys per
  dealer/builder) wrapping the same submission contract — needs an
  `api_keys` table (`dealer_id, key_hash, scopes, created_at,
  revoked_at`), doesn't exist today (no API-key auth anywhere in this
  app — only session cookies and admin email/password).
- **CRM Integration / Lead Distribution Engine** — outbound webhooks off
  the existing `leads` table's insert/update events — no new tables,
  primarily a `webhooks` config table (`dealer_id, url, events text[],
  secret`) plus a dispatch job.
- **Referral System** — needs a `referrals` table
  (`referrer_dealer_id, referred_dealer_id, status, reward_paise,
  created_at`) — a genuinely new concept.
- **Agent Management / Commission Tracking** — `sale_deals` already exists
  (`supabase/migration_sale_deals.sql` — `agreed_price_paise`,
  buyer/seller commission fields, status enum) as the deal-tracking layer
  for Sale commissions today; a full agent-management layer (agents as a
  role distinct from dealers, multi-agent commission splits) would extend
  that table's model rather than replace it.
