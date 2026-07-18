/* MSG91 WhatsApp Business API sender — the ONE place that knows their payload
   shape, so every template send (customer OTP, dealer lead alert, nudge cron,
   low-balance alert, contact delivery) stays consistent.

   MSG91's outbound-message endpoint uses THEIR abstraction over Meta's Cloud
   API: `to_and_components: [{ to: [...], components: { body_1, button_1 } }]`
   with components as a NAMED OBJECT — not Meta's raw components array. This
   exact shape is confirmed working against a real template (the OTP flow);
   the authoritative reference for any template is MSG91's dashboard →
   WhatsApp → Templates → <> "Code {JSON}" sample. Don't "correct" it from
   Meta docs.

   Failure shape is { status: "fail", hasError: true, errors: "..." } — an
   HTTP 200 can still carry an in-body failure, so both are checked. */

export type WhatsAppComponentValue =
  | { type: "text"; value: string }
  | { subtype: "url"; type: "text"; value: string };

export async function sendWhatsAppTemplate(opts: {
  to: string; // full number with country code, e.g. "91XXXXXXXXXX"
  templateName: string;
  components: Record<string, WhatsAppComponentValue>;
}): Promise<{ ok: boolean; detail?: string }> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const from = process.env.MSG91_WHATSAPP_NUMBER;
  const namespace = process.env.MSG91_WHATSAPP_NAMESPACE;
  if (!authKey || !from || !namespace) {
    return { ok: false, detail: "MSG91 WhatsApp env vars not configured" };
  }

  try {
    const res = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          integrated_number: from,
          content_type: "template",
          payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
              name: opts.templateName,
              language: { code: "en", policy: "deterministic" },
              namespace,
              to_and_components: [
                { to: [opts.to], components: opts.components },
              ],
            },
          },
        }),
      }
    );
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok || data?.status === "fail" || data?.hasError === true) {
      return { ok: false, detail: `HTTP ${res.status} — ${JSON.stringify(data)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: `fetch threw — ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
