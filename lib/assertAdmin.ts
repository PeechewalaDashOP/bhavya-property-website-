import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export async function assertAdminFromRequest(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return false;

  const db = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data: { user } } = await db.auth.getUser(token);
  return user?.app_metadata?.role === "admin";
}
