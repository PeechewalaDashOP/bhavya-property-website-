import { NextRequest, NextResponse } from "next/server";
import { verifyDealerToken } from "@/lib/dealerSession";
import { createClient } from "@supabase/supabase-js";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function session(req: NextRequest) {
  const token = req.headers.get("authorization")?.slice(7) ?? "";
  return verifyDealerToken(token);
}

// One in-progress "post a property" draft per dealer — lets someone who
// leaves mid-form pick up where they left off.

export async function GET(req: NextRequest) {
  const s = session(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceDb();
  const { data, error } = await db
    .from("property_drafts")
    .select("id,purpose,form_data,updated_at")
    .eq("dealer_id", s.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function PUT(req: NextRequest) {
  const s = session(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { purpose?: unknown; form_data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const purpose = String(body.purpose ?? "");
  if (!["rent", "sale", "pg"].includes(purpose)) {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }
  const formData = body.form_data && typeof body.form_data === "object" ? body.form_data : {};

  const db = serviceDb();
  const { error } = await db
    .from("property_drafts")
    .upsert(
      { dealer_id: s.id, purpose, form_data: formData, updated_at: new Date().toISOString() },
      { onConflict: "dealer_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = session(req);
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceDb();
  const { error } = await db.from("property_drafts").delete().eq("dealer_id", s.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
