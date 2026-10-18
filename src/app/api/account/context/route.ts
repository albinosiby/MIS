import { cookies } from "next/headers";
import { currentIdentity } from "@/features/identity/server/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  contextSelectionSchema,
  membershipContextSchema,
} from "@/features/identity/schemas/membership-context.schema";
import { apiFailure, jsonBody, privateJson } from "@/shared/server/request";
import { roleHome } from "@/features/identity/domain/access";
async function ownedContexts() {
  const actor = await currentIdentity();
  if (!actor || process.env.MIS_BACKEND !== "supabase")
    throw new Error("Sign in required.");
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_effective_memberships")
    .select("*")
    .eq("user_id", actor.id)
    .eq("active", true);
  if (error) throw new Error("Memberships unavailable.");
  return { actor, rows: membershipContextSchema.array().parse(data) };
}
export async function GET() {
  try {
    const { actor, rows } = await ownedContexts(),
      ids = [...new Set(rows.map((r) => r.school_id))],
      { data: schools, error } = await createSupabaseAdminClient()
        .from("mis_schools")
        .select("id,name")
        .in("id", ids);
    if (error) throw new Error("Schools unavailable.");
    return privateJson({
      contexts: rows.map((r) => ({
        id: r.membership_id,
        schoolId: r.school_id,
        schoolName:
          schools?.find((s) => s.id === r.school_id)?.name ?? r.school_id,
        role: r.role,
        personId: r.person_id,
        current:
          r.school_id === actor.schoolId &&
          r.role === actor.role &&
          r.person_id === actor.personId,
      })),
    });
  } catch (error) {
    return apiFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = contextSelectionSchema.parse(await jsonBody(request)),
      { rows } = await ownedContexts(),
      selected = rows.find((r) => r.membership_id === input.membershipId);
    if (!selected) throw new Error("Membership unavailable.");
    (await cookies()).set("mis-school-context", selected.membership_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.LOCAL_HTTPS === "true",
      path: "/",
      maxAge: 8 * 60 * 60,
    });
    return privateJson({ href: roleHome(selected.role) });
  } catch (error) {
    return apiFailure(error);
  }
}
