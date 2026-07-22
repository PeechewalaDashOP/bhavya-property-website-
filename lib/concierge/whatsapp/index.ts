import type { WhatsAppProvider } from "./types";
import { MetaCloudWhatsAppProvider } from "./metaCloud";
import { MockWhatsAppProvider } from "./mock";

let cached: WhatsAppProvider | null = null;

/* Config-driven provider selection — this is the ONLY place in the
   codebase that decides which WhatsApp Business API/BSP backs the
   concierge. Everything else (engine.ts, app/api/whatsapp/webhook)
   depends only on the WhatsAppProvider interface. MSG91 (lib/msg91.ts)
   is unrelated — it stays OTP-only and is never touched by this. */
export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;

  const kind = process.env.WHATSAPP_PROVIDER || "meta_cloud";

  if (kind === "mock") {
    cached = new MockWhatsAppProvider();
    return cached;
  }

  if (kind === "meta_cloud") {
    const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    const verifyToken = process.env.META_WA_VERIFY_TOKEN;
    const appSecret = process.env.META_WA_APP_SECRET;
    if (!phoneNumberId || !accessToken || !verifyToken) {
      throw new Error("Meta Cloud API env vars are not fully configured");
    }
    cached = new MetaCloudWhatsAppProvider(
      phoneNumberId,
      accessToken,
      verifyToken,
      appSecret || ""
    );
    return cached;
  }

  throw new Error(`Unknown WHATSAPP_PROVIDER: ${kind}`);
}

/* Test-only: reset the cached singleton so a test can inject its own
   MockWhatsAppProvider instance and inspect its recorded sends. */
export function _resetWhatsAppProviderForTests() {
  cached = null;
}
