import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signDealerToken } from "@/lib/dealerSession";

// Temporary direct login — OTP disabled until WhatsApp Business API is approved.
// To revert: delete this route and restore dealer login page to use /api/otp/send → /api/dealer/login/verify.
type DealerRow = { id: number; name: string; role: string };

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length !== 10) {
    return NextResponse.json({ error: "Enter a valid 10-digit phone number" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    return NextResponse.json({ error: "Service not configured" }, { status: 503 });
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data: dealer } = await db
    .from("dealers")
    .select("id, name, role")
    .or(`phone.eq.${phone},phone.eq.91${phone}`)
    .maybeSingle() as { data: DealerRow | null };

  if (!dealer) {
    return NextResponse.json(
      { error: "This number is not registered as a dealer. Contact admin." },
      { status: 403 }
    );
  }

  const token = signDealerToken(dealer.id, phone, dealer.name);
  return NextResponse.json({ token, dealer: { id: dealer.id, name: dealer.name } });
}
