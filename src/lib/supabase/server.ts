import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

/** Per-request client. Activate together with the Auth refresh proxy and verified memberships. */
export async function createSupabaseServerClient() {
  const config = getSupabaseConfig();
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values) {
        // The Auth proxy refreshes request/response cookies before Server Components.
        // Render-only clients cannot write; actions and route handlers still persist updates.
        try { values.forEach(({ name,value,options })=>store.set(name,value,options)); }
        catch(error){if(!(error instanceof Error)||!error.message.includes("Cookies can only be modified"))throw error;}
      },
    },
  });
}
