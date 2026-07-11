import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyDealerToken } from "@/lib/dealerSession";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const payload = token ? verifyDealerToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { unitId: number; availableCount: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { unitId, availableCount } = body;
  if (typeof unitId !== "number" || typeof availableCount !== "number" || availableCount < 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = serviceDb();

  // Verify the unit belongs to a property owned by this dealer
  const { data: unit } = await db
    .from("property_units")
    .select("id, property_id, total_count, properties!inner(dealer_id)")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  const dealerIdOnProperty = (unit as unknown as { properties: { dealer_id: number } | null }).properties?.dealer_id;
  if (dealerIdOnProperty !== payload.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clampedCount = Math.min(availableCount, unit.total_count ?? 999);

  const { error } = await db
    .from("property_units")
    .update({
      available_count: clampedCount,
      last_confirmed_at: new Date().toISOString(),
    })
    .eq("id", unitId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, availableCount: clampedCount });
}
