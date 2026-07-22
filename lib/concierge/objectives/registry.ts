/* Typed objective registry — the source of truth for "what does the
   concierge need to collect for this kind of enquiry." One
   ObjectiveDefinition per (intent x category) bucket. Every budget/area
   slot below prefills from the property when the enquiry is attached to
   one (property.rent_per_month/price, property.loc) — the engine only
   asks about them when there's no property (discovery mode) or the
   student says they want alternatives, matching "never ask what we
   already know." Bhavya is the only editor of this file today; when that
   changes, swap staticObjectiveSource for a dbObjectiveSource that reads
   the same shape from a table — engine.ts does not change either way. */

import type { ObjectiveDefinition, ObjectiveSource, SlotState } from "./types";
import type { PropertyFull } from "@/lib/types";

function priceOf(p: PropertyFull | null): number | null {
  if (!p) return null;
  return p.rent_per_month ?? p.price ?? null;
}

const STUDENT_ACCOMMODATION: ObjectiveDefinition = {
  key: "student-accommodation",
  intent: "rent",
  categories: ["Hostel", "PG", "Room"],
  description:
    "Qualify a student's interest in a hostel/PG/room so Prop100 can introduce them to the owner.",
  slots: [
    {
      key: "move_in_date",
      label: "Move-in date",
      required: true,
      hint: "when the student needs to move in",
    },
    {
      key: "occupants",
      label: "Number of occupants",
      required: true,
      hint: "how many people this is for",
    },
    {
      key: "gender",
      label: "Gender",
      required: true,
      hint: "boys, girls, or co-ed — only needed if the property accepts any gender",
      prefillFrom: (p) => (p && p.gender_preference && p.gender_preference !== "any" ? p.gender_preference : null),
    },
    {
      key: "budget",
      label: "Monthly budget",
      required: true,
      prefillFrom: (p) => priceOf(p),
    },
    {
      key: "area",
      label: "Preferred area",
      required: true,
      prefillFrom: (p) => p?.loc ?? null,
    },
    {
      key: "specific_requirements",
      label: "Any specific requirements",
      required: false,
      hint: "food, AC, attached bathroom, etc — optional, don't push for this",
    },
  ],
  isComplete: (s: SlotState) => Boolean(s.move_in_date && s.occupants && s.gender && s.budget && s.area),
  needsHuman: (s: SlotState) => STUDENT_ACCOMMODATION.isComplete(s),
};

const RESIDENTIAL_RENT: ObjectiveDefinition = {
  key: "residential-rent",
  intent: "rent",
  categories: ["Flat", "House"],
  description:
    "Qualify a rental enquiry for a flat/house so Prop100 can introduce the student/family to the owner.",
  slots: [
    { key: "move_in_date", label: "Move-in date", required: true },
    { key: "occupants", label: "Number of occupants / family size", required: true },
    { key: "budget", label: "Monthly budget", required: true, prefillFrom: (p) => priceOf(p) },
    { key: "area", label: "Preferred area", required: true, prefillFrom: (p) => p?.loc ?? null },
    {
      key: "furnishing_preference",
      label: "Furnishing preference",
      required: false,
      prefillFrom: (p) => p?.furnishing_status ?? null,
    },
  ],
  isComplete: (s: SlotState) => Boolean(s.move_in_date && s.occupants && s.budget && s.area),
  needsHuman: (s: SlotState) => RESIDENTIAL_RENT.isComplete(s),
};

const RESIDENTIAL_BUY: ObjectiveDefinition = {
  key: "residential-buy",
  intent: "sale",
  categories: ["Flat", "House"],
  description:
    "Qualify a buyer's interest in a residential property so Prop100 can introduce them to the seller/dealer.",
  slots: [
    { key: "budget", label: "Budget", required: true, prefillFrom: (p) => priceOf(p) },
    { key: "area", label: "Preferred area", required: true, prefillFrom: (p) => p?.loc ?? null },
    {
      key: "purpose",
      label: "Purpose",
      required: true,
      hint: "self-use or investment",
    },
    { key: "timeline", label: "Purchase timeline", required: true },
    {
      key: "financing",
      label: "Financing needed",
      required: false,
      hint: "will they need a home loan",
    },
  ],
  isComplete: (s: SlotState) => Boolean(s.budget && s.area && s.purpose && s.timeline),
  needsHuman: (s: SlotState) => RESIDENTIAL_BUY.isComplete(s),
};

const COMMERCIAL: ObjectiveDefinition = {
  key: "commercial",
  intent: "rent",
  categories: ["Shop"],
  description:
    "Qualify a commercial-space enquiry (shop) so Prop100 can introduce the business owner to the property owner.",
  slots: [
    { key: "business_type", label: "Type of business", required: true },
    { key: "area", label: "Preferred area", required: true, prefillFrom: (p) => p?.loc ?? null },
    { key: "budget", label: "Monthly budget", required: true, prefillFrom: (p) => priceOf(p) },
    { key: "timeline", label: "When do they need it", required: true },
  ],
  isComplete: (s: SlotState) => Boolean(s.business_type && s.area && s.budget && s.timeline),
  needsHuman: (s: SlotState) => COMMERCIAL.isComplete(s),
};

const PLOT: ObjectiveDefinition = {
  key: "plot",
  intent: "sale",
  categories: ["Plot"],
  description: "Qualify a plot enquiry so Prop100 can introduce the buyer to the seller/dealer.",
  slots: [
    {
      key: "purpose",
      label: "Purpose",
      required: true,
      hint: "residential construction, commercial construction, or investment",
    },
    { key: "area", label: "Preferred area", required: true, prefillFrom: (p) => p?.loc ?? null },
    { key: "budget", label: "Budget", required: true, prefillFrom: (p) => priceOf(p) },
    { key: "timeline", label: "Purchase timeline", required: true },
  ],
  isComplete: (s: SlotState) => Boolean(s.purpose && s.area && s.budget && s.timeline),
  needsHuman: (s: SlotState) => PLOT.isComplete(s),
};

const ALL_OBJECTIVES: ObjectiveDefinition[] = [
  STUDENT_ACCOMMODATION,
  RESIDENTIAL_RENT,
  RESIDENTIAL_BUY,
  COMMERCIAL,
  PLOT,
];

class StaticObjectiveSource implements ObjectiveSource {
  resolve(intent: string, category: string): ObjectiveDefinition | null {
    return (
      ALL_OBJECTIVES.find((o) => o.intent === intent && o.categories.includes(category)) ?? null
    );
  }
  get(key: string): ObjectiveDefinition | null {
    return ALL_OBJECTIVES.find((o) => o.key === key) ?? null;
  }
}

export const staticObjectiveSource: ObjectiveSource = new StaticObjectiveSource();
