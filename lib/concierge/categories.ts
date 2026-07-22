import type { PropertyFull } from "@/lib/types";
import type { ObjectiveSource } from "./objectives/types";

export type DerivedObjective = {
  intent: "rent" | "sale";
  category: string;
  objectiveKey: string | null;
};

/* Property-attached enquiry: intent/category read straight off the
   property row. Discovery-mode enquiry (no property yet — student wants
   recommendations instead): defaults to a rent/student-accommodation
   starting point, the most common Prop100 enquiry; the AI's first turn
   in that mode asks what they're looking for, and once a property or a
   clearer category emerges the objective can be re-resolved. */
export function deriveObjective(
  property: PropertyFull | null,
  source: ObjectiveSource
): DerivedObjective {
  if (!property) {
    const def = source.resolve("rent", "Hostel");
    return { intent: "rent", category: "Hostel", objectiveKey: def?.key ?? null };
  }
  const intent = property.type;
  const category = property.ptype;
  const def = source.resolve(intent, category);
  return { intent, category, objectiveKey: def?.key ?? null };
}
