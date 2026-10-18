/** Opt-in specialist HTTP boundary audit. Temporarily reuses one synthetic membership and restores it. */
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { writeFile, unlink } from "node:fs/promises";
import { deepStrictEqual } from "node:assert/strict";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { TEST_ACCOUNT_PASSWORD } from "../src/features/identity/data/test-accounts.ts";
import { roleHome } from "../src/features/identity/domain/access.ts";
import type { Role } from "../src/features/identity/models/index.ts";
nextEnv.loadEnvConfig(process.cwd());
if (!process.argv.includes("--apply") || process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true") throw new Error("Explicit --apply and synthetic test access required.");
const config = getSupabaseConfig();
if (config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co") throw new Error("Unexpected project.");
const secret = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!secret) throw new Error("Configured server key required.");
const bounded: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) });
const server = createClient(config.url, secret, { global: { fetch: bounded }, auth: { persistSession: false, autoRefreshToken: false } });
const cookies = new Map<string, string>();
const client: SupabaseClient = createServerClient(config.url, config.publishableKey, { global: { fetch: bounded }, cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => { for (const v of values) v.value ? cookies.set(v.name, v.value) : cookies.delete(v.name); } } });
const { data, error } = await client.auth.signInWithPassword({ email: "staff@greenfield.test", password: TEST_ACCOUNT_PASSWORD });
if (error || !data.user) throw new Error("Synthetic staff sign-in failed.");
const { data: original, error: lookup } = await server.from("mis_memberships").select("*").eq("user_id", data.user.id).single();
if (lookup || !original || original.role !== "staff" || original.school_id !== "school-greenfield" || !original.active) throw new Error("Expected synthetic staff membership; nothing changed.");
// Keep a local recovery snapshot until exact restoration is verified. No credentials are stored.
const recoveryPath = ".local/role-permission-test-membership.json";
await writeFile(recoveryPath, JSON.stringify(original, null, 2), { mode: 0o600, flag: "wx" });
const roles: Role[] = ["principal", "accountant", "librarian", "hr", "nurse", "counsellor", "transport", "driver", "inventory", "warden"];
const checks: { role: Role; permittedHome: boolean; forbiddenPage: boolean; privateFiles: boolean; academicFileBoundary: boolean }[] = [];
async function get(path: string) { return bounded(`http://127.0.0.1:3000${path}`, { redirect: "manual", headers: { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") } }); }
try {
  const { data: protectedFiles, error: fileError } = await server.from("mis_documents").select("id").eq("school_id", original.school_id).eq("category", "academic").eq("status", "ready").limit(1);
  if (fileError || !protectedFiles?.length) throw new Error("A ready academic verification file is required; membership is unchanged.");
  for (const role of roles) {
    const { error } = await server.from("mis_memberships").update({ role }).eq("user_id", original.user_id).eq("school_id", original.school_id);
    if (error) throw new Error(`Could not test ${role}.`);
    const home = await get(roleHome(role));
    const forbidden = await get(role === "principal" ? "/platform" : "/settings/users");
    const forbiddenBody = await forbidden.text();
    const streamedRedirect = forbidden.status === 200 && /NEXT_REDIRECT;replace;\/access-denied;(?:303|307|308);/.test(forbiddenBody);
    const files = await get("/api/documents?year=ay-2026-27");
    const download = await get(`/api/documents/${protectedFiles[0].id}`);
    await download.arrayBuffer();
    const row = { role, academicFileBoundary: download.status === (role === "principal" ? 200 : 403), permittedHome: home.status === 200, forbiddenPage: streamedRedirect || ([303, 307, 308].includes(forbidden.status) && forbidden.headers.get("location")?.endsWith("/access-denied") === true), privateFiles: files.status === 200 };
    checks.push(row);
    console.log(JSON.stringify({ ...row, forbiddenHttpStatus: forbidden.status, streamedRedirect }));
    if (!row.permittedHome || !row.forbiddenPage || !row.privateFiles || !row.academicFileBoundary) throw new Error(`Role boundary failed: ${role}.`);
  }
} finally {
  const { error: restoreError } = await server.from("mis_memberships").update({ role: original.role, person_id: original.person_id, active: original.active }).eq("user_id", original.user_id).eq("school_id", original.school_id);
  if (restoreError) throw new Error("CRITICAL: restore the synthetic staff membership before any further testing.");
  const { data: restored } = await server.from("mis_memberships").select("*").eq("user_id", original.user_id).single();
  deepStrictEqual(restored, original, "Membership restoration must match the saved record.");
  await unlink(recoveryPath);
  await client.auth.signOut({ scope: "local" });
}
await writeFile("docs/specialist-role-live-verification.json", JSON.stringify({ checkedAt: new Date().toISOString(), checks, membershipRestored: true, accountsCreated: 0, passwordsChanged: 0, limits: "HTTP home/access denial, permitted file list and academic binary download boundary; module business side effects have domain tests and remain subject to workflow completion." }, null, 2) + "\n");
