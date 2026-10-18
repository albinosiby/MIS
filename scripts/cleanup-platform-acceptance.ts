/** Remove only fixtures recorded by verify-platform-live.ts. Review generated SQL before executing. */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { z } from "zod";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
nextEnv.loadEnvConfig(process.cwd());
const fixture = z
  .object({
    runId: z.uuid(),
    operatorId: z.uuid(),
    operatorEmail: z.email(),
    schools: z.array(z.string().regex(/^school-[a-f0-9-]{36}$/)),
    users: z.array(z.uuid()),
  })
  .parse(JSON.parse(await readFile(".local/platform-e2e.json", "utf8")));
const c = getSupabaseConfig(),
  db = createClient(c.url, process.env.SUPABASE_SERVER_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const { data: user, error: e } = await db.auth.admin.getUserById(
  fixture.operatorId,
);
if (e || user.user?.app_metadata.isolated_acceptance !== fixture.runId)
  throw new Error("Fixture owner mismatch; cleanup refused.");
const { data: requests, error: r } = await db
  .from("mis_platform_requests")
  .select("id,school_id")
  .eq("actor_id", fixture.operatorId);
if (r) throw new Error("Cannot verify fixture requests.");
const requestIds = new Set([
  ...(requests ?? []).map((r) => r.id),
  ...fixture.schools.map((s) => s.slice(7)),
]);
const ids = new Set(fixture.users);
for (let page = 1; page <= 100; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Cannot verify created identities.");
  for (const u of data.users)
    if (requestIds.has(u.app_metadata.platform_request)) ids.add(u.id);
  if (data.users.length < 100) break;
}
const schools = fixture.schools.map((s) => `'${s}'`).join(","),
  users = [...ids].map((s) => `'${s}'`).join(",");
const sql = `begin;
-- Owner assertion occurs before transaction-local trigger suppression, never globally.
do $$ begin if not exists(select 1 from auth.users where id='${fixture.operatorId}' and raw_app_meta_data->>'isolated_acceptance'='${fixture.runId}') then raise exception 'Fixture owner mismatch';end if;end $$;
set local session_replication_role=replica;
do $$ declare t record;begin for t in select distinct c.table_schema,c.table_name from information_schema.columns c join information_schema.tables tbl on tbl.table_schema=c.table_schema and tbl.table_name=c.table_name where c.column_name='school_id' and c.table_schema in ('public','mis_private') and tbl.table_type='BASE TABLE' loop execute format('delete from %I.%I where school_id = any($1)',t.table_schema,t.table_name) using array[${schools}]::text[];end loop;end $$;
delete from public.mis_schools where id=any(array[${schools}]::text[]);
delete from public.mis_support_events where actor_id=any(array[${users}]::uuid[]);
delete from public.mis_document_events where actor_id=any(array[${users}]::uuid[]);
delete from public.mis_platform_audit_events where actor_id='${fixture.operatorId}';
delete from public.mis_platform_requests where actor_id='${fixture.operatorId}';
delete from public.mis_account_activation where user_id=any(array[${users}]::uuid[]);
delete from public.mis_revoked_sessions where user_id=any(array[${users}]::uuid[]);
delete from public.mis_platform_operators where user_id='${fixture.operatorId}';
commit;`;
if (process.argv.includes("--auth")) {
  const { data: op } = await db
    .from("mis_platform_operators")
    .select("user_id")
    .eq("user_id", fixture.operatorId)
    .maybeSingle();
  if (op) throw new Error("Execute the reviewed SQL before Auth cleanup.");
  for (const id of ids) {
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) throw new Error("Isolated Auth cleanup failed.");
  }
  const evidence = JSON.parse(
    await readFile("docs/platform-live-verification.json", "utf8"),
  );
  evidence.fixtureCleanup =
    "Completed; isolated accounts and institutions removed";
  await writeFile(
    "docs/platform-live-verification.json",
    JSON.stringify(evidence, null, 2),
  );
  await unlink(".local/platform-e2e.json");
  console.log(
    "Isolated Auth fixtures removed; credentials file deleted. Existing accounts untouched.",
  );
} else {
  const { data: files, error } = await db
    .from("mis_documents")
    .select("object_path")
    .in("school_id", fixture.schools);
  if (error) throw new Error("Cannot inspect isolated document objects.");
  if (files?.length) {
    const { error: remove } = await db.storage
      .from("mis-private-documents")
      .remove(files.map((f) => f.object_path));
    if (remove) throw new Error("Fixture object cleanup failed.");
  }
  const saved = JSON.parse(await readFile(".local/platform-e2e.json", "utf8"));
  saved.users = [...ids];
  await writeFile(".local/platform-e2e.json", JSON.stringify(saved), {
    mode: 0o600,
  });
  await writeFile(".local/platform-cleanup.sql", sql, { mode: 0o600 });
  console.log(
    "Generated .local/platform-cleanup.sql for this isolated run only. Execute with linked db query, then run this script --auth.",
  );
}
