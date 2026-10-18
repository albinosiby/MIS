import "server-only";
import { currentCloudIdentity } from "../../cloud/server/identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertPlatformOperator } from "../domain/policy";
export async function platformActor() {
  if (process.env.MIS_BACKEND !== "supabase")
    throw new Error("Connected database required.");
  const actor = await currentCloudIdentity();
  if (!actor || actor.role !== "platform")
    throw new Error("Platform administrator required.");
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_platform_operators")
    .select("active")
    .eq("user_id", actor.id)
    .maybeSingle();
  assertPlatformOperator(!error && data?.active === true);
  return actor;
}
