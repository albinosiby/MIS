import { carryOpeningLedger } from "./rollover-ledger.ts";
import type { Workspace } from "../../workspace/models/index.ts";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import { rolloverRequestSchema } from "../schemas/settings.schema.ts";
import { workflowStateSchema } from "../../workspace/schemas/workflow-state.schema.ts";
import { carryOperationalMasters } from "./rollover-masters.ts";
import { employedOn } from "../../hr/domain/employment-status.ts";
import { balance } from "../../workspace/domain/operations.ts";
export function rolloverBlockers(root: Workspace) {
  const y = root.years.find(
    (y) => y.setup.calendar.year.id === root.activeYearId,
  )!;
  const issues: string[] = [];
  if (y.locked) issues.push("This academic year is already archived.");
  if (y.setup.completed.length !== 8)
    issues.push("Complete all eight school setup steps.");
  if (y.setup.exceptions.length)
    issues.push(`Resolve ${y.setup.exceptions.length} ingestion exceptions.`);
  if (
    y.records.approvals.some((a) => a.status === "pending") ||
    y.records.leaves.some((l) => l.status === "pending")
  )
    issues.push("Review all pending administrative and leave requests.");
  if (y.records.exams.some((e) => e.status !== "completed"))
    issues.push("Complete and lock every exam cycle.");
  const active = y.setup.students.filter(
    (s) =>
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ),
  );
  if (
    active.some((s) => !y.records.promotions.some((p) => p.studentId === s.id))
  )
    issues.push(
      "Configure promotion or retention directives for every active student.",
    );
  if (y.workflows.approvals.some((a) => a.status === "pending"))
    issues.push("Resolve pending configurable approvals.");
  if (y.workflows.resultReviews.some(r=>r.status==="submitted")) issues.push("Decide pending result corrections before rollover.");
  if (y.workflows.substitutionReviews.some(r=>["submitted","approved"].includes(r.status))) issues.push("Publish or cancel pending substitution reviews before rollover.");
  if (y.records.reenrolments.some(r=>r.intent==="withdraw" && y.records.studentProfiles.some(p=>p.studentId===r.studentId&&p.status==="active") && !y.records.promotions.some(p=>p.studentId===r.studentId&&p.decision==="transfer"))) issues.push("Confirm a year-end transfer directive for withdrawing students.");
  if (y.workflows.payrollRuns.some((run) => run.status !== "finalised"))
    issues.push("Finalise outstanding payroll runs.");
  const unfinished = y.extensions.filter(
    (row) =>
      (row.kind === "loans" && row.status === "issued") ||
      (row.kind === "hostel-allocations" && row.status === "active") ||
      (row.kind === "outpasses" && ["approved", "out"].includes(row.status)) ||
      (row.kind === "purchase-orders" &&
        ["submitted", "approved"].includes(row.status)) ||
      (row.kind === "library-fines" && row.status === "outstanding"),
  );
  if (unfinished.length)
    issues.push(
      `Close or settle ${unfinished.length} open library, hostel and purchasing records before rollover.`,
    );
  return issues;
}
export function rolloverYear(root: Workspace, input: unknown) {
  const request = rolloverRequestSchema.parse(input),
    blockers = rolloverBlockers(root);
  if (blockers.length) throw new Error(blockers.join(" "));
  const result = structuredClone(root),
    source = result.years.find(
      (y) => y.setup.calendar.year.id === root.activeYearId,
    )!;
  if (request.startDate <= source.setup.calendar.year.endDate)
    throw new Error(
      "The new academic year must start after the current year ends.",
    );
  if (
    result.years.some(
      (y) =>
        y.setup.calendar.year.startDate === request.startDate ||
        y.setup.calendar.year.name === request.name,
    )
  )
    throw new Error("That academic year already exists.");
  const yearId = `ay-${request.startDate.slice(0, 4)}-${request.endDate.slice(0, 4)}`,
    setup = structuredClone(source.setup),
    delta =
      Number(request.startDate.slice(0, 4)) -
      Number(setup.calendar.year.startDate.slice(0, 4));
  const shift = (iso: string) => {
    const year = Number(iso.slice(0, 4)) + delta,
      month = Number(iso.slice(5, 7)),
      day = Number(iso.slice(-2)),
      max = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, max)).padStart(2, "0")}`;
  };
  setup.calendar = {
    year: {
      id: yearId,
      schoolId: setup.school.id,
      name: request.name,
      startDate: request.startDate,
      endDate: request.endDate,
    },
    terms: setup.calendar.terms.map((term, i) => ({
      ...term,
      id: `${yearId}-term-${i + 1}`,
      academicYearId: yearId,
      startDate: shift(term.startDate),
      endDate: shift(term.endDate),
    })),
  };
  setup.classes = setup.classes.map((c) => ({ ...c, academicYearId: yearId }));
  setup.students = setup.students.map((student) => {
    const directive = source.records.promotions.find(
      (p) => p.studentId === student.id,
    );
    return {
      ...student,
      academicYearId: yearId,
      classSectionId:
        directive && directive.decision !== "transfer"
          ? directive.targetClassId
          : student.classSectionId,
    };
  });
  setup.completed = [];
  setup.exceptions = [];
  setup.reviews = [];
  setup.notifications = [];
  setup.audit = [];
  setup.portal = {
    ...setup.portal,
    invitationsPrepared: false,
    acknowledgeSimulation: false,
  };
  // Start from the actual school structure, never from fixture records.
  const next = {
    setup,
    records: structuredClone(source.records),
    extensions: carryOperationalMasters(source, yearId, request.startDate),
    locked: false,
    workflows: workflowStateSchema.parse({
      ledger: carryOpeningLedger(source, request.startDate),
      counters: { "ledger-initialised": 1 },
      websiteReleases: structuredClone(source.workflows.websiteReleases),
      activeWebsiteReleaseId: source.workflows.activeWebsiteReleaseId,
      advanced: structuredClone(source.workflows.advanced),
      payrollPolicy: structuredClone(source.workflows.payrollPolicy),
      salaryPlans: source.workflows.salaryPlans.filter(
        (p) =>
          !source.workflows.salaryPlans.some(
            (other) =>
              other.staffId === p.staffId &&
              other.effectiveFrom > p.effectiveFrom &&
              other.effectiveFrom <= request.startDate,
          ),
      ),
      employmentEvents: source.setup.staff
        .filter(
          (staff) =>
            !employedOn(
              source.workflows.employmentEvents,
              staff.id,
              request.startDate,
            ),
        )
        .map((staff) => ({
          id: crypto.randomUUID(),
          staffId: staff.id,
          kind: "exited",
          date: request.startDate,
          note: "Inactive employment carried from the previous academic year.",
          actorId: "year-rollover",
        })),
      customValues: source.workflows.customValues.filter(
        (v) => v.entity !== "admission",
      ),
      reportBuilders: structuredClone(source.workflows.reportBuilders),
    }),
  };
  const records = structuredClone(source.records);
  next.records = {
    ...next.records,
    subjects: records.subjects,
    rooms: records.rooms,
    routes: records.routes,
    roles: records.roles,
    staffProfiles: records.staffProfiles,
    studentProfiles: records.studentProfiles.map((p) =>
      source.records.promotions.some(
        (d) => d.studentId === p.studentId && d.decision === "transfer",
      )
        ? { ...p, status: "transferred" }
        : p,
    ),
    admissionForms: records.admissionForms,
    units: records.units.map((u) => ({ ...u, completedPeriods: 0 })),
    preferences: records.preferences,
    slots: records.slots.map((s) => ({ ...s, status: "draft" })),
    inquiries: [],
    reenrolments: setup.students.map((s) => ({
      id: crypto.randomUUID(),
      schoolId: setup.school.id,
      academicYearId: yearId,
      studentId: s.id,
      intent: "pending",
      note: "",
    })),
    attendance: [],
    leaves: [],
    substitutions: [],
    lessons: [],
    homework: [],
    submissions: [],
    exams: [],
    papers: [],
    marks: [],
    invoices: source.records.invoices
      .filter((i) => i.status === "issued" && balance(source, i.id) > 0)
      .map((i, index) => ({
        id: crypto.randomUUID(),
        schoolId: setup.school.id,
        academicYearId: yearId,
        studentId: i.studentId,
        reference: `OPEN-${yearId}-${index + 1}`,
        period: `Opening balance · ${source.setup.calendar.year.name}`.slice(
          0,
          80,
        ),
        issuedOn: request.startDate,
        dueDate: request.startDate,
        lines: [
          {
            id: "carry-forward",
            name: `Balance from ${i.reference}`,
            amountMinor: balance(source, i.id),
          },
        ],
        concessionMinor: 0,
        status: "issued",
      })),
    payments: [],
    events: [],
    notices: [],
    notifications: [],
    exports: [],
    reportSchedules: [],
    approvals: [],
    promotions: [],
    certificates: [],
    reservations: [],
  };
  for (const [key, value] of Object.entries(next.records)) {
    if (Array.isArray(value))
      Object.assign(next.records, {
        [key]: value.map((record) => ({ ...record, academicYearId: yearId })),
      });
  }
  source.locked = true;
  result.years.push(next);
  result.activeYearId = yearId;
  return workspaceSchema.parse(result);
}
