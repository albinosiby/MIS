"use server";
import { requireIdentity } from "../../identity/server/session";
import { assertMutationPermission } from "../../identity/domain/mutation-policy";
import { readCloudCanonical } from "../../cloud/server/repository";
import { inviteCloudAccount } from "../../cloud/server/accounts";
import { prepareAdmissionHandoff } from "../domain/completion";
export async function createAdmissionInvitation(_state: {
  error: string;
  link: string;
}, form: FormData) {
  try {
    if (process.env.MIS_BACKEND !== "supabase")
      throw new Error("Admission invitations require the connected school database.");
    const actor = await requireIdentity("/admissions/completion");
    assertMutationPermission(actor, "operations");
    assertMutationPermission(actor, "configuration");
    const root = await readCloudCanonical(actor), y = root.years.find(y => y.setup.calendar.year.id === root.activeYearId)!;
    const request = prepareAdmissionHandoff(y, actor, { applicationId: form.get("applicationId"), role: form.get("role"), personId: form.get("personId"), email: form.get("email"), authorityVerified: form.get("authorityVerified") === "on" });
    const link = await inviteCloudAccount(actor, request.email, request.name, request.role, request.personId);
    return { error: "", link };
  }
  catch (error) {
    return { error: error instanceof Error ? error.message : "Invitation could not be prepared.", link: "" };
  }
}
