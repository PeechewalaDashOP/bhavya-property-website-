/* Conversation Engine — owns enquiry state, property/objective context,
   and the AI on/off decision. Everything vendor-specific (which LLM,
   which WhatsApp API) is reached only through the provider abstractions
   in ./llm and ./whatsapp; this file never imports a vendor SDK.

   Phase 1 launch note: CONCIERGE_AI_ENABLED defaults to OFF. With AI off,
   every inbound message is stored and the enquiry is routed straight to
   'awaiting_human' — no LLM call, no auto-reply. The property/objective
   context is still resolved and slots still pre-filled either way, since
   the ops console (human agents) uses that same "already known" summary.
   Flipping CONCIERGE_AI_ENABLED=true later turns on the automated
   qualifying path below without touching this file's structure. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PropertyFull } from "@/lib/types";
import { staticObjectiveSource } from "./objectives/registry";
import type { SlotState } from "./objectives/types";
import { deriveObjective } from "./categories";
import { getLLMProvider } from "./llm";
import type { LLMRequest, ConvMsg } from "./llm/types";
import { isBusinessHours } from "./businessHours";

const WA_WINDOW_MS = 24 * 3600 * 1000;

function serviceDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function makeEnquiryRef(): string {
  return "PC-" + Math.floor(1000 + Math.random() * 9000);
}

export type ConciergeEnquiry = {
  id: number;
  reference_code: string;
  student_id: number;
  property_id: number | null;
  intent: string | null;
  category: string | null;
  objective_key: string | null;
  slot_state: SlotState;
  status: string;
  business_hours: boolean | null;
  wa_window_expires_at: string | null;
};

async function fetchPropertyFull(db: SupabaseClient, propertyId: number): Promise<PropertyFull | null> {
  const { data } = await db
    .from("properties")
    .select("*, property_units(*), dealers!dealer_id(id, name, role, years, rating)")
    .eq("id", propertyId)
    .maybeSingle();
  if (!data) return null;
  const units = Array.isArray((data as any).property_units)
    ? (data as any).property_units.sort(
        (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
      )
    : [];
  return { ...(data as object), property_units: units } as PropertyFull;
}

/* Called from /api/concierge/start when a logged-in student taps "Get
   help from Prop100" on a property. Not reachable from the webhook. */
export async function createEnquiry(input: {
  studentId: number;
  propertyId: number | null;
  sourceUrl: string | null;
}): Promise<ConciergeEnquiry> {
  const db = serviceDb();
  const property = input.propertyId ? await fetchPropertyFull(db, input.propertyId) : null;
  const derived = deriveObjective(property, staticObjectiveSource);

  const { data, error } = await db
    .from("concierge_enquiries")
    .insert({
      reference_code: makeEnquiryRef(),
      student_id: input.studentId,
      property_id: input.propertyId,
      intent: derived.intent,
      category: derived.category,
      objective_key: derived.objectiveKey,
      slot_state: {},
      status: "new",
      business_hours: isBusinessHours(),
      source_url: input.sourceUrl,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to create enquiry: ${error?.message}`);
  return data as ConciergeEnquiry;
}

/* Resolves which enquiry an inbound WhatsApp message belongs to: prefers
   a reference code (PC-XXXX) found in the message text (the wa.me deep
   link pre-fills this), falls back to the student's most recent open
   enquiry, and creates a fresh discovery enquiry (no property) if
   neither exists — a student can start a concierge conversation just by
   messaging Prop100 directly, not only via a property CTA. */
export async function resolveEnquiryForInbound(
  studentPhone: string,
  messageText: string
): Promise<ConciergeEnquiry> {
  const db = serviceDb();

  const { data: existingStudent } = await db
    .from("students")
    .select("id")
    .eq("phone", studentPhone)
    .maybeSingle();

  let studentId: number;
  if (existingStudent) {
    studentId = existingStudent.id;
    await db
      .from("students")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", studentId);
  } else {
    const { data: created, error } = await db
      .from("students")
      .insert({ phone: studentPhone, whatsapp_number: studentPhone })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Failed to create student: ${error?.message}`);
    studentId = created.id;
  }

  const refMatch = messageText.match(/PC-\d{4}/i);
  if (refMatch) {
    const { data: byRef } = await db
      .from("concierge_enquiries")
      .select("*")
      .eq("reference_code", refMatch[0].toUpperCase())
      .eq("student_id", studentId)
      .maybeSingle();
    if (byRef) return byRef as ConciergeEnquiry;
  }

  const { data: openEnquiry } = await db
    .from("concierge_enquiries")
    .select("*")
    .eq("student_id", studentId)
    .not("status", "in", "(closed,dead,connected)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (openEnquiry) return openEnquiry as ConciergeEnquiry;

  return createEnquiry({ studentId, propertyId: null, sourceUrl: null });
}

/* The core turn: persist the inbound message, refresh slot state from
   property context, and either (AI off, the launch default) route
   straight to human ops with no reply, or (AI on) ask the LLM provider
   for the next question/extraction and decide whether to hand over. */
export async function handleInbound(
  enquiry: ConciergeEnquiry,
  messageText: string
): Promise<{ reply: string | null }> {
  const db = serviceDb();
  const now = new Date().toISOString();
  const waWindowExpiry = new Date(Date.now() + WA_WINDOW_MS).toISOString();

  await db.from("concierge_messages").insert({
    enquiry_id: enquiry.id,
    direction: "inbound",
    sender: "student",
    body: messageText,
  });

  const property = enquiry.property_id ? await fetchPropertyFull(db, enquiry.property_id) : null;
  const objective = enquiry.objective_key ? staticObjectiveSource.get(enquiry.objective_key) : null;

  // Pre-fill from property context — runs whether AI is on or off, since
  // the ops console shows humans this same "already known" summary.
  const slotState: SlotState = { ...enquiry.slot_state };
  if (objective) {
    for (const slot of objective.slots) {
      if (slotState[slot.key] === undefined && slot.prefillFrom) {
        const val = slot.prefillFrom(property);
        if (val !== null && val !== undefined) slotState[slot.key] = val;
      }
    }
  }

  const aiEnabled = process.env.CONCIERGE_AI_ENABLED === "true";
  const alreadyAdvanced = ["human_active", "connected", "closed", "dead"].includes(enquiry.status);

  if (!aiEnabled) {
    await db
      .from("concierge_enquiries")
      .update({
        slot_state: slotState,
        status: alreadyAdvanced ? enquiry.status : "awaiting_human",
        wa_window_expires_at: waWindowExpiry,
        updated_at: now,
      })
      .eq("id", enquiry.id);
    return { reply: null };
  }

  // --- AI-automated path (off by default; CONCIERGE_AI_ENABLED=true) ---
  const missingSlots = objective
    ? objective.slots
        .filter((s) => s.required && slotState[s.key] === undefined)
        .filter((s) => !s.askWhen || s.askWhen(slotState))
        .map((s) => ({ key: s.key, label: s.label, hint: s.hint }))
    : [];

  const { data: recentMessages } = await db
    .from("concierge_messages")
    .select("direction, sender, body")
    .eq("enquiry_id", enquiry.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const transcript: ConvMsg[] = (recentMessages ?? [])
    .slice()
    .reverse()
    .map((m) => ({ role: m.sender === "student" ? "student" : "assistant", content: m.body as string }));

  const propertySummary = property
    ? `${property.title} — ${property.ptype} in ${property.loc}, ${
        property.type === "rent"
          ? `Rs.${property.rent_per_month ?? property.price}/mo`
          : `Rs.${property.price}`
      }`
    : "No specific property yet — student is exploring options.";

  const llmRes = await getLLMProvider().complete({
    objectiveKey: objective?.key ?? "discovery",
    objectiveDescription: objective?.description ?? "Understand what the student is looking for.",
    knownFacts: slotState,
    missingSlots,
    transcript,
    studentName: null,
    propertySummary,
  } satisfies LLMRequest);

  const mergedSlots: SlotState = { ...slotState, ...llmRes.extractedSlots };
  const complete = objective ? objective.isComplete(mergedSlots) : llmRes.done;
  const needsHuman = objective ? objective.needsHuman(mergedSlots) : complete;
  const nextStatus = alreadyAdvanced ? enquiry.status : needsHuman ? "awaiting_human" : "ai_qualifying";

  const updatePayload: Record<string, unknown> = {
    slot_state: mergedSlots,
    status: nextStatus,
    wa_window_expires_at: waWindowExpiry,
    updated_at: now,
    qualified_at: complete ? now : null,
  };
  if (enquiry.status === "new") updatePayload.first_ai_at = now;

  await db.from("concierge_enquiries").update(updatePayload).eq("id", enquiry.id);

  if (llmRes.reply) {
    await db.from("concierge_messages").insert({
      enquiry_id: enquiry.id,
      direction: "outbound",
      sender: "ai",
      body: llmRes.reply,
      slot_updates: llmRes.extractedSlots,
    });
  }

  return { reply: llmRes.reply || null };
}
