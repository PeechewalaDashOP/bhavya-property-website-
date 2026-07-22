import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/concierge/whatsapp";
import { resolveEnquiryForInbound, handleInbound } from "@/lib/concierge/engine";

/* Provider-agnostic inbound WhatsApp webhook. Never imports Meta/MSG91/
   any BSP directly — all transport specifics live behind
   getWhatsAppProvider(). Swapping WhatsApp providers is a config change
   (WHATSAPP_PROVIDER), not an edit to this route.

   Phase 1 launch: CONCIERGE_AI_ENABLED is off by default, so
   engine.handleInbound() always returns { reply: null } here — every
   inbound message is stored and the enquiry is routed to
   'awaiting_human' for the ops queue (see app/admin/concierge), with NO
   automatic WhatsApp reply sent. When AI automation is turned on later,
   this route's reply-sending branch below starts firing without any
   change to this file. */

export async function GET(req: NextRequest) {
  const result = getWhatsAppProvider().verifyWebhook(req);
  if (!result.ok || !result.challengeResponse) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(result.challengeResponse, { status: 200 });
}

export async function POST(req: NextRequest) {
  const provider = getWhatsAppProvider();

  let inbound;
  try {
    inbound = await provider.parseInboundMessage(req);
  } catch {
    return NextResponse.json({ ok: true }); // malformed/unsigned payload — ack and drop
  }

  // null = not a user text message this provider cares about (delivery
  // receipts, status callbacks, etc). Always ack with 200 either way so
  // the provider doesn't retry-storm us.
  if (!inbound) return NextResponse.json({ ok: true });

  try {
    const enquiry = await resolveEnquiryForInbound(inbound.from, inbound.text);
    const { reply } = await handleInbound(enquiry, inbound.text);

    // Only fires once AI automation is enabled — see file header note.
    if (reply) {
      await provider.sendSessionMessage(inbound.from, reply);
    }
  } catch (err) {
    // Never surface a 5xx to the WhatsApp provider for a single bad
    // message — that risks a retry storm. Log and move on; the message
    // is durably lost only if resolveEnquiryForInbound itself failed
    // before any DB write, which is rare (DB outage).
    console.error("whatsapp webhook processing failed", err);
  }

  return NextResponse.json({ ok: true });
}
