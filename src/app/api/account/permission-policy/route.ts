import {
  schoolActor,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mutationPolicySchema } from "@/features/identity/schemas/mutation-policy.schema";
import { mayAssignSchoolRole } from "@/features/identity/domain/membership-context";
export async function GET() {
  try {
    const actor = await schoolActor();
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("Administrator required.");
    const { data, error } = await createSupabaseAdminClient()
      .from("mis_role_restrictions")
      .select("role,blocked")
      .eq("school_id", actor.schoolId);
    if (error) throw new Error("Policies unavailable.");
    return privateJson({ policies: mutationPolicySchema.array().parse(data) });
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await schoolActor(),
      input = mutationPolicySchema.parse(await jsonBody(request));
    if (!mayAssignSchoolRole(actor.role, input.role))
      throw new Error("This role policy is outside your permission.");
    const { error } = await createSupabaseAdminClient()
      .from("mis_role_restrictions")
      .upsert(
        {
          school_id: actor.schoolId,
          role: input.role,
          blocked: input.blocked,
          updated_by: actor.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "school_id,role" },
      );
    if (error) throw new Error("Policy could not be saved.");
    return privateJson({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
