import { z } from "zod";
import type { Workspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import { appendAudit } from "../../school-setup/domain/setup-workflow.ts";
/** Compatibility write boundary until feature-specific admin commands replace whole-workspace updates. */
export function prepareWorkspaceReplacement(
  previous: Workspace,
  actor: AccountIdentity,
  input: unknown,
  expectedRevision: number,
  actionInput: unknown,
) {
  if (!["admin", "principal"].includes(actor.role))
    throw new Error("School administrator required.");
  if (actor.blockedMutations?.length)
    throw new Error(
      "Use a permitted feature action; whole-workspace edits are unavailable for restricted roles.",
    );
  const action = z.string().trim().min(1).max(300).parse(actionInput);
  if (previous.revision !== expectedRevision)
    throw new Error("Workspace changed. Reload before saving.");
  const next = workspaceSchema.parse(input);
  if (
    [...previous.years, ...next.years].some(
      (y) => y.setup.school.id !== actor.schoolId,
    )
  )
    throw new Error("School scope mismatch.");
  if (next.revision !== previous.revision + 1)
    throw new Error("Invalid revision.");
  for (const year of next.years) {
    const original = previous.years.find(
      (saved) => saved.setup.calendar.year.id === year.setup.calendar.year.id,
    );
    if (original) {
      // Issued snapshots are read-only. Revoked snapshots may be absent from the client projection.
      if (
        year.workflows.publications.some(
          (pub) =>
            !original.workflows.publications.some(
              (saved) => JSON.stringify(saved) === JSON.stringify(pub),
            ),
        )
      )
        throw new Error(
          "Use publication actions to issue or change documents.",
        );
      year.workflows.publications = original.workflows.publications;
    }
  }
  // Iterate the saved archives, not only submitted years: omission is also a mutation.
  for (const archived of previous.years.filter((y) => y.locked)) {
    const submitted = next.years.find(
      (y) => y.setup.calendar.year.id === archived.setup.calendar.year.id,
    );
    if (!submitted || JSON.stringify(submitted) !== JSON.stringify(archived))
      throw new Error("Archived years cannot be removed or changed.");
  }
  if (
    next.years.length !== previous.years.length ||
    next.years.some(
      (year) =>
        !previous.years.some(
          (old) =>
            old.setup.calendar.year.id === year.setup.calendar.year.id &&
            old.locked === year.locked,
        ),
    )
  )
    throw new Error(
      "Use the academic-year rollover action to create or archive years.",
    );
  for (const year of next.years) {
    const original = previous.years.find(
      (y) => y.setup.calendar.year.id === year.setup.calendar.year.id,
    );
    if (
      original &&
      JSON.stringify(year.records.inquiries) !==
        JSON.stringify(original.records.inquiries)
    )
      throw new Error("Use admission actions to edit applications.");
    if (
      original &&
      JSON.stringify(year.extensions) !== JSON.stringify(original.extensions)
    )
      throw new Error(
        "Use permitted operational commands to change operational records.",
      );
    if (original && JSON.stringify(year.records.substitutions)!==JSON.stringify(original.records.substitutions)) throw new Error("Use substitution review actions to change allotments.");
    if (original && year.records.slots.some(slot => slot.status === "published" && !original.records.slots.some(saved => JSON.stringify(saved)===JSON.stringify(slot)))) throw new Error("Save timetable changes as drafts and publish a version from Timetable versions.");
    if (
      original &&
      JSON.stringify(year.workflows) !== JSON.stringify(original.workflows)
    )
      throw new Error(
        "Use a permitted workflow command to change workflow settings or posted records.",
      );
    year.setup.audit = original?.setup.audit ?? [];
    if (!year.locked)
      year.setup = appendAudit(year.setup, action, {
        accountId: actor.id,
        displayName: actor.name,
        role: actor.role,
      });
  }
  return workspaceSchema.parse(next);
}
