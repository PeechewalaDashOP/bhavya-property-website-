import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getDealerSessionFromCookieStore } from "@/lib/dealerSession";
import PostPropertyClient from "./PostPropertyClient";
import type { Purpose } from "./types";

// Server Component wrapper — resolves "is this dealer logged in" and "do
// they have a draft" here, before the first paint, instead of the old
// client-side fetch-after-mount approach. That client fetch was the cause
// of a ~0.3 CLS on this page: hasSession started at null, then flipped to
// true/false a moment after mount, popping the identity card (or the
// draft-resume banner) in above the purpose grid and shoving it down.
// Resolving both here means PostPropertyClient never renders the "still
// checking" state at all — the correct layout is what paints first.

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type Draft = { purpose: Purpose; form_data: Record<string, unknown>; updated_at: string };

export default async function PostPropertyPage() {
  const cookieStore = cookies();
  const session = await getDealerSessionFromCookieStore(cookieStore);

  let draft: Draft | null = null;
  if (session) {
    const { data } = await serviceDb()
      .from("property_drafts")
      .select("purpose,form_data,updated_at")
      .eq("dealer_id", session.id)
      .maybeSingle();
    draft = (data as Draft | null) ?? null;
  }

  return <PostPropertyClient initialHasSession={!!session} initialDraft={draft} />;
}
