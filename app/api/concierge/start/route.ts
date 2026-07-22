import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStudentSession } from "@/lib/studentSession";
import { createEnquiry } from "@/lib/concierge/engine";

/* Called when a logged-in student taps "Get help from Prop100" on a
   property (or a general "talk to us" entry point). Creates the
   concierge_enquiry the wa.me deep-link's reference code points back to,
   and returns that deep-link — the client just opens it, no WhatsApp SDK
   involved on this side. */
export async function POST(req: NextRequest) {
  const session = await getStudentSession(req);
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const propertyId = typeof body.propertyId === "number" ? body.propertyId : null;
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : null;

  let propertyTitle: string | null = null;
  if (propertyId) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRole) {
      const db = createClient(url, serviceRole, { auth: { persistSession: false } });
      const { data } = await db.from("properties").select("title").eq("id", propertyId).maybeSingle();
      propertyTitle = data?.title ?? null;
    }
  }

  let enquiry;
  try {
    enquiry = await createEnquiry({ studentId: session.id, propertyId, sourceUrl });
  } catch {
    return NextResponse.json({ error: "Could not start enquiry. Please try again." }, { status: 500 });
  }

  const waNumber = process.env.NEXT_PUBLIC_WA_BUSINESS_NUMBER || "";
  const prefill = propertyTitle
    ? `Hi Prop100, I'm interested in ${propertyTitle} (Ref: ${enquiry.reference_code})`
    : `Hi Prop100, I'd like help finding a property (Ref: ${enquiry.reference_code})`;
  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(prefill)}`;

  return NextResponse.json({ referenceCode: enquiry.reference_code, waLink });
}
