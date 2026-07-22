/* Conversation-objective abstraction. The engine depends only on
   ObjectiveSource — it never knows whether objectives come from a typed
   TS registry (today) or a database table (later). Adding/editing an
   objective in registry.ts never touches engine.ts; moving objectives to
   a DB means writing a dbObjectiveSource that implements this same
   interface, again without touching engine.ts. */

import type { PropertyFull } from "@/lib/types";

export type SlotState = Record<string, unknown>;

export type SlotDef = {
  key: string;
  label: string; // human label, also shown to the LLM
  required: boolean;
  hint?: string; // guidance for the LLM on what a valid value looks like

  /* Derive this slot's value from property context, if the enquiry is
     attached to a property. Return null/undefined when not derivable —
     e.g. a discovery-mode enquiry (no property) or a field the property
     leaves ambiguous (gender_preference: 'any'). A slot whose
     prefillFrom returns a value is considered known and the engine never
     asks about it. */
  prefillFrom?: (property: PropertyFull | null) => unknown | null | undefined;

  /* Whether this slot is even relevant given what's known so far.
     Defaults to true. Lets an objective skip a question conditionally —
     e.g. only ask "which gender" if the property's preference is 'any'. */
  askWhen?: (state: SlotState) => boolean;

  validate?: (value: unknown) => boolean;
};

export type ObjectiveDefinition = {
  key: string;
  intent: "rent" | "sale";
  categories: string[]; // properties.ptype values this objective governs, e.g. ["Hostel","PG","Room"]
  description: string; // grounds the LLM on what this conversation is trying to accomplish
  slots: SlotDef[];
  isComplete: (state: SlotState) => boolean;
  needsHuman: (state: SlotState) => boolean;
};

export interface ObjectiveSource {
  resolve(intent: string, category: string): ObjectiveDefinition | null;
  get(key: string): ObjectiveDefinition | null;
}
