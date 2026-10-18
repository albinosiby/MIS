/** Explicit validated import of the user's exported dummy workspace; never reads browser internals. */
import nextEnv from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import type { ModuleRecords } from "../src/features/workspace/models/index.ts";
nextEnv.loadEnvConfig(process.cwd());
const file = process.argv[2];
if (!file) throw new Error("Provide the exported workspace JSON path.");
const source = workspaceSchema.parse(JSON.parse(readFileSync(file, "utf8")));
const key = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!key) throw new Error("Configure the server key locally first.");
const client = createClient(getSupabaseConfig().url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const schoolId = source.years[0].setup.school.id;
const { data: raw, error } = await client.rpc("mis_read_workspace", {
  p_school_id: schoolId,
});
if (error || !raw)
  throw new Error("The destination school could not be verified.");
const remote = workspaceSchema.parse(raw);
const years = source.years.map((local) => {
  const previous = remote.years.find(
    (y) => y.setup.calendar.year.id === local.setup.calendar.year.id,
  );
  if (!previous) return local;
  if (previous.locked && JSON.stringify(previous) !== JSON.stringify(local))
    throw new Error(
      "An archived destination year differs; it has not been overwritten.",
    );
  const records = { ...local.records };
  for (const name of Object.keys(records) as (keyof ModuleRecords)[]) {
    const rows = records[name];
    if (!Array.isArray(rows)) continue;
    const ids = new Set(rows.map((r) => r.id));
    (records as Record<string, unknown>)[name] = [
      ...rows,
      ...(previous.records[name] as { id: string }[]).filter(
        (r) => !ids.has(r.id),
      ),
    ];
  }
  const ids = new Set(local.extensions.map((r) => r.id));
  return {
    ...local,
    records,
    extensions: [
      ...local.extensions,
      ...previous.extensions.filter((r) => !ids.has(r.id)),
    ],
  };
});
const next = workspaceSchema.parse({
  ...source,
  revision: remote.revision + 1,
  years: [
    ...years,
    ...remote.years.filter(
      (y) =>
        !years.some(
          (v) => v.setup.calendar.year.id === y.setup.calendar.year.id,
        ),
    ),
  ],
});
const { data: members } = await client
  .from("mis_memberships")
  .select("user_id")
  .eq("school_id", schoolId)
  .eq("role", "admin")
  .eq("active", true)
  .limit(1);
if (!members?.[0])
  throw new Error("An active destination administrator is required.");
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      mode: "preview",
      students: next.years[0].setup.students.length,
      completedSteps: next.years[0].setup.completed.length,
      expectedRevision: remote.revision,
    }),
  );
  process.exit(0);
}
writeFileSync(
  "/tmp/mis-cloud-before-browser-import.json",
  JSON.stringify(remote),
  { mode: 0o600 },
);
const { error: failure } = await client.rpc("mis_commit_workspace", {
  p_school_id: schoolId,
  p_expected_revision: remote.revision,
  p_document: next,
  p_actor_id: members[0].user_id,
  p_action:
    "Import validated existing browser dummy workspace; retain additional cloud audit records",
});
if (failure) throw new Error(`The import was not committed (${failure.code}).`);
console.log(
  JSON.stringify({
    imported: true,
    students: next.years[0].setup.students.length,
    completedSteps: next.years[0].setup.completed.length,
    revision: next.revision,
    sourceFilePreserved: true,
  }),
);
