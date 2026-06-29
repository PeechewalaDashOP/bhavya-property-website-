import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && anon);

// A single anon client works for both server (read) and browser (read + insert
// leads). RLS policies in supabase/schema.sql keep it safe.
export const supabase = supabaseEnabled ? createClient(url as string, anon as string) : null;
