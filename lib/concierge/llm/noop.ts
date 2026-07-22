/* No-op LLMProvider — the production default for Phase 1 launch. Returns
   nothing and extracts nothing; it exists so getLLMProvider() never
   silently reaches OpenRouter/Claude if something calls it directly.
   The primary automation gate is CONCIERGE_AI_ENABLED in engine.ts, which
   skips calling the LLM provider at all when AI is off — this class is
   the belt-and-suspenders second layer. Flipping to real AI later is
   CONCIERGE_AI_ENABLED=true + CONCIERGE_LLM_PROVIDER=openrouter; nothing
   else changes. */

import type { LLMProvider, LLMRequest, LLMResponse } from "./types";

export class NoopLLMProvider implements LLMProvider {
  async complete(_req: LLMRequest): Promise<LLMResponse> {
    return { extractedSlots: {}, reply: "", done: false };
  }
}
