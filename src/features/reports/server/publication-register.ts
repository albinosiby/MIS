import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountIdentity } from "../../identity/models";
import type { Workspace } from "../../workspace/models";
import { canViewPublicationMetadata } from "../domain/publication-access";
import {
  publicationListRequestSchema,
  publicationListResponseSchema,
  publicationRevokeRequestSchema,
  publicationRevocationSchema,
} from "../schemas/publication-register.schema";
import { assertMutationPermission } from "../../identity/domain/mutation-policy";
export async function publicationRevocations(
  schoolId: string,
  yearId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_publication_revocations")
    .select("*")
    .eq("school_id", schoolId)
    .eq("academic_year_id", yearId)
    .in("publication_id", ids);
  if (error) throw new Error("Publication status unavailable.");
  return publicationRevocationSchema.array().parse(data);
}
export async function listPublishedDocuments(
  actor: AccountIdentity,
  root: Workspace,
  input: unknown,
) {
  const r = publicationListRequestSchema.parse(input),
    year = root.years.find((y) => y.setup.calendar.year.id === r.yearId);
  if (!year || year.setup.school.id !== actor.schoolId)
    throw new Error("Year unavailable.");
  const names = new Map(
    [...year.setup.students, ...year.setup.staff].map((p) => [
      p.id,
      p.displayName,
    ]),
  );
  const rows = year.workflows.publications
    .filter((p) => canViewPublicationMetadata(year, actor, p))
    .map(({ snapshot: _snapshot, issuedBy: _issuer, ...p }) => ({
      ...p,
      ownerName:
        p.ownerType === "school"
          ? year.setup.school.name
          : (names.get(p.ownerId) ?? "School record"),
    }))
    .filter((p) =>
      `${p.title} ${p.reference} ${p.ownerName}`
        .toLowerCase()
        .includes(r.search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.issuedAt.localeCompare(a.issuedAt) || b.id.localeCompare(a.id),
    );
  const page = rows.slice(r.offset, r.offset + 100),
    revocations = await publicationRevocations(
      actor.schoolId,
      r.yearId,
      page.map((p) => p.id),
    );
  return publicationListResponseSchema.parse({
    publications: page.map((p) => {
      const revoked = revocations.find((v) => v.publication_id === p.id);
      return revoked
        ? {
            ...p,
            revokedAt: new Date(revoked.revoked_at).toISOString(),
            revocationReason: revoked.reason,
          }
        : p;
    }),
    next: r.offset + 100 < rows.length ? r.offset + 100 : null,
  });
}
export async function revokePublishedDocument(
  actor: AccountIdentity,
  root: Workspace,
  id: string,
  input: unknown,
) {
  assertMutationPermission(actor, "publications");
  const r = publicationRevokeRequestSchema.parse(input),
    year = root.years.find((y) => y.setup.calendar.year.id === r.yearId),
    pub = year?.workflows.publications.find((p) => p.id === id);
  if (
    !year ||
    !pub ||
    year.setup.school.id !== actor.schoolId ||
    !["admin", "principal"].includes(actor.role)
  )
    throw new Error("Publication revocation is unavailable.");
  const { error } = await createSupabaseAdminClient().rpc(
    "mis_revoke_publication",
    {
      p_actor: actor.id,
      p_school: actor.schoolId,
      p_year: r.yearId,
      p_publication: id,
      p_reason: r.reason,
    },
  );
  if (error) throw new Error("Revocation could not be recorded.");
}
