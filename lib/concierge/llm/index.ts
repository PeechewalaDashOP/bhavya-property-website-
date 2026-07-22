import type { LLMProvider } from "./types";
import { OpenRouterLLMProvider } from "./openrouter";
import { MockLLMProvider } from "./mock";
import { NoopLLMProvider } from "./noop";

let cached: LLMProvider | null = null;

/* Config-driven provider selection — this is the ONLY place in the
   codebase that decides which LLM vendor backs the concierge. Everything
   else (engine.ts, the webhook) calls getLLMProvider().complete() and
   never imports a vendor SDK directly.

   Default is "noop": Phase 1 launches with AI automation OFF (see
   CONCIERGE_AI_ENABLED in engine.ts) — the concierge is human-operated,
   AI-ready but not AI-automated. Switching on real automation later is
   CONCIERGE_LLM_PROVIDER=openrouter (+ CONCIERGE_AI_ENABLED=true), not a
   code change. */
export function getLLMProvider(): LLMProvider {
  if (cached) return cached;

  const kind = process.env.CONCIERGE_LLM_PROVIDER || "noop";

  if (kind === "noop") {
    cached = new NoopLLMProvider();
    return cached;
  }

  if (kind === "mock") {
    cached = new MockLLMProvider();
    return cached;
  }

  if (kind === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    const model = process.env.CONCIERGE_LLM_MODEL || "anthropic/claude-3.5-haiku";
    cached = new OpenRouterLLMProvider(apiKey, model);
    return cached;
  }

  throw new Error(`Unknown CONCIERGE_LLM_PROVIDER: ${kind}`);
}

/* Test-only: reset the cached singleton so a test can inject its own
   MockLLMProvider instance and inspect .calls. */
export function _resetLLMProviderForTests() {
  cached = null;
}
