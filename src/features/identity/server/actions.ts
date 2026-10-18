"use server";
import { mayUseSyntheticIdentity } from "../domain/test-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentCloudIdentity } from "../../cloud/server/identity";
import { redirect } from "next/navigation";
import { accountStore } from "../domain/account-store";
import { testAccounts, TEST_ACCOUNT_PASSWORD } from "../data/test-accounts";
import { loginSchema } from "../schemas/identity.schema";
import { startSession, endSession } from "./session";
import { roleHome } from "../domain/access";
export async function signIn(_previous: { error: string }, form: FormData) {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  if (
    !mayUseSyntheticIdentity(
      parsed.data.email,
      process.env.MIS_TEST_ACCOUNTS_ENABLED === "true",
    )
  )
    return { error: "Synthetic accounts are disabled in this environment." };
  if (process.env.MIS_BACKEND === "supabase") {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error)
      return {
        error:
          "The email or password is incorrect, or the account is unavailable.",
      };
    const actor = await currentCloudIdentity({
      allowMfaChallenge: true,
      allowPasswordChange: true,
    });
    if (!actor) {
      await client.auth.signOut();
      return {
        error:
          "An active school membership is required. Contact your administrator.",
      };
    }
    const { data: level, error: levelError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (levelError)
      return { error: "Sign-in verification is unavailable. Retry." };
    if (level.nextLevel === "aal2" && level.currentLevel !== "aal2")
      redirect("/mfa/challenge");
    const { data: activation, error: activationError } =
      await createSupabaseAdminClient()
        .from("mis_account_activation")
        .select("must_change_password")
        .eq("user_id", actor.id)
        .maybeSingle();
    if (activationError)
      return { error: "Account activation is unavailable. Retry." };
    if (activation?.must_change_password) redirect("/change-password");
    redirect(roleHome(actor.role));
  }
  const store = accountStore();
  let account;
  try {
    account = store.authenticate(parsed.data.email, parsed.data.password);
  } finally {
    store.close();
  }
  if (!account) return { error: "The email or password is incorrect." };
  await startSession(account.identity);
  redirect(roleHome(account.identity.role));
}
export async function signOut() {
  await endSession();
  redirect("/login");
}
