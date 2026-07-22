import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStudentSession } from "@/lib/studentSession";

const STATUS_LABELS: Record<string, string> = {
  new: "Received",
  ai_qualifying: "Being reviewed",
  awaiting_human: "Our team will reach out soon",
  human_active: "In progress with our team",
  connected: "Connected with owner",
  closed: "Closed",
  dead: "Closed",
};

/* The student's own enquiries only — service-role query scoped server-side
   by the session's student id, never a direct client-side Supabase read
   (concierge_enquiries has no client-facing RLS policy by design). */
export async function GET(req: NextRequest) {
  const session = await getStudentSession(req);
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }
  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data, error } = await db
    .from("concierge_enquiries")
    .select("id, reference_code, property_id, category, status, created_at, properties(title, slug, img)")
    .eq("student_id", session.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load enquiries" }, { status: 500 });

  const enquiries = (data ?? []).map((e: any) => ({
    id: e.id,
    referenceCode: e.reference_code,
    category: e.category,
    status: e.status,
    statusLabel: STATUS_LABELS[e.status] ?? e.status,
    createdAt: e.created_at,
    property: e.properties
      ? { title: e.properties.title, slug: e.properties.slug, img: e.properties.img }
      : null,
  }));

  return NextResponse.json({ enquiries });
}
