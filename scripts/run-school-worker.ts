/** Run independently of Next.js/browser. Persisted leases/retries survive process restarts. */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import {
  runJobBatch,
  queueDueReports,
} from "../src/features/jobs/server/processor.ts";
nextEnv.loadEnvConfig(process.cwd());
const key = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!key) throw new Error("Configure the server-only worker key.");
const client = createClient(getSupabaseConfig().url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(30000) }),
  },
});
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
let scannedAt = 0;
do {
  try {
    if (Date.now() - scannedAt > 60000) {
      await queueDueReports(client);
      scannedAt = Date.now();
    }
    const claimed = await runJobBatch(client);
    if (claimed)
      console.log(
        JSON.stringify({
          worker: "school",
          claimed,
          at: new Date().toISOString(),
        }),
      );
  } catch {
    console.error(
      "School worker could not process a batch; retrying without exposing credentials or payloads.",
    );
  }
  if (process.argv.includes("--once")) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
} while (!stopped);
