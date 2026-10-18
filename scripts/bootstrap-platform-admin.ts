/** Explicit production bootstrap; credentials are read only from ignored environment configuration. */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getSupabaseConfig } from "../src/lib/supabase/config.ts";
import { temporaryPasswordSchema } from "../src/features/admin/schemas/platform.schema.ts";
nextEnv.loadEnvConfig(process.cwd());
if (!process.argv.includes("--apply")) {
  console.log(
    "Configure PLATFORM_BOOTSTRAP_EMAIL, PLATFORM_BOOTSTRAP_NAME and PLATFORM_BOOTSTRAP_PASSWORD privately, then run this command with --apply. No existing account is modified.",
  );
  process.exit(0);
}
const input = z
  .object({
    email: z.email(),
    name: z.string().min(1).max(160),
    password: temporaryPasswordSchema,
    secret: z.string().min(32),
  })
  .safeParse({
    email: process.env.PLATFORM_BOOTSTRAP_EMAIL,
    name: process.env.PLATFORM_BOOTSTRAP_NAME,
    password: process.env.PLATFORM_BOOTSTRAP_PASSWORD,
    secret: process.env.SUPABASE_SERVER_SECRET_KEY,
  });
if (!input.success)
  throw new Error(
    "Configure valid platform bootstrap credentials and the server Supabase key in your private environment.",
  );
const v = input.data,
  c = getSupabaseConfig(),
  db = createClient(c.url, v.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const { count, error: lookup } = await db
  .from("mis_platform_operators")
  .select("user_id", { count: "exact", head: true });
if (lookup) throw new Error("Apply platform migrations first.");
if (count)
  throw new Error(
    "A platform operator already exists. Bootstrap does not add or replace operators.",
  );
const { data, error } = await db.auth.admin.createUser({
  email: v.email,
  password: v.password,
  email_confirm: true,
  user_metadata: { name: v.name },
  app_metadata: { platform_bootstrap: true },
});
let user = data.user;
if (error || !user) {
  for (let page = 1; page <= 100 && !user; page++) {
    const { data: users, error: e } = await db.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (e) throw new Error("Account lookup failed.");
    user =
      users.users.find(
        (u) =>
          u.email?.toLowerCase() === v.email.toLowerCase() &&
          u.app_metadata.platform_bootstrap === true,
      ) ?? null;
    if (users.users.length < 100) break;
  }
  if (!user)
    throw new Error(
      "Use a new administrator email. No existing user's password or role has changed.",
    );
}
const { error: activation } = await db
  .from("mis_account_activation")
  .upsert({ user_id: user.id, must_change_password: true });
if (activation)
  throw new Error("Activation setup failed; rerun bootstrap to recover.");
const { error: grant } = await db
  .from("mis_platform_operators")
  .insert({ user_id: user.id, display_name: v.name, active: true });
if (grant)
  throw new Error("Operator setup failed; rerun bootstrap to recover.");
console.log(
  "First platform administrator created. Sign in at /login/platform and set your own password. No email was sent. Remove the bootstrap password from your private environment afterward.",
);
