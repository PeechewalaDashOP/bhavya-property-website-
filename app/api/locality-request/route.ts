import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { localityId, name, phone } = body as Record<string, string>;
  if (!localityId) return NextResponse.json({ error: "localityId required" }, { status: 400 });

  const cleanPhone = phone?.replace(/\D/g, "") ?? "";
  if (cleanPhone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }

  const db = serviceDb();
  const { error } = await db.from("locality_requests").insert({
    locality_id: localityId,
    name: name?.trim() || null,
    phone: cleanPhone,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to save request" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
