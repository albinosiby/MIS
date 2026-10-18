import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { admissionDecisionSchema, admissionHandoffSchema, continuationRequestSchema, withdrawalRequestSchema } from "../schemas/completion.schema.ts";
import { changeStudentLifecycle } from "../../students/domain/lifecycle.ts";
import { scope } from "../../workspace/domain/operations.ts";
function permit(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (y.locked || y.setup.school.id !== a.schoolId || !["admin", "principal"].includes(a.role))
    throw new Error("Admissions administrator required in an open school year.");
}
export function prepareAdmissionHandoff(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown) {
  permit(y, a);
  const data = admissionHandoffSchema.parse(input);
  const application = y.records.inquiries.find(i => i.id === data.applicationId && i.stage === "enrolled");
  if (!application?.studentId || !y.records.studentProfiles.some(p => p.studentId === application.studentId && p.status === "active"))
    throw new Error("Choose an active enrolled application.");
  if (data.role === "student") {
    const student = y.setup.students.find(s => s.id === application.studentId && s.id === data.personId);
    if (!student)
      throw new Error("Student must match this application.");
    return { ...data, name: student.displayName };
  }
  const guardian = y.setup.guardians.find(g => g.id === data.personId);
  if (!guardian || guardian.email.toLowerCase() !== data.email.toLowerCase() || !y.setup.relationships.some(r => r.guardianId === guardian.id && r.studentId === application.studentId && r.canViewRecords))
    throw new Error("Verify the linked guardian and their saved contact before invitation.");
  return { ...data, name: guardian.displayName };
}
export function confirmContinuation(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  permit(y, a);
  const data = continuationRequestSchema.parse(input);
  const student = y.setup.students.find(s => s.id === data.studentId);
  if (!student || !y.records.studentProfiles.some(p => p.studentId === student.id && p.status === "active"))
    throw new Error("Continuation requires an active student.");
  if (!y.setup.classes.some(c => c.id === data.targetClassId))
    throw new Error("Choose a class in this school/year.");
  if (data.decision === "retain" && student.classSectionId !== data.targetClassId)
    throw new Error("Retention must keep the current class.");
  if (data.decision === "promote" && student.classSectionId === data.targetClassId)
    throw new Error("Choose a different target class for promotion.");
  const old = y.records.promotions.find(p => p.studentId === student.id);
  if (old?.decision === data.decision && old.targetClassId === data.targetClassId)
    throw new Error("This continuation decision is already saved.");
  const existing = y.records.reenrolments.find(r => r.studentId === student.id);
  const decision = admissionDecisionSchema.parse({ id: crypto.randomUUID(), studentId: student.id, kind: data.decision, targetClassId: data.targetClassId, note: data.note, feeTreatment: null, affectedInvoiceIds: [], actorId: a.id, recordedAt: new Date().toISOString() });
  return { ...y, records: { ...y.records,
      promotions: [...y.records.promotions.filter(p => p.studentId !== student.id), { ...scope(y), id: old?.id ?? crypto.randomUUID(), ...data }],
      reenrolments: [...y.records.reenrolments.filter(r => r.studentId !== student.id), { ...scope(y), id: existing?.id ?? crypto.randomUUID(), studentId: student.id, intent: data.decision === "transfer" ? "withdraw" : "continue", note: data.note }],
    }, workflows: { ...y.workflows, admissionDecisions: [...y.workflows.admissionDecisions, decision] } };
}
export function withdrawAdmission(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown): SchoolYearWorkspace {
  permit(y, a);
  const data = withdrawalRequestSchema.parse(input);
  const pending = y.extensions.some(r => r.studentId === data.studentId && ((r.kind === "loans" && r.status === "issued") ||
    (r.kind === "hostel-allocations" && r.status === "active") ||
    (r.kind === "outpasses" && ["approved", "out"].includes(r.status)) ||
    (r.kind === "library-fines" && r.status === "outstanding")));
  if (pending)
    throw new Error("Return loans, close hostel/outpasses and settle fines before withdrawal.");
  const invoices = y.records.invoices.filter(i => i.studentId === data.studentId && i.status === "issued");
  if (data.feeTreatment === "void-uncollected" && invoices.some(i => y.records.payments.some(p => p.invoiceId === i.id && p.status === "completed" && p.amountMinor > (p.refundedMinor ?? 0))))
    throw new Error("Collected fees require a separately approved refund. Use retain balance until finance completes it.");
  const next = changeStudentLifecycle(y, a, { studentId: data.studentId, kind: "withdrawn", classSectionId: null, date: data.date, note: data.note });
  const affectedInvoiceIds = data.feeTreatment === "void-uncollected" ? invoices.map(i => i.id) : [];
  const decision = admissionDecisionSchema.parse({ id: crypto.randomUUID(), studentId: data.studentId, kind: "withdrawn", targetClassId: null, note: data.note, feeTreatment: data.feeTreatment, affectedInvoiceIds, actorId: a.id, recordedAt: new Date().toISOString() });
  return { ...next, records: { ...next.records,
      invoices: next.records.invoices.map(i => affectedInvoiceIds.includes(i.id) ? { ...i, status: "void" } : i),
      reenrolments: next.records.reenrolments.map(r => r.studentId === data.studentId ? { ...r, intent: "withdraw", note: data.note } : r),
    }, workflows: { ...next.workflows, admissionDecisions: [...next.workflows.admissionDecisions, decision] } };
}
