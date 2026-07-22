/* OpenRouter implementation of LLMProvider — default model is Claude
   Haiku, chosen for cheap/fast structured extraction, but this file is
   the ONLY place that knows that. Uses OpenRouter's OpenAI-compatible
   chat-completions endpoint so switching the underlying model later is a
   config change (CONCIERGE_LLM_MODEL), and switching away from OpenRouter
   entirely is a new file implementing LLMProvider, not a rewrite of the
   engine. */

import type { LLMProvider, LLMRequest, LLMResponse } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function buildSystemPrompt(req: LLMRequest): string {
  return `You are Prop100's concierge assistant, helping a student in Kota, Rajasthan find student housing or property over WhatsApp.

Conversation objective: ${req.objectiveDescription}

Property context (never invent details beyond this): ${req.propertySummary}

Already known (do NOT ask about these again): ${JSON.stringify(req.knownFacts)}

Still needed: ${req.missingSlots.map((s) => `${s.key} (${s.label}${s.hint ? " — " + s.hint : ""})`).join(", ") || "nothing — all required info is collected"}

RULES:
- Reply in the same language the student writes in (Hindi or English).
- Keep replies short and warm — this is WhatsApp, not an essay. 1-3 sentences.
- Ask for ONLY ONE missing item at a time, in natural conversational language — never a list of questions, never a form.
- Never re-ask something already in "Already known".
- Never invent property details, prices, or availability not given in the property context.
- If the student's message answers one or more missing items, extract them.
- Set "done": true only when every item in "Still needed" has been answered across the conversation so far.

Respond with raw JSON only (no markdown, no code fences):
{
  "extractedSlots": { "slotKey": "value" },
  "reply": "your next message to the student",
  "done": false
}`;
}

export class OpenRouterLLMProvider implements LLMProvider {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const messages = [
      { role: "system", content: buildSystemPrompt(req) },
      ...req.transcript.map((m) => ({
        role: m.role === "student" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://www.prop100.in",
        "X-Title": "Prop100 Concierge",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenRouter request failed: ${res.status} ${detail}`);
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    try {
      const parsed = JSON.parse(clean);
      return {
        extractedSlots: parsed.extractedSlots ?? {},
        reply: String(parsed.reply ?? "").trim() || "Could you tell me a bit more?",
        done: Boolean(parsed.done),
      };
    } catch {
      // Model didn't return valid JSON — fall back to treating the raw
      // text as the reply so the student still gets a response.
      return { extractedSlots: {}, reply: raw.trim() || "Could you tell me a bit more?", done: false };
    }
  }
}
