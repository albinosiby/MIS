import type { SchoolYearWorkspace, WorkflowState } from "../models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { workflowStateSchema } from "../schemas/workflow-state.schema.ts";
import { scopedStudentIds } from "../../operations/domain/operations.ts";
/** Workflow state is canonical; this function returns a permitted screen projection. */
export function projectWorkflowState(
  year: SchoolYearWorkspace,
  actor: AccountIdentity,
): WorkflowState {
  if (actor.schoolId !== year.setup.school.id)
    throw new Error("School inaccessible.");
  if (["admin", "principal"].includes(actor.role))
    return workflowStateSchema.parse(year.workflows);
  const result = workflowStateSchema.parse({}),
    ids = scopedStudentIds(year, actor),
    hr = actor.role === "hr",
    finance = actor.role === "accountant";
  result.advanced = {
    ...year.workflows.advanced,
    customFields: year.workflows.advanced.customFields.filter((f) =>
      f.readRoles.includes(actor.role),
    ),
    approvalPolicies: [],
  };
  result.customValues = year.workflows.customValues
    .filter((v) =>
      v.entity === "staff"
        ? hr || v.ownerId === actor.personId
        : v.entity === "student"
          ? ids.includes(v.ownerId)
          : false,
    )
    .map((v) => ({
      ...v,
      values: Object.fromEntries(
        Object.entries(v.values).filter(([key]) =>
          result.advanced.customFields.some(
            (f) => f.entity === v.entity && f.key === key,
          ),
        ),
      ),
    }));
  result.approvals = year.workflows.approvals.filter(
    (r) =>
      r.requestedBy === actor.id ||
      (r.status === "pending" && r.roles[r.decisions.length] === actor.role),
  );
  if (finance) {
    result.bankStatements = year.workflows.bankStatements;
    result.ledger = year.workflows.ledger;
    result.feePlans = year.workflows.feePlans;
  } else if (["parent", "student"].includes(actor.role))
    result.feePlans = year.workflows.feePlans.filter((p) =>
      ids.includes(p.studentId),
    );
  result.salaryPlans = year.workflows.salaryPlans.filter(
    (p) => hr || p.staffId === actor.personId,
  );
  result.payrollRuns = year.workflows.payrollRuns
    .filter(
      (r) =>
        hr ||
        (r.status === "finalised" &&
          r.lines.some((l) => l.staffId === actor.personId)),
    )
    .map((r) =>
      hr
        ? r
        : { ...r, lines: r.lines.filter((l) => l.staffId === actor.personId) },
    );
  result.employmentEvents = year.workflows.employmentEvents.filter(
    (e) => hr || e.staffId === actor.personId,
  );
  result.payrollPolicy = hr
    ? year.workflows.payrollPolicy
    : {
        ...result.payrollPolicy,
        leaveTypes: year.workflows.payrollPolicy.leaveTypes,
      };
  result.publications = year.workflows.publications.filter((p) =>
    p.ownerType === "student"
      ? ["parent", "student", "teacher"].includes(actor.role) &&
        ids.includes(p.ownerId)
      : (p.ownerType === "staff" && (hr || p.ownerId === actor.personId)) ||
        (finance &&
          p.ownerType === "school" &&
          p.kind === "report" &&
          p.snapshot.source === "ledger"),
  );
  result.learningProgress=year.workflows.learningProgress.filter(p=>["parent","student","teacher"].includes(actor.role)&&ids.includes(p.studentId));
  result.resultReviews = year.workflows.resultReviews.filter(r => actor.role === "teacher" && r.requestedBy === actor.id);
  result.substitutionReviews = year.workflows.substitutionReviews.filter(r => actor.role === "teacher" && (r.requestedBy === actor.id || r.substitution.substituteStaffId === actor.personId));
  result.studentEvents = year.workflows.studentEvents.filter(
    (e) =>
      ["parent", "student", "teacher"].includes(actor.role) &&
      ids.includes(e.studentId),
  );
  return workflowStateSchema.parse(result);
}
