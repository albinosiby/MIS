import "server-only";
import { z } from "zod";
import type { Workspace } from "../../workspace/models";
import type { AccountIdentity } from "../../identity/models";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { projectCloudWorkspace } from "../domain/projection";
import { identifierSchema } from "../../../shared/schemas/primitives";
/** Revoked bytes remain in immutable storage; no issued snapshot is sent to a client. */
export async function projectCloudForClient(
  root: Workspace,
  actor: AccountIdentity,
) {
  const denied = new Set<string>(),
    db = createSupabaseAdminClient();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from("mis_publication_revocations")
      .select("academic_year_id,publication_id")
      .eq("school_id", actor.schoolId)
      .order("academic_year_id")
      .order("publication_id")
      .range(offset, offset + 999);
    if (error) throw new Error("Publication access status unavailable.");
    const rows = z
      .array(
        z.object({
          academic_year_id: identifierSchema,
          publication_id: identifierSchema,
        }),
      )
      .parse(data);
    for (const row of rows)
      denied.add(`${row.academic_year_id}:${row.publication_id}`);
    if (rows.length < 1000) break;
  }
  return projectCloudWorkspace(
    {
      ...root,
      years: root.years.map((year) => ({
        ...year,
        workflows: {
          ...year.workflows,
          publications: year.workflows.publications.filter(
            (p) =>
              !p.revokedAt &&
              !denied.has(`${year.setup.calendar.year.id}:${p.id}`),
          ),
        },
      })),
    },
    actor,
  );
}
