/* Deterministic WhatsAppProvider for tests — no network. Records every
   send so a test can assert on outbound reply channel/content, and lets a
   test feed a scripted inbound message without a real webhook payload. */

import type {
  WhatsAppProvider,
  SendResult,
  TemplateSpec,
  InboundMessage,
  WebhookVerification,
} from "./types";

export class MockWhatsAppProvider implements WhatsAppProvider {
  public sessionMessages: { to: string; body: string }[] = [];
  public templateMessages: { to: string; tpl: TemplateSpec }[] = [];
  private nextInbound: InboundMessage | null = null;

  queueInbound(msg: InboundMessage) {
    this.nextInbound = msg;
  }

  async sendSessionMessage(to: string, body: string): Promise<SendResult> {
    this.sessionMessages.push({ to, body });
    return { ok: true, providerMessageId: "mock-" + this.sessionMessages.length };
  }

  async sendTemplateMessage(to: string, tpl: TemplateSpec): Promise<SendResult> {
    this.templateMessages.push({ to, tpl });
    return { ok: true, providerMessageId: "mock-tpl-" + this.templateMessages.length };
  }

  verifyWebhook(): WebhookVerification {
    return { ok: true, challengeResponse: "mock-challenge" };
  }

  async parseInboundMessage(): Promise<InboundMessage | null> {
    const msg = this.nextInbound;
    this.nextInbound = null;
    return msg;
  }
}
