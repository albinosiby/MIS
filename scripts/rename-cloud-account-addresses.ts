/** Approved five-account email rename. Never creates users or changes passwords. */
import nextEnv from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deepStrictEqual } from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { TEST_ACCOUNT_PASSWORD } from "../src/features/identity/data/test-accounts.ts";

nextEnv.loadEnvConfig(process.cwd());
const config = getSupabaseConfig();
if (config.url !== "https://fxtlcapsytqyzsgcbcvp.supabase.co") throw new Error("Unexpected project.");
const key = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!key) throw new Error("Configured server key required.");
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) }) },
};
const server = createClient(config.url, key, options);
const roles = ["admin", "teacher", "staff", "parent", "student"];
const { data: memberships, error: membershipError } = await server.from("mis_memberships").select("*").eq("school_id", "school-greenfield").in("role", roles);
if (membershipError || !memberships || memberships.length !== 5) throw new Error("Expected exactly five school memberships.");
const plans = [];
for (const role of roles) {
  const matches = memberships.filter((row) => row.role === role);
  if (matches.length !== 1 || !matches[0].active) throw new Error(`Unexpected ${role} membership.`);
  const membership = matches[0];
  const { data, error } = await server.auth.admin.getUserById(membership.user_id);
  const oldEmail = `${role}@greenfield.demo`;
  const newEmail = `${role}@greenfield.test`;
  if (error || !data.user || ![oldEmail, newEmail].includes(data.user.email ?? "")) throw new Error(`Unexpected ${role} identity.`);
  plans.push({ role, id: data.user.id, oldEmail, newEmail, currentEmail: data.user.email, membership });
}
// Inspect all pages so a target collision cannot be missed.
for (let page = 1; ; page++) {
  const { data, error } = await server.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Could not check address collisions.");
  for (const plan of plans) if (data.users.some((user) => user.email?.toLowerCase() === plan.newEmail && user.id !== plan.id)) throw new Error(`Target ${plan.role} address already belongs to another user.`);
  if (data.users.length < 100) break;
}
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ mode: "preview", accounts: plans.map(({ role, currentEmail, newEmail }) => ({ role, currentEmail, newEmail })) }));
  process.exit(0);
}
const results = [];
for (const plan of plans) {
  if (plan.currentEmail !== plan.newEmail) {
    const { data, error } = await server.auth.admin.updateUserById(plan.id, { email: plan.newEmail, email_confirm: true });
    if (error || data.user?.id !== plan.id || data.user.email !== plan.newEmail) throw new Error(`Rename failed for ${plan.role}; ${results.length} accounts verified. Rerun safely after inspection.`);
  }
  const { data: user, error: userError } = await server.auth.admin.getUserById(plan.id);
  if (userError || user.user?.email !== plan.newEmail || !user.user.email_confirmed_at) throw new Error(`Readback failed for ${plan.role}.`);
  const { data: membership, error } = await server.from("mis_memberships").select("*").eq("user_id", plan.id).single();
  if (error) throw new Error("Membership readback failed.");
  deepStrictEqual(membership, plan.membership);
  const client: SupabaseClient = createClient(config.url, config.publishableKey, options);
  const { data: login, error: loginError } = await client.auth.signInWithPassword({ email: plan.newEmail, password: TEST_ACCOUNT_PASSWORD });
  if (loginError || login.user?.id !== plan.id) throw new Error(`Password login failed for ${plan.role}.`);
  const { data: own, error: ownError } = await client.from("mis_memberships").select("*");
  if (ownError || own?.length !== 1) throw new Error(`Membership access failed for ${plan.role}.`);
  deepStrictEqual(own[0], plan.membership);
  const { error: logoutError } = await client.auth.signOut({ scope: "local" });
  if (logoutError) throw new Error("Verification session cleanup failed.");
  results.push({ role: plan.role, email: plan.newEmail, identityUnchanged: true, membershipUnchanged: true, passwordLogin: true, ownMembershipRls: true });
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile("docs/account-address-verification.json", JSON.stringify({ checkedAt: new Date().toISOString(), project: "fxtlcapsytqyzsgcbcvp", accounts: results }, null, 2) + "\n");
