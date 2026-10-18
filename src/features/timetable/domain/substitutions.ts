import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import { substitutionDecisionSchema, substitutionRequestSchema, substitutionReviewSchema } from "../schemas/publication.schema.ts";
import { employedOn } from "../../hr/domain/employment-status.ts";
export function requestSubstitution(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  const data = substitutionRequestSchema.parse(input);
  const slot = y.records.slots.find(s => s.id === data.slotId && s.status === "published");
  if (y.locked || y.setup.school.id !== a.schoolId || !slot || (!["admin", "principal"].includes(a.role) && !(a.role === "teacher" && slot.staffId === a.personId)))
    throw new Error("Choose a published slot you are permitted to substitute.");
  if (!employedOn(y.workflows.employmentEvents, data.substituteStaffId, data.date))
    throw new Error("Substitute is not employed on this date.");
  if (y.workflows.substitutionReviews.some(r => r.substitution.slotId === data.slotId && r.substitution.date === data.date && ["submitted", "approved", "published"].includes(r.status)))
    throw new Error("A substitution review already exists for this slot/date.");
  const substitution = { id: crypto.randomUUID(), schoolId: a.schoolId, academicYearId: y.setup.calendar.year.id, ...data, absentStaffId: slot.staffId, status: "draft" as const };
  // Use the canonical contextual validator for teacher/room/date/leave collisions.
  schoolYearWorkspaceSchema.parse({ ...y, records: { ...y.records, substitutions: [...y.records.substitutions, substitution] } });
  const review = substitutionReviewSchema.parse({ id: crypto.randomUUID(), substitution, requestedBy: a.id, requestedAt: new Date().toISOString(), status: "submitted", decisions: [] });
  return { ...y, workflows: { ...y.workflows, substitutionReviews: [...y.workflows.substitutionReviews, review] } };
}
export function decideSubstitution(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  const data = substitutionDecisionSchema.parse(input);
  if (y.locked || y.setup.school.id !== a.schoolId || !["admin", "principal"].includes(a.role))
    throw new Error("Timetable reviewer required.");
  const review = y.workflows.substitutionReviews.find(r => r.id === data.id);
  if (!review)
    throw new Error("Substitution review unavailable.");
  const allowed = { submitted: ["approved", "rejected", "cancelled"], approved: ["published", "cancelled"], published: ["cancelled"], rejected: [], cancelled: [] };
  if (!(allowed[review.status] as string[]).includes(data.decision))
    throw new Error("Invalid or repeated substitution decision.");
  if (["approved", "rejected"].includes(data.decision) && review.requestedBy === a.id)
    throw new Error("A separate reviewer must decide this request.");
  let substitutions = y.records.substitutions;
  if (data.decision === "published") {
    const slot = y.records.slots.find(s => s.id === review.substitution.slotId && s.status === "published");
    if (!slot || slot.staffId !== review.substitution.absentStaffId)
      throw new Error("The slot changed. Cancel and request a new substitution.");
    if (!employedOn(y.workflows.employmentEvents, review.substitution.substituteStaffId, review.substitution.date))
      throw new Error("Substitute is no longer employed on this date.");
    substitutions = [...substitutions, { ...review.substitution, status: "published" }];
  }
  if (data.decision === "cancelled")
    substitutions = substitutions.filter(s => s.id !== review.substitution.id);
  return schoolYearWorkspaceSchema.parse({ ...y, records: { ...y.records, substitutions }, workflows: { ...y.workflows, substitutionReviews: y.workflows.substitutionReviews.map(r => r.id === review.id ? { ...r, status: data.decision, decisions: [...r.decisions, { actorId: a.id, at: new Date().toISOString(), decision: data.decision, note: data.note }] } : r) } });
}
