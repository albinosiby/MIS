/** Read-only readiness probe. Never creates accounts, queries school rows or applies SQL. */
import nextEnv from "@next/env";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
nextEnv.loadEnvConfig(process.cwd());
const config = getSupabaseConfig();
const results: {
  service: string;
  status: number;
  ok: boolean;
  detail?: string;
}[] = [];
for (const [service, path] of [
  ["Auth public settings", "/auth/v1/settings"],
  ["Anonymous workspace access denied", "/rest/v1/rpc/mis_read_workspace?p_school_id=school-greenfield"],
]) {
  try {
    const response = await fetch(new URL(path, config.url), {
      headers: { apikey: config.publishableKey },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    const content: unknown = response.ok
      ? null
      : await response.json().catch(() => null);
    const detail =
      content &&
      typeof content === "object" &&
      "message" in content &&
      typeof content.message === "string"
        ? content.message
            .replaceAll(config.publishableKey, "[redacted]")
            .slice(0, 300)
        : undefined;
    results.push({
      service,
      status: response.status,
      ok: service === "Anonymous workspace access denied" ? [401,403].includes(response.status) : response.ok,
      ...(detail ? { detail } : {}),
    });
    if (response.ok) await response.body?.cancel();
  } catch {
    results.push({ service, status: 0, ok: false });
  }
}
console.log(
  JSON.stringify(
    {
      project: new URL(config.url).hostname.split(".")[0],
      probes: results,
      note: "HTTP readiness is not proof that migrations, RLS, memberships or database workflows are configured.",
    },
    null,
    2,
  ),
);
if (results.some((row) => !row.ok)) process.exitCode = 1;
