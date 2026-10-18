import { z } from "zod";
import {
  schoolContext,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { roleGrantRequestSchema } from "@/features/identity/schemas/membership-context.schema";
import { mayAssignSchoolRole } from "@/features/identity/domain/membership-context";
import {
  personKindForRole,
  schoolRoles,
} from "@/features/identity/domain/permissions";
export async function GET() {
  try {
    const { actor } = await schoolContext();
    if (!["admin", "principal"].includes(actor.role))
      throw new Error("Administrator required.");
    const { data, error } = await createSupabaseAdminClient()
      .from("mis_role_grants")
      .select("id,user_id,role,person_id,display_name,active")
      .eq("school_id", actor.schoolId)
      .order("display_name");
    if (error) throw new Error("Grants unavailable.");
    return privateJson({ grants: data });
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { actor, root } = await schoolContext(),
      input = roleGrantRequestSchema.parse(await jsonBody(request));
    if (
      !(schoolRoles as readonly string[]).includes(input.role) ||
      !mayAssignSchoolRole(actor.role, input.role)
    )
      throw new Error("Role assignment is not permitted.");
    const client = createSupabaseAdminClient(),
      { data: base, error } = await client
        .from("mis_memberships")
        .select("role,school_id,active,display_name")
        .eq("user_id", input.userId)
        .single();
    if (error || !base || !base.active)
      throw new Error("Choose an active existing account.");
    if (base.school_id === actor.schoolId && base.role === input.role)
      throw new Error("Manage the primary membership in the user register.");
    const year = root.years.find(
        (y) => y.setup.calendar.year.id === root.activeYearId,
      )!,
      kind = personKindForRole(input.role),
      collection =
        kind === "student"
          ? year.setup.students
          : kind === "guardian"
            ? year.setup.guardians
            : year.setup.staff;
    if (
      (kind &&
        (!input.personId ||
          !collection.some((p) => p.id === input.personId))) ||
      (!kind && input.personId !== null)
    )
      throw new Error(
        "Link a person of the required type in the active school.",
      );
    const { data: user, error: userError } =
      await client.auth.admin.getUserById(input.userId);
    if (userError || !user.user?.email_confirmed_at)
      throw new Error("Existing account must have a verified email.");
    const { error: failure } = await client
      .from("mis_role_grants")
      .upsert(
        {
          user_id: input.userId,
          school_id: actor.schoolId,
          role: input.role,
          person_id: input.personId,
          active: input.active,
          display_name: base.display_name,
          granted_by: actor.id,
        },
        { onConflict: "user_id,school_id,role" },
      );
    if (failure) throw new Error("Role assignment failed.");
    return privateJson({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
