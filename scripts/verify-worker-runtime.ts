/** Verify an independent worker consumes a disabled synthetic schedule without publishing or notifying. */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
nextEnv.loadEnvConfig(process.cwd());
const config = getSupabaseConfig(),
  secret = process.env.SUPABASE_SERVER_SECRET_KEY;
if (
  !secret ||
  process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true" ||
  config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co"
)
  throw new Error("Synthetic verification project required.");
const client = createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  checks: { case: string; passed: boolean }[] = [];
function check(label: string, value: unknown): asserts value {
  checks.push({ case: label, passed: Boolean(value) });
  if (!value) throw new Error(label);
}
try {
  const { data: raw, error } = await client.rpc("mis_read_workspace", {
    p_school_id: "school-greenfield",
  });
  check("Read preserved school workspace", !error);
  const root = workspaceSchema.parse(raw),
    year = root.years.find(
      (y) => y.setup.calendar.year.id === root.activeYearId,
    )!,
    schedule = year.workflows.reportSchedules.find((s) => !s.enabled);
  check("Existing synthetic schedule is disabled", schedule);
  const id = crypto.randomUUID(),
    { error: queued } = await client
      .from("mis_jobs")
      .insert({
        id,
        school_id: year.setup.school.id,
        kind: "report-export",
        payload: {
          yearId: root.activeYearId,
          scheduleId: schedule.id,
          date: new Date().toISOString().slice(0, 10),
        },
        dedupe_key: `worker-runtime:${id}`,
        created_by: schedule.createdBy,
      });
  check("Queue an isolated disabled-schedule check", !queued);
  let status = "";
  for (let attempt = 0; attempt < 15; attempt++) {
    const { data, error } = await client
      .from("mis_jobs")
      .select("status")
      .eq("id", id)
      .single();
    if (error) throw new Error("Worker verification unavailable.");
    status = data.status;
    if (status === "cancelled") break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  check(
    "Independent worker cancels the disabled schedule without a browser",
    status === "cancelled",
  );
  const { data: attempts, error: attemptError } = await client
    .from("mis_job_attempts")
    .select("outcome")
    .eq("job_id", id);
  check(
    "Worker decision has a persisted attempt audit",
    !attemptError &&
      attempts?.some((attempt) => attempt.outcome === "cancelled"),
  );
  const { data: after } = await client.rpc("mis_read_workspace", {
    p_school_id: "school-greenfield",
  });
  check(
    "No publication or school revision is changed",
    workspaceSchema.parse(after).revision === root.revision,
  );
} finally {
  await writeFile(
    "docs/worker-runtime-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        passed: checks.filter((c) => c.passed).length,
        total: checks.length,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: checks.filter((c) => c.passed).length,
      total: checks.length,
    }),
  );
}
