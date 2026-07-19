import { NextRequest, NextResponse } from "next/server";
import { assertAdminFromRequest } from "@/lib/assertAdmin";
import { createClient } from "@supabase/supabase-js";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const PAGE_SIZE = 20;

type DbClient = ReturnType<typeof serviceDb>;

// Supabase's fluent query builder narrows its own generic type on every
// .select()/.eq()/.or() call, which makes it impractical to thread through
// a shared helper with precise types (the builder type itself changes
// shape per chained call). `any` here is a pragmatic, deliberate choice —
// same tradeoff PostgREST helper functions commonly make — the runtime
// behavior (and the query results consumed below) stays fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statusFilter(query: any, filter: string) {
  if (filter === "pending") return query.eq("is_approved", false).eq("listing_status", "pending");
  if (filter === "paused") return query.in("listing_status", ["paused_owner", "paused_admin"]);
  if (["live", "rejected"].includes(filter)) return query.eq("listing_status", filter);
  return query; // "all"
}

export async function GET(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const filter = params.get("filter") ?? "pending";
  const loc = params.get("loc") ?? "";
  const ptype = params.get("ptype") ?? "";
  const q = params.get("q")?.trim() ?? "";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const order = params.get("order") ?? "new";

  const db = serviceDb();

  // Resolve a text search into a property-id/dealer-id predicate up front —
  // PostgREST can't cleanly OR across a joined table, so dealer-name matches
  // are resolved to dealer_ids first, same idea as the wallet route's
  // grouped-in-JS pattern (just for id resolution instead of aggregation).
  let searchDealerIds: number[] | null = null;
  if (q) {
    const { data: matchedDealers } = await db
      .from("dealers")
      .select("id")
      .ilike("name", `%${q}%`);
    searchDealerIds = (matchedDealers ?? []).map((d) => d.id);
  }
  const qIsNumeric = q !== "" && !Number.isNaN(Number(q));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyCommonFilters(query: any) {
    let out = statusFilter(query, filter);
    if (loc) out = out.eq("loc", loc);
    if (ptype) out = out.eq("ptype", ptype);
    if (q) {
      const clauses = [`title.ilike.%${q}%`];
      if (qIsNumeric) clauses.push(`id.eq.${Number(q)}`);
      if (searchDealerIds && searchDealerIds.length > 0) {
        clauses.push(`dealer_id.in.(${searchDealerIds.join(",")})`);
      }
      out = out.or(clauses.join(","));
    }
    return out;
  }

  // "leads" sort needs per-property lead counts, which isn't a real column —
  // resolve the full matching id list + counts first, sort in JS, then only
  // fetch full rows for the current page's ids. For every other sort order,
  // Postgres does the ordering directly and .range() paginates normally —
  // no need to pull the whole filtered set into memory.
  let rows: unknown[] = [];
  let total = 0;

  if (order === "leads") {
    const idQuery = applyCommonFilters(db.from("properties").select("id"));
    const { data: idRows, error: idErr } = await idQuery;
    if (idErr) return NextResponse.json({ error: idErr.message }, { status: 500 });
    const ids: number[] = (idRows ?? []).map((r: { id: number }) => r.id);
    total = ids.length;

    const leadCountMap = new Map<number, number>();
    if (ids.length > 0) {
      const { data: leadRows } = await db
        .from("leads")
        .select("property_id")
        .in("property_id", ids);
      for (const l of leadRows ?? []) {
        if (l.property_id == null) continue;
        leadCountMap.set(l.property_id, (leadCountMap.get(l.property_id) ?? 0) + 1);
      }
    }
    const pageIds = [...ids]
      .sort((a, b) => (leadCountMap.get(b) ?? 0) - (leadCountMap.get(a) ?? 0))
      .slice(offset, offset + PAGE_SIZE);

    if (pageIds.length > 0) {
      const { data: pageRows, error: pageErr } = await selectFullRows(db).in("id", pageIds);
      if (pageErr) return NextResponse.json({ error: pageErr.message }, { status: 500 });
      // .in() doesn't preserve order — re-sort the fetched page to match pageIds' lead-count order.
      const byId = new Map<number, unknown>((pageRows ?? []).map((r: { id: number }) => [r.id, r]));
      rows = pageIds.map((id: number) => byId.get(id)).filter(Boolean);
    }
  } else {
    let query = applyCommonFilters(selectFullRows(db));
    if (order === "old") query = query.order("created_at", { ascending: true });
    else if (order === "price_desc") query = query.order("price", { ascending: false });
    else if (order === "price_asc") query = query.order("price", { ascending: true });
    else query = query.order("created_at", { ascending: false }); // "new" (default)

    const countQuery = applyCommonFilters(
      db.from("properties").select("id", { count: "exact", head: true })
    );
    const [{ data, error }, { count, error: countErr }] = await Promise.all([
      query.range(offset, offset + PAGE_SIZE - 1),
      countQuery,
    ]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
    rows = data ?? [];
    total = count ?? 0;
  }

  // Lead counts for the current page only — cheap, scoped, used for the
  // per-card "12 leads" badge regardless of sort order.
  const pageIds = (rows as { id: number }[]).map((r) => r.id);
  const leadCounts: Record<number, number> = {};
  if (pageIds.length > 0) {
    const { data: leadRows } = await db.from("leads").select("property_id").in("property_id", pageIds);
    for (const l of leadRows ?? []) {
      if (l.property_id == null) continue;
      leadCounts[l.property_id] = (leadCounts[l.property_id] ?? 0) + 1;
    }
  }

  // Counts payload: status counts are global (whole inventory, ignoring the
  // current filter — that's the point of an "overview"); loc/ptype counts
  // are scoped to the current status tab only (matches what tapping a
  // facet would actually show), per the plan.
  const [{ data: statusRows }, { data: locPtypeRows }, { data: oldestPending }, { data: areaRows }] = await Promise.all([
    db.from("properties").select("listing_status"),
    statusFilter(db.from("properties").select("loc,ptype"), filter),
    db
      .from("properties")
      .select("created_at")
      .eq("is_approved", false)
      .eq("listing_status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Full area list (not just areas with a match in the current tab) so the
    // dropdown always shows every locality, "(0)" included — matches the
    // wallet page's own "show it even at zero" convention.
    db.from("areas").select("name").order("name"),
  ]);

  const statusCounts = { pending: 0, live: 0, paused: 0, rejected: 0, all: 0 };
  for (const r of statusRows ?? []) {
    statusCounts.all++;
    if (r.listing_status === "pending") statusCounts.pending++;
    else if (r.listing_status === "live") statusCounts.live++;
    else if (r.listing_status === "paused_owner" || r.listing_status === "paused_admin") statusCounts.paused++;
    else if (r.listing_status === "rejected") statusCounts.rejected++;
  }

  const locCounts: Record<string, number> = {};
  const ptypeCounts: Record<string, number> = {};
  for (const r of locPtypeRows ?? []) {
    if (r.loc) locCounts[r.loc] = (locCounts[r.loc] ?? 0) + 1;
    if (r.ptype) ptypeCounts[r.ptype] = (ptypeCounts[r.ptype] ?? 0) + 1;
  }

  return NextResponse.json({
    rows,
    total,
    leadCounts,
    areas: (areaRows ?? []).map((a) => a.name),
    counts: {
      status: statusCounts,
      loc: locCounts,
      ptype: ptypeCounts,
      oldestPendingAt: oldestPending?.created_at ?? null,
    },
  });
}

// Full field list so the admin detail view can show everything captured
// at listing time, not just the summary columns the table row needs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectFullRows(db: DbClient): any {
  return db
    .from("properties")
    .select(
      "id,title,type,ptype,loc,price,rent_per_month,deposit_amount," +
      "is_approved,is_featured,is_verified,slug,img,videos,gallery,features," +
      "description,created_at,dealer_id,hostel_meta,listing_status," +
      "sqft,furnishing_status,gender_preference,available_from,meals_included," +
      "min_stay_months,floor_number,total_floors,attached_bathroom,parking_available," +
      "wifi_included,nearest_coaching_hub,lat,lng," +
      "dealers(name,phone,is_active,role)," +
      "property_units(id,label,capacity,price_per_month,deposit_amount,total_count," +
      "available_count,has_ac,has_cooler,attached_bath,meals_included,description,sort_order)"
    );
}

const VALID_ACTIONS = ["approve", "reject", "pause", "unpause", "edit"] as const;

// Admin edit scope: pricing/rental-specific/description/moderation flags and
// title. Deliberately excludes type, ptype, loc, bhk, baths, dealer_id and
// slug — structural identity fields that stay fixed after creation (same
// "never rename the slug" rule CLAUDE.md holds for the whole app, and
// changing type/area would silently break existing filters/SEO for the
// listing). Extend this list if a real need for editing those comes up.
const ADMIN_EDITABLE_FIELDS = [
  "title", "price", "rent_per_month", "deposit_amount", "sqft",
  "furnishing_status", "gender_preference", "available_from", "min_stay_months",
  "floor_number", "total_floors", "meals_included", "attached_bathroom",
  "parking_available", "wifi_included", "nearest_coaching_hub", "description",
  "is_featured", "is_verified",
] as const;

export async function PATCH(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id: number; action: string; fields?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = serviceDb();

  if (action === "edit") {
    const fields = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    for (const key of ADMIN_EDITABLE_FIELDS) {
      if (key in fields) update[key] = fields[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const { error } = await db.from("properties").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // approve: first-time (or re-)publish -> live.
  // reject: soft — never approved, admin doesn't want it live. Row is kept
  //   (not hard-deleted) so the owner can see why and fix it. A future paid-
  //   listing expiry system will build on this same status — not built yet.
  // pause / unpause: admin-controlled visibility toggle on an otherwise-live
  //   (or previously live) listing, independent of the owner's own pause.
  const updates: Record<string, { is_approved: boolean; listing_status: string }> = {
    approve: { is_approved: true, listing_status: "live" },
    reject: { is_approved: false, listing_status: "rejected" },
    pause: { is_approved: false, listing_status: "paused_admin" },
    unpause: { is_approved: true, listing_status: "live" },
  };

  const { error } = await db
    .from("properties")
    .update(updates[action])
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/* Admin delete — unlike the dealer's own DELETE (app/api/dealer/property/[id]),
   admin can remove any listing in any status, no ownership check. Hard delete
   (property_units cascades via FK; leads.property_id is ON DELETE SET NULL,
   so historical lead records survive). sale_deals.property_id has NO cascade
   (migration_sale_deals.sql) — deleting a sale property with an existing deal
   raises a Postgres FK violation (23503), surfaced below as a clear message
   instead of a raw DB error. */
export async function DELETE(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await serviceDb().from("properties").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Can't delete — this property has a sale deal on record. Resolve or remove that deal first." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
