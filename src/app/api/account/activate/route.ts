import { z } from "zod";
import { currentCloudIdentity } from "@/features/cloud/server/identity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { temporaryPasswordSchema } from "@/features/admin/schemas/platform.schema";
import { jsonBody, privateJson, apiFailure } from "@/shared/server/request";
import { roleHome } from "@/features/identity/domain/access";
export async function POST(request: Request) {
  try {
    const actor = await currentCloudIdentity({ allowPasswordChange: true });
    if (!actor) throw new Error("Sign in first.");
    const input = z
      .strictObject({ password: temporaryPasswordSchema })
      .parse(await jsonBody(request));
    const db = createSupabaseAdminClient(),
      { data: gate, error } = await db
        .from("mis_account_activation")
        .select("must_change_password,updated_at")
        .eq("user_id", actor.id)
        .single();
    if (error || !gate?.must_change_password)
      throw new Error("Activation unavailable.");
    const client = await createSupabaseServerClient(),
      {
        data: { user },
      } = await client.auth.getUser();
    if (!user?.email) throw new Error("Sign in first.");
    // Supabase rejects reuse of the current password. Update through the recipient's own session.
    const { error: updateError } = await client.auth.updateUser({
      password: input.password,
    });
    if (updateError)
      throw new Error("Choose a different strong password and retry.");
    const { data: saved, error: saveError } = await db
      .from("mis_account_activation")
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", actor.id)
      .eq("updated_at", gate.updated_at)
      .select("user_id")
      .single();
    if (saveError || !saved)
      throw new Error("Activation changed. Sign in and retry.");
    return privateJson({
      href: actor.role === "admin" ? "/school-setup" : roleHome(actor.role),
    });
  } catch (e) {
    return apiFailure(e);
  }
}
