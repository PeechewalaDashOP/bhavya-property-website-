import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertAdminFromRequest } from "@/lib/assertAdmin";
import { getWhatsAppProvider } from "@/lib/concierge/whatsapp";

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const VALID_STATUSES = [
  "new", "ai_qualifying", "awaiting_human", "human_active", "connected", "closed", "dead",
] as const;

/* Full enquiry detail: student + property context + slot_state (what's
   already known, so a human never re-asks it) + full transcript. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = serviceDb();

  const { data: enquiry, error } = await db
    .from("concierge_enquiries")
    .select(
      `*, students(id, name, phone, whatsapp_number, created_at),
       properties(id, title, loc, ptype, type, price, rent_per_month, slug,
                   gender_preference, nearest_coaching_hub, meals_included, available_from)`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !enquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages } = await db
    .from("concierge_messages")
    .select("id, direction, sender, body, slot_updates, created_at")
    .eq("enquiry_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ enquiry, messages: messages ?? [] });
}

/* Ops actions: claim (assign to whoever's working it), send a manual
   WhatsApp reply, or advance the pipeline status. All three are separate
   actions rather than one big PATCH so the client can fire them
   independently without re-sending the whole enquiry state. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await assertAdminFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = serviceDb();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = String(body.action ?? "");

  if (action === "claim") {
    const assignedTo = String(body.assignedTo ?? "").trim().slice(0, 100) || null;
    const { data: current } = await db
      .from("concierge_enquiries")
      .select("status, first_human_at")
      .eq("id", id)
      .maybeSingle();
    const update: Record<string, unknown> = { assigned_to: assignedTo, updated_at: new Date().toISOString() };
    if (current && !current.first_human_at) update.first_human_at = new Date().toISOString();
    if (current && current.status === "awaiting_human") update.status = "human_active";
    const { error } = await db.from("concierge_enquiries").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "status") {
    const status = String(body.status ?? "");
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const { error } = await db
      .from("concierge_enquiries")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reply") {
    const message = String(body.message ?? "").trim();
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const { data: enquiry } = await db
      .from("concierge_enquiries")
      .select("id, status, first_human_at, students(phone)")
      .eq("id", id)
      .maybeSingle<{
        id: number;
        status: string;
        first_human_at: string | null;
        students: { phone: string } | null;
      }>();
    if (!enquiry || !enquiry.students) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }

    const sendResult = await getWhatsAppProvider().sendSessionMessage(enquiry.students.phone, message);
    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.detail || "Send failed — the 24h WhatsApp session window may have closed." },
        { status: 502 }
      );
    }

    await db.from("concierge_messages").insert({
      enquiry_id: id,
      direction: "outbound",
      sender: "human",
      body: message,
    });

    const advancedStatuses = ["connected", "closed", "dead"];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!advancedStatuses.includes(enquiry.status)) update.status = "human_active";
    if (!enquiry.first_human_at) update.first_human_at = new Date().toISOString();
    await db.from("concierge_enquiries").update(update).eq("id", id);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
