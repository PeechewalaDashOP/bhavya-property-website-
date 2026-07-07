import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LeadRow = {
  id: number;
  status: string;
  reference_code: string;
  customer_name: string;
  contacted_at: string | null;
  closed_at: string | null;
};

const VALID_ACTIONS = ["contacted", "closed", "dead"] as const;
type Action = (typeof VALID_ACTIONS)[number];

function htmlPage(title: string, emoji: string, heading: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Prop100</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 16px rgba(0,0,0,.08);
    }
    .emoji { font-size: 56px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 10px; }
    p { font-size: 15px; color: #555; line-height: 1.5; }
    .ref { display: inline-block; margin-top: 16px; font-size: 13px;
           background: #f0f0f0; border-radius: 8px; padding: 6px 14px;
           color: #888; font-weight: 600; letter-spacing: 0.5px; }
    .brand { margin-top: 32px; font-size: 12px; color: #bbb; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${emoji}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    <div class="brand">Prop100 · Kota, Rajasthan</div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; action: string }> }
) {
  const { token, action } = await params;

  if (!VALID_ACTIONS.includes(action as Action)) {
    return htmlPage(
      "Invalid link",
      "❌",
      "Invalid link",
      "This action link is not recognised. Please use the buttons from your WhatsApp message."
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    return htmlPage(
      "Service error",
      "⚠️",
      "Service temporarily unavailable",
      "Please try again in a moment."
    );
  }

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });

  const { data: lead } = await db
    .from("leads")
    .select("id, status, reference_code, customer_name, contacted_at, closed_at")
    .eq("magic_token", token)
    .maybeSingle() as { data: LeadRow | null };

  if (!lead) {
    return htmlPage(
      "Lead not found",
      "🔍",
      "Lead not found",
      "This link may have expired or already been used. Check your WhatsApp for the correct link."
    );
  }

  const typedAction = action as Action;

  // If already in this state (or a terminal one), show a friendly message
  if (lead.status === typedAction) {
    const labels: Record<Action, string> = {
      contacted: "marked as Contacted",
      closed: "marked as Closed",
      dead: "marked as Dead",
    };
    return htmlPage(
      "Already updated",
      "✅",
      "Already updated",
      `Lead <strong>${lead.reference_code}</strong> was already ${labels[typedAction]}.`
    );
  }

  // Build update payload
  const now = new Date().toISOString();
  const update: Record<string, string> = { status: typedAction };
  if (typedAction === "contacted" && !lead.contacted_at) update.contacted_at = now;
  if (typedAction === "closed") {
    if (!lead.contacted_at) update.contacted_at = now;
    update.closed_at = now;
  }

  const { error } = await db
    .from("leads")
    .update(update)
    .eq("id", lead.id);

  if (error) {
    return htmlPage(
      "Update failed",
      "⚠️",
      "Update failed",
      "Could not update the lead status. Please try again or check the Supabase dashboard directly."
    );
  }

  const successConfig: Record<
    Action,
    { emoji: string; heading: string; body: string }
  > = {
    contacted: {
      emoji: "✅",
      heading: "Marked as Contacted",
      body: `You've marked lead <strong>${lead.reference_code}</strong> (${lead.customer_name}) as contacted. They'll be expecting your call!`,
    },
    closed: {
      emoji: "🔒",
      heading: "Deal Closed!",
      body: `Congratulations! Lead <strong>${lead.reference_code}</strong> (${lead.customer_name}) has been marked as closed.`,
    },
    dead: {
      emoji: "💀",
      heading: "Lead Marked as Dead",
      body: `Lead <strong>${lead.reference_code}</strong> (${lead.customer_name}) has been marked as dead and will not receive further follow-ups.`,
    },
  };

  const { emoji, heading, body } = successConfig[typedAction];
  return htmlPage(typedAction === "closed" ? "Deal Closed" : heading, emoji, heading, body);
}
