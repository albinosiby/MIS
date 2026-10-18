/** Live HTTP + RLS verification using configured synthetic accounts. Never logs sessions or keys. */
import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFile, writeFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { TEST_ACCOUNT_PASSWORD, testAccounts } from "../src/features/identity/data/test-accounts.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import { projectCloudWorkspace } from "../src/features/cloud/domain/projection.ts";
import { accountIdentitySchema } from "../src/features/identity/schemas/identity.schema.ts";
import { schoolRoles } from "../src/features/identity/domain/permissions.ts";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.MIS_TEST_ACCOUNTS_ENABLED !== "true") throw new Error("Explicit synthetic test access required.");
const config = getSupabaseConfig();
if (config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co") throw new Error("Unexpected project.");
const secret = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!secret) throw new Error("Server key required.");
const base = "http://127.0.0.1:3000";
const bounded: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) });
const admin = createClient(config.url, secret, { global: { fetch: bounded }, auth: { persistSession: false, autoRefreshToken: false } });
const checks: { case: string; passed: boolean }[] = [];
function check(label: string, value: unknown): asserts value { checks.push({ case: label, passed: Boolean(value) }); if (!value) throw new Error(label); }
const clients = new Map<string, { client: SupabaseClient; cookies: Map<string, string>; id: string; personId: string | null }>();
async function call(role: string | null, path: string, init: RequestInit = {}) {
  const cookies = role ? clients.get(role)!.cookies : new Map<string, string>();
  return bounded(base + path, { ...init, redirect: "manual", headers: { Origin: base, Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; "), ...init.headers } });
}
try {
  const { data: raw, error } = await admin.rpc("mis_read_workspace", { p_school_id: "school-greenfield" });
  check("Read preserved canonical workspace", !error);
  const root = workspaceSchema.parse(raw);
  const y = root.years.find(y => y.setup.calendar.year.id === root.activeYearId)!;
  for (const role of schoolRoles) {
    const fixture = testAccounts.find(a => a.role === role)!;
    const view = projectCloudWorkspace(root, fixture);
    check(`Validated live-data projection: ${role}`, view.years.length === root.years.length);
  }
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    const cookies = new Map<string, string>();
    const client: SupabaseClient = createServerClient(config.url, config.publishableKey, { global: { fetch: bounded }, cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => { for (const value of values) value.value ? cookies.set(value.name, value.value) : cookies.delete(value.name); } } });
    const { data, error: failure } = await client.auth.signInWithPassword({ email: `${role}@greenfield.test`, password: TEST_ACCOUNT_PASSWORD });
    check(`Existing ${role} login`, !failure && data.user);
    const { data: membership, error: memberError } = await client.from("mis_memberships").select("*").single();
    check(`${role} own membership`, !memberError && membership?.role === role);
    clients.set(role, { client, cookies, id: data.user.id, personId: membership.person_id });
    const { error: direct } = await client.from("mis_documents").select("*");
    check(`${role} direct metadata denied`, direct);
    const { error: rpc } = await client.rpc("mis_begin_document", { p_actor: data.user.id, p_document: {} });
    check(`${role} direct lifecycle denied`, rpc);
    check(`${role} HTTP file list`, (await call(role, `/api/documents?year=${root.activeYearId}`)).status === 200);
  }
  const child = y.setup.relationships.find(l => l.guardianId === clients.get("parent")!.personId && l.canViewRecords)!.studentId;
  const bytes = new Uint8Array(await readFile("public/brand/school-mark.png"));
  const suffix = crypto.randomUUID().slice(0, 8);
  function form(replacesId?: string, ownerType = "student", ownerId = child, category = "academic", invalid = false) {
    const form = new FormData();
    form.set("yearId", root.activeYearId); form.set("ownerType", ownerType); form.set("ownerId", ownerId); form.set("category", category);
    form.set("file", invalid ? new File(["<html>bad</html>"], "not-a-pdf.pdf", { type: "application/pdf" }) : new File([bytes], `access-check-${suffix}.png`, { type: "image/png" }));
    if (replacesId) form.set("replacesId", replacesId); return form;
  }
  check("Signed-out list denied", (await call(null, `/api/documents?year=${root.activeYearId}`)).status === 401);
  check("Signed-out upload denied", (await call(null, "/api/documents", { method: "POST", body: form() })).status === 401);
  check("Invalid file bytes rejected", (await call("admin", "/api/documents", { method: "POST", body: form(undefined, "student", child, "academic", true) })).status === 403);
  check("Student cannot upload another staff employment file", (await call("student", "/api/documents", { method: "POST", body: form(undefined, "staff", y.setup.staff[0].id, "employment") })).status === 403);
  const upload = await call("admin", "/api/documents", { method: "POST", body: form() });
  check("Admin uploads private binary", upload.status === 201);
  const d = (await upload.json()).file;
  check("Upload response withholds storage path and actor", !d.object_path && !d.created_by && d.status === "ready");
  const downloaded = await call("parent", `/api/documents/${d.id}`);
  check("Permitted parent downloads persisted bytes", downloaded.status === 200 && Buffer.from(await downloaded.arrayBuffer()).equals(Buffer.from(bytes)));
  check("Downloads use attachment and no-store headers", downloaded.headers.get("content-disposition")?.startsWith("attachment;") && downloaded.headers.get("cache-control")?.includes("no-store"));
  check("Unrelated staff download denied", (await call("staff", `/api/documents/${d.id}`)).status === 403);
  const outsider = createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
  const { error: anonDownload } = await outsider.storage.from("mis-private-documents").download(`school-greenfield/${d.id}`);
  check("Anonymous direct Storage denied", anonDownload);
  const { error: authDownload } = await clients.get("parent")!.client.storage.from("mis-private-documents").download(`school-greenfield/${d.id}`);
  check("Authenticated direct Storage denied", authDownload);
  const { data: bucket } = await admin.storage.getBucket("mis-private-documents");
  check("Bucket is private and bounded", bucket && !bucket.public && Number(bucket.file_size_limit) === 5_000_000);
  check("Linked student cannot replace an administrator-authored file", (await call("student", "/api/documents", { method: "POST", body: form(d.id) })).status === 403);
  const replacement = await call("admin", "/api/documents", { method: "POST", body: form(d.id) });
  check("Version replacement upload", replacement.status === 201);
  const v2 = (await replacement.json()).file;
  check("Replacement increments immutable version", v2.version === 2 && v2.replaces_id === d.id);
  check("Superseded version download denied", (await call("parent", `/api/documents/${d.id}`)).status === 403);
  check("New version downloadable", (await call("parent", `/api/documents/${v2.id}`)).status === 200);
  check("Wrong-origin mutation denied", (await call("admin", `/api/documents/${v2.id}`, { method: "POST", headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke" }) })).status === 403);
  check("Unrelated staff revoke denied", (await call("staff", `/api/documents/${v2.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke" }) })).status === 403);
  check("Admin revoke", (await call("admin", `/api/documents/${v2.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke" }) })).status === 200);
  check("Revocation immediately blocks parent bytes", (await call("parent", `/api/documents/${v2.id}`)).status === 403);
  check("Retention prevents early purge", (await call("admin", `/api/documents/${v2.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purge" }) })).status === 403);
  async function pendingFile() {
    const { data, error } = await admin.rpc("mis_begin_document", { p_actor: clients.get("admin")!.id, p_document: { id: crypto.randomUUID(), school_id: "school-greenfield", academic_year_id: root.activeYearId, owner_type: "student", owner_id: child, category: "academic", filename: `interrupted-${suffix}.png`, mime_type: "image/png", byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), replaces_id: null } });
    check("Reserve interrupted upload", !error && data?.status === "uploading"); return data;
  }
  const pending = await pendingFile();
  check("Pending bytes cannot be downloaded", (await call("admin", `/api/documents/${pending.id}`)).status === 403);
  const { error: pendingUpload } = await admin.storage.from("mis-private-documents").upload(pending.object_path, bytes, { contentType: "image/png", upsert: false });
  check("Persist interrupted upload bytes", !pendingUpload);
  check("Other account cannot resume upload", (await call("parent", `/api/documents/${pending.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resume" }) })).status === 403);
  check("Uploader recovers interrupted upload", (await call("admin", `/api/documents/${pending.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resume" }) })).status === 200);
  check("Recovered bytes available to permitted parent", (await call("parent", `/api/documents/${pending.id}`)).status === 200);
  check("Recovered test file revoked", (await call("admin", `/api/documents/${pending.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke" }) })).status === 200);
  const abandoned = await pendingFile();
  check("Uploader cancels missing-content upload", (await call("admin", `/api/documents/${abandoned.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "discard" }) })).status === 200);
  check("Expired cancelled upload can be purged", (await call("admin", `/api/documents/${abandoned.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "purge" }) })).status === 200);
  check("Cancelled upload remains unavailable", (await call("admin", `/api/documents/${abandoned.id}`)).status === 403);
  const { data: events } = await admin.from("mis_document_events").select("event").in("document_id", [d.id, v2.id]);
  check("Upload/download/revoke audit persisted", ["upload", "ready", "download", "revoke"].every(name => events?.some(e => e.event === name)));
  await writeFile("docs/private-files-live-verification.json", JSON.stringify({ checkedAt: new Date().toISOString(), checks, accountsCreated: 0, passwordsChanged: 0, canonicalWorkspaceChanged: false, retainedVerificationFiles: [d.id, v2.id, pending.id], limit: "Five original cloud identities plus all-role domain projections. Specialist role HTTP checks are recorded separately; business workflow completion and deployment operations remain separate milestones." }, null, 2) + "\n");
  console.log(JSON.stringify({ passed: checks.length, failed: 0, report: "docs/private-files-live-verification.json" }));
} finally {
  for (const { client } of clients.values()) await client.auth.signOut({ scope: "local" });
}
