import "server-only";
import { assertAdmissionDocuments } from "../../admissions/server/documents";
import { assertPublicationDependencies } from "../../reports/server/publication-dependencies";
import { applyCanonicalEffects } from "../../workspace/domain/record-integrity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema";
import type { Workspace } from "../../workspace/models";
import type { AccountIdentity } from "../../identity/models";
export async function readCloudCanonical(actor: AccountIdentity) {
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_read_workspace",
    { p_school_id: actor.schoolId },
  );
  if (error) throw new Error("The school database could not be read.");
  if (!data) throw new Error("School data has not been initialised.");
  const root = workspaceSchema.parse(data);
  if (root.years.some((y) => y.setup.school.id !== actor.schoolId))
    throw new Error("School scope mismatch.");
  return root;
}
export async function commitCloudCanonical(
  actor: AccountIdentity,
  previous: Workspace,
  next: Workspace,
  action: string,
) {
  const parsed = workspaceSchema.parse(
    applyCanonicalEffects(previous, workspaceSchema.parse(next), actor),
  );
  if (
    parsed.years.some((y) => y.setup.school.id !== actor.schoolId) ||
    parsed.revision !== previous.revision + 1
  )
    throw new Error("Invalid school/revision scope.");
  await assertAdmissionDocuments(previous, parsed, actor.schoolId);
  await assertPublicationDependencies(previous, parsed, actor.schoolId);
  const { error } = await createSupabaseAdminClient().rpc(
    "mis_commit_workspace",
    {
      p_school_id: actor.schoolId,
      p_expected_revision: previous.revision,
      p_document: parsed,
      p_actor_id: actor.id,
      p_action: action.slice(0, 300),
    },
  );
  if (error)
    throw new Error(
      ["40001", "PT409"].includes(error.code)
        ? "Workspace changed. Reload before saving."
        : "The school database rejected this save.",
    );
  return parsed;
}
