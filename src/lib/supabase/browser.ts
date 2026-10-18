"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

/** Ready for the cloud adapter; the workspace uses the server adapter for authenticated data. */
export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  return createBrowserClient(config.url, config.publishableKey);
}
