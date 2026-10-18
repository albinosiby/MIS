/** Explicit synthetic Auth bootstrap. Uses an already configured server key; never retrieves one. */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import {
  testAccounts,
  TEST_ACCOUNT_PASSWORD,
} from "../src/features/identity/data/test-accounts.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
nextEnv.loadEnvConfig(process.cwd());
const config = getSupabaseConfig();
const key = process.env.SUPABASE_SERVER_SECRET_KEY;
if (!key)
  throw new Error(
    "Add SUPABASE_SERVER_SECRET_KEY to .env.local before bootstrap.",
  );
const client = createClient(config.url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const wanted = testAccounts.filter((a) =>
  ["admin", "teacher", "staff", "parent", "student"].includes(a.role),
);
if (!process.argv.includes("--apply")) {
  console.log(
    JSON.stringify({
      mode: "preview",
      accounts: wanted.map((a) => ({ role: a.role, email: a.email })),
      note: "Use --apply to create these synthetic Auth users and memberships.",
    }),
  );
  process.exit(0);
}
const { data: existing, error: listError } = await client.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw new Error("Auth users could not be inspected.");
let adminId = "";
for (const a of wanted) {
  let user = existing.users.find((u) => u.email === a.email);
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({
      email: a.email,
      password: TEST_ACCOUNT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: a.name },
    });
    if (error || !data.user)
      throw new Error(`Synthetic ${a.role} account could not be created.`);
    user = data.user;
  }
  const { data: membership, error: lookupError } = await client
    .from("mis_memberships")
    .select("school_id,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) throw new Error("Membership lookup failed.");
  if (
    membership &&
    (membership.school_id !== a.schoolId || membership.role !== a.role)
  )
    throw new Error(
      "An existing account has a different membership; it has not been overwritten.",
    );
  if (!membership) {
    const { error } = await client
      .from("mis_memberships")
      .insert({
        user_id: user.id,
        school_id: a.schoolId,
        role: a.role,
        person_id: a.personId,
        display_name: a.name,
        active: true,
      });
    if (error)
      throw new Error(`Synthetic ${a.role} membership could not be created.`);
  }
  if (a.role === "admin") adminId = user.id;
}
const { data: raw, error: readError } = await client.rpc("mis_read_workspace", {
  p_school_id: wanted[0].schoolId,
});
if (readError) throw new Error("Workspace read failed.");
const root = workspaceSchema.parse(raw);
const next = { ...root, revision: root.revision + 1 };
const { error: writeError } = await client.rpc("mis_commit_workspace", {
  p_school_id: wanted[0].schoolId,
  p_expected_revision: root.revision,
  p_document: next,
  p_actor_id: adminId,
  p_action: "Initialise synthetic school foundation indexes",
});
if (writeError)
  throw new Error(`Foundation mirror failed (${writeError.code}).`);
console.log(
  JSON.stringify({
    accounts: wanted.length,
    schoolId: wanted[0].schoolId,
    revision: next.revision,
    synthetic: true,
  }),
);
