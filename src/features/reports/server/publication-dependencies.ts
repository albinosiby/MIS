import "server-only";
import { z } from "zod";
import type { Workspace } from "../../workspace/models";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { identifierSchema } from "../../../shared/schemas/primitives";
/** Revocation is detached from the immutable root, so recheck it at the final write boundary. */
export async function assertPublicationDependencies(
  previous: Workspace,
  next: Workspace,
  schoolId: string,
) {
  const references = new Set<string>();
  for (const year of next.years) {
    const original = previous.years.find(
      (y) => y.setup.calendar.year.id === year.setup.calendar.year.id,
    );
    for (const review of year.workflows.resultReviews) {
      const old = original?.workflows.resultReviews.find(r=>r.id===review.id);
      if (review.publicationId && (!old || (review.status === "approved" && old.status !== "approved"))) {
        const pub = year.workflows.publications.find(p=>p.id===review.publicationId);
        if (!pub) throw new Error("Review source result is unavailable.");
        references.add(pub.reference);
      }
    }
    for (const pub of year.workflows.publications.filter(
      (p) =>
        p.kind === "transcript" &&
        !original?.workflows.publications.some((old) => old.id === p.id),
    )) {
      const inputs = z
        .array(z.object({ reference: identifierSchema }))
        .min(1)
        .max(100)
        .parse(pub.snapshot.assessments);
      for (const input of inputs) references.add(input.reference);
    }
  }
  if (!references.size) return;
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_publication_revocations")
    .select("publication_id")
    .eq("school_id", schoolId)
    .in("reference", [...references])
    .limit(1);
  if (error) throw new Error("Publication source status unavailable.");
  if (data?.length)
    throw new Error(
      "A source result has been revoked. Issue corrected results before generating a transcript.",
    );
}
