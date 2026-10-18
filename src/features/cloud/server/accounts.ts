import { mayAssignSchoolRole } from "../../identity/domain/membership-context";
import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountIdentity } from "../../identity/models";
import { accountIdentitySchema } from "../../identity/schemas/identity.schema";
import { readCloudCanonical } from "./repository";
import {
  schoolRoles,
  personKindForRole,
} from "../../identity/domain/permissions";
function admin(actor: AccountIdentity) {
  if (!["admin", "principal"].includes(actor.role))
    throw new Error("School administrator required.");
}
export async function listCloudAccounts(actor: AccountIdentity) {
  admin(actor);
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("mis_memberships")
    .select("user_id,school_id,role,person_id,display_name,active")
    .eq("school_id", actor.schoolId);
  if (error) throw new Error("School accounts could not be read.");
  return Promise.all(
    (data ?? []).map(async (m) => {
      const {
        data: { user },
        error: failure,
      } = await client.auth.admin.getUserById(m.user_id);
      if (failure || !user)
        throw new Error("Account identity could not be read.");
      return {
        identity: accountIdentitySchema.parse({
          id: user.id,
          email: user.email,
          name: m.display_name,
          role: m.role,
          schoolId: m.school_id,
          personId: m.person_id,
        }),
        active: Boolean(m.active),
        version: 0,
      };
    }),
  );
}
export async function inviteCloudAccount(
  actor: AccountIdentity,
  email: string,
  name: string,
  role: string,
  personId: string | null = null,
) {
  admin(actor);
  if (
    !(schoolRoles as readonly string[]).includes(role) ||
    !mayAssignSchoolRole(actor.role, role as AccountIdentity["role"])
  )
    throw new Error("Choose an enabled school portal role.");
  const client = createSupabaseAdminClient();
  if (personId) {
    const root = await readCloudCanonical(actor), year = root.years.find(y => y.setup.calendar.year.id === root.activeYearId)!;
    const people = role === "parent" ? year.setup.guardians : role === "student" ? year.setup.students : [];
    if (year.locked || !people.some(p => p.id === personId)) throw new Error("Invitation person is outside the active school/year.");
    const { data: existing, error: lookupError } = await client.from("mis_memberships").select("user_id").eq("school_id", actor.schoolId).eq("role", role).eq("person_id", personId).limit(1);
    if (lookupError || existing?.length) throw new Error("This person already has a school account or pending invitation. Use the account register.");
  }
  const { data, error } = await client.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { name } },
  });
  if (error || !data.user || !data.properties.hashed_token)
    throw new Error(
      "Could not create this invitation. Check whether the account already exists.",
    );
  const { error: membershipError } = await client
    .from("mis_memberships")
    .insert({
      user_id: data.user.id,
      school_id: actor.schoolId,
      display_name: name,
      role,
      person_id: personId,
      active: false,
      invitation_pending: true,
    });
  if (membershipError)
    throw new Error(
      "Invitation membership could not be created. No school access was granted.",
    );
  return `/accept-invitation?token=${encodeURIComponent(data.properties.hashed_token)}`;
}
export async function toggleCloudAccount(actor: AccountIdentity, id: string) {
  admin(actor);
  if (id === actor.id)
    throw new Error("You cannot disable your own account here.");
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("mis_memberships")
    .select("active,role,invitation_pending")
    .eq("school_id", actor.schoolId)
    .eq("user_id", id)
    .maybeSingle();
  if (error || !data || !mayAssignSchoolRole(actor.role, data.role))
    throw new Error("Account is outside your permitted school roles.");
  if (data.invitation_pending) throw new Error("The recipient must accept their private invitation before this account can be activated.");
  const { error: failure } = await client
    .from("mis_memberships")
    .update({ active: !data.active, invitation_pending: false })
    .eq("school_id", actor.schoolId)
    .eq("user_id", id);
  if (failure)
    throw new Error(
      "Account could not be changed. Keep at least one active administrator.",
    );
}
export async function linkCloudAccount(
  actor: AccountIdentity,
  id: string,
  personId: string,
) {
  admin(actor);
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("mis_memberships")
    .select("role")
    .eq("school_id", actor.schoolId)
    .eq("user_id", id)
    .maybeSingle();
  if (error || !data || !personKindForRole(data.role))
    throw new Error("Account is outside your permitted person links.");
  const root = await readCloudCanonical(actor);
  const setup = root.years.find(
    (y) => y.setup.calendar.year.id === root.activeYearId,
  )!.setup;
  const collection =
    data.role === "parent"
      ? setup.guardians
      : data.role === "student"
        ? setup.students
        : setup.staff;
  if (!collection.some((p) => p.id === personId))
    throw new Error("Person does not belong to this school/year and role.");
  const { error: failure } = await client
    .from("mis_memberships")
    .update({ person_id: personId })
    .eq("school_id", actor.schoolId)
    .eq("user_id", id);
  if (failure) throw new Error("The person link could not be saved.");
}
export const cloudPasswordSchema = z.string().min(12).max(128);
