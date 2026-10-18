import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
/** Privileged server repository only. Every caller must first verify Auth and school membership. */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVER_SECRET_KEY;
  if (!key)
    throw new Error(
      "The server-only Supabase repository credential is not configured.",
    );
  return createClient(getSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
