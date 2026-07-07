import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnabled = Boolean(url && publishable);

// Publishable-key client — safe to use in browser and server components for
// reads. Lead writes go through /api/leads (service role, server only).
export const supabase = supabaseEnabled
  ? createClient(url as string, publishable as string)
  : null;
