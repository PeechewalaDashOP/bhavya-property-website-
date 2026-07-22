/* WhatsApp provider abstraction — the Conversation Engine and inbound
   webhook talk ONLY to this interface, never to a specific BSP/API.
   MSG91 (lib/msg91.ts) is a separate, untouched integration used only for
   OTP delivery — it does NOT implement this interface and the concierge
   does not call it. Swapping the concierge's WhatsApp transport (Meta
   Cloud API -> MSG91 -> Twilio -> 360dialog -> Interakt -> AiSensy) means
   adding a new file here and changing WHATSAPP_PROVIDER — the engine and
   webhook route never change. */

export type SendResult = { ok: boolean; providerMessageId?: string; detail?: string };

export type TemplateButton = { type: "url" | "quick_reply"; value: string };

export type TemplateSpec = {
  name: string;
  languageCode: string; // e.g. "en"
  variables?: Record<string, string>; // positional/body variables, provider maps as needed
  buttons?: TemplateButton[];
};

export type InboundMessage = {
  from: string; // phone number, digits only (no "+", no leading "91" normalization done here)
  text: string;
  providerMessageId: string;
  timestamp: number; // epoch ms
  raw: unknown; // original provider payload, for debugging only — engine never reads this
};

export type WebhookVerification = { ok: boolean; challengeResponse?: string };

export interface WhatsAppProvider {
  /* Free-form text — only deliverable inside WhatsApp's 24h customer
     service window (i.e. after the user has messaged us recently). */
  sendSessionMessage(to: string, body: string): Promise<SendResult>;

  /* Pre-approved template — required outside the 24h window or for any
     business-initiated message (after-hours auto-reply, etc). */
  sendTemplateMessage(to: string, tpl: TemplateSpec): Promise<SendResult>;

  /* Provider's webhook subscription handshake (e.g. Meta's GET
     hub.challenge echo). Called from the webhook route's GET handler. */
  verifyWebhook(req: Request): WebhookVerification;

  /* Normalizes an inbound POST payload into a single InboundMessage, or
     null if the payload isn't a user message this provider cares about
     (e.g. a delivery-status callback). Also responsible for verifying the
     POST signature/secret if the provider supports one. */
  parseInboundMessage(req: Request): Promise<InboundMessage | null>;
}
