/* Meta WhatsApp Cloud API implementation — the DEFAULT WhatsAppProvider.
   Chosen over a BSP (MSG91/Twilio/360dialog/etc) because it's direct Meta
   pricing with no reseller markup and gives first-class access to
   session messaging, templates, and webhooks. If Prop100 later prefers to
   route the concierge through a BSP instead, add a sibling file
   implementing WhatsAppProvider and flip WHATSAPP_PROVIDER — this file
   and the engine are otherwise untouched. */

import crypto from "crypto";
import type {
  WhatsAppProvider,
  SendResult,
  TemplateSpec,
  InboundMessage,
  WebhookVerification,
} from "./types";

const GRAPH_VERSION = "v20.0";

export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private verifyToken: string,
    private appSecret: string
  ) {}

  private async send(payload: Record<string, unknown>): Promise<SendResult> {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, detail: JSON.stringify(data) };
    }
    return { ok: true, providerMessageId: data?.messages?.[0]?.id };
  }

  async sendSessionMessage(to: string, body: string): Promise<SendResult> {
    return this.send({ to, type: "text", text: { body } });
  }

  async sendTemplateMessage(to: string, tpl: TemplateSpec): Promise<SendResult> {
    const components: Record<string, unknown>[] = [];
    if (tpl.variables && Object.keys(tpl.variables).length) {
      components.push({
        type: "body",
        parameters: Object.values(tpl.variables).map((v) => ({ type: "text", text: v })),
      });
    }
    for (const btn of tpl.buttons ?? []) {
      components.push({
        type: "button",
        sub_type: btn.type === "url" ? "url" : "quick_reply",
        index: String(components.length),
        parameters: [{ type: "text", text: btn.value }],
      });
    }
    return this.send({
      to,
      type: "template",
      template: {
        name: tpl.name,
        language: { code: tpl.languageCode },
        ...(components.length ? { components } : {}),
      },
    });
  }

  verifyWebhook(req: Request): WebhookVerification {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === this.verifyToken && challenge) {
      return { ok: true, challengeResponse: challenge };
    }
    return { ok: false };
  }

  async parseInboundMessage(req: Request): Promise<InboundMessage | null> {
    const rawBody = await req.text();

    const signature = req.headers.get("x-hub-signature-256") || "";
    if (this.appSecret) {
      const expected =
        "sha256=" + crypto.createHmac("sha256", this.appSecret).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      const valid =
        sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
      if (!valid) return null;
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return null;
    }

    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message || message.type !== "text") return null;

    return {
      from: String(message.from ?? "").replace(/\D/g, ""),
      text: String(message.text?.body ?? ""),
      providerMessageId: message.id,
      timestamp: Number(message.timestamp) * 1000,
      raw: body,
    };
  }
}
