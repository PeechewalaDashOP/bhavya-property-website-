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

export async function GET(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? "pending";
  const db = serviceDb();

  let query = db
    .from("properties")
    .select(
      "id,title,type,ptype,loc,price,rent_per_month,deposit_amount," +
      "is_approved,is_featured,slug,img,videos,gallery,features," +
      "description,created_at,dealer_id,hostel_meta,listing_status,dealers(name,phone,is_active,role)"
    )
    .order("created_at", { ascending: false });

  if (filter === "pending") query = query.eq("is_approved", false).eq("listing_status", "pending");
  else if (filter === "paused") query = query.in("listing_status", ["paused_owner", "paused_admin"]);
  else if (["live", "rejected"].includes(filter)) query = query.eq("listing_status", filter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

const VALID_ACTIONS = ["approve", "reject", "pause", "unpause"] as const;

export async function PATCH(req: NextRequest) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id: number; action: string };
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
