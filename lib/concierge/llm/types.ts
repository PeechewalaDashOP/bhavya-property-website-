/* LLM provider abstraction — the Conversation Engine talks ONLY to this
   interface, never to a specific vendor SDK. The backend (engine.ts) owns
   conversation state, property context, objectives, and business rules;
   the LLM's job is narrow: understand the student's message, extract
   whatever slot values it contains, and write the next natural reply.
   Swapping vendors (OpenRouter/Claude -> Gemini -> GPT -> a local model)
   means adding a new file here and changing CONCIERGE_LLM_PROVIDER — the
   engine never changes. */

export type ConvMsg = { role: "student" | "assistant"; content: string };

export type MissingSlot = {
  key: string;
  label: string;
  // Free-text hint for the model on what a valid answer looks like —
  // NOT a hardcoded question. The model phrases the question itself.
  hint?: string;
};

export type LLMRequest = {
  objectiveKey: string;
  objectiveDescription: string; // what this conversation is trying to accomplish
  knownFacts: Record<string, unknown>; // slots already filled (from property context or earlier turns)
  missingSlots: MissingSlot[]; // required slots still unfilled — engine computed this, not the model
  transcript: ConvMsg[]; // recent turns, oldest first
  studentName: string | null;
  propertySummary: string; // short grounding text: title, price, area, type — never invented by the model
};

export type LLMResponse = {
  extractedSlots: Record<string, unknown>; // only slots the model is confident it found in the latest message
  reply: string; // the next message to send the student
  done: boolean; // true if the model believes all required info is now collected
};

export interface LLMProvider {
  complete(req: LLMRequest): Promise<LLMResponse>;
}
