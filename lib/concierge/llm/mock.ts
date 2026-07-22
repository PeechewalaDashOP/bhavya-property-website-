/* Deterministic LLMProvider for tests — no network. Two modes:
     - default: asks about the first missing slot, extracts nothing,
       never "done". Enough to exercise the engine's state machine.
     - scripted: a queue of canned responses, consumed one per call, for
       tests that need specific extraction/done behaviour. */

import type { LLMProvider, LLMRequest, LLMResponse } from "./types";

export class MockLLMProvider implements LLMProvider {
  private queue: LLMResponse[] = [];
  public calls: LLMRequest[] = [];

  script(responses: LLMResponse[]) {
    this.queue.push(...responses);
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    this.calls.push(req);
    if (this.queue.length) return this.queue.shift()!;

    if (req.missingSlots.length === 0) {
      return { extractedSlots: {}, reply: "Got everything I need — connecting you shortly.", done: true };
    }
    const next = req.missingSlots[0];
    return {
      extractedSlots: {},
      reply: `Could you share your ${next.label.toLowerCase()}?`,
      done: false,
    };
  }
}
