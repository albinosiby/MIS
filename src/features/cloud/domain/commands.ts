import { saveInquiry } from "../../admissions/domain/save-inquiry.ts";
import {
  progressInquiry,
  enrolStudent,
} from "../../workspace/domain/operations.ts";
import { rolloverYear } from "../../settings/domain/rollover.ts";
import {
  assertMutationPermission,
  commandCapability,
} from "../../identity/domain/mutation-policy.ts";
import { applyWorkflowCommand } from "../../workspace/domain/workflow-commands.ts";
import {
  isSchoolRole,
  mayManageBilling,
  mayManageEmployment,
} from "../../identity/domain/permissions.ts";
import { generateInvoices } from "../../fees/domain/generate-invoices.ts";
import { saveRegister } from "../../attendance/domain/save-register.ts";
import {
  takePayment,
  putRecord,
  decideLeave,
  balance,
  scope,
} from "../../workspace/domain/operations.ts";
import type { Workspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { cloudMutationSchema } from "../schemas/cloud.schema.ts";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import {
  requestPortalLeave,
  submitPortalHomework,
  savePortalAttendance,
  gradePortalSubmission,
  savePortalMark,
  acknowledgePortalNotice,
  createTeacherWork,
  submitTeacherLesson,
} from "../../portals/domain/portal-operations.ts";
import {
  saveOperation,
  respondOperation,
  renewLoan,
} from "../../operations/domain/operations.ts";
import { appendAudit } from "../../school-setup/domain/setup-workflow.ts";
export function applyCloudCommand(
  root: Workspace,
  actor: AccountIdentity,
  input: unknown,
): Workspace {
  if (!isSchoolRole(actor.role)) throw new Error("School membership required.");
  const request = cloudMutationSchema.parse(input);
  if (root.years[0].setup.school.id !== actor.schoolId)
    throw new Error("School is inaccessible.");
  if (root.revision !== request.expectedRevision)
    throw new Error("Workspace changed. Reload before saving.");
  const index = root.years.findIndex(
    (y) => y.setup.calendar.year.id === request.yearId,
  );
  if (index < 0 || root.years[index].locked)
    throw new Error("Academic year is inaccessible or archived.");
  let y = root.years[index];
  const c = request.command;
  assertMutationPermission(actor, commandCapability(c));
  if (c.type.startsWith("billing-") && !mayManageBilling(actor.role))
    throw new Error("Billing permission required.");
  if (
    [
      "hr-register",
      "hr-leave",
      "staff-profile",
      "staff-identity",
      "staff-onboard",
      "staff-leave-create",
    ].includes(c.type) &&
    !mayManageEmployment(actor.role)
  )
    throw new Error("Employment permission required.");
  if (c.type === "year-rollover") {
    if (
      !["admin", "principal"].includes(actor.role) ||
      request.yearId !== root.activeYearId
    )
      throw new Error(
        "An administrator must roll over the active academic year.",
      );
    const next = rolloverYear(root, c.input);
    next.revision = root.revision + 1;
    const target = next.years.find(
      (year) => year.setup.calendar.year.id === next.activeYearId,
    )!;
    target.setup = appendAudit(
      target.setup,
      "Created academic year from approved rollover",
      { accountId: actor.id, displayName: actor.name, role: actor.role },
    );
    return workspaceSchema.parse(next);
  }
  if (
    ["admission-save", "admission-progress", "student-enrol"].includes(
      c.type,
    ) &&
    !["admin", "principal"].includes(actor.role)
  )
    throw new Error("Admissions administrator required.");
  switch (c.type) {
    case "admission-save":
      y = saveInquiry(y, c.input);
      break;
    case "admission-progress":
      y = progressInquiry(y, c.input.id, c.input.stage);
      break;
    case "student-enrol":
      y = enrolStudent(y, c.input);
      break;
    case "workflow":
      y = applyWorkflowCommand(y, actor, c.input);
      break;
    case "billing-concession": {
      const invoice = y.records.invoices.find(
        (i) => i.id === c.input.targetId && i.status === "issued",
      );
      if (
        !actor.personId ||
        !y.setup.staff.some((s) => s.id === actor.personId) ||
        !invoice ||
        c.input.category !== "concession" ||
        c.input.status !== "pending" ||
        c.input.amountMinor <= 0 ||
        c.input.amountMinor > balance(y, invoice.id)
      )
        throw new Error(
          "Choose an outstanding invoice and a valid concession; link your staff account first.",
        );
      y = putRecord(y, "approvals", {
        ...c.input,
        ...scope(y),
        id: crypto.randomUUID(),
        requesterId: actor.personId,
        decisionNote: "",
      });
      break;
    }
    case "staff-leave-create": {
      const leave = c.input;
      if (
        leave.personType !== "staff" ||
        leave.status !== "pending" ||
        leave.decisionNote ||
        !y.setup.staff.some((s) => s.id === leave.personId) ||
        leave.dates.startDate < y.setup.calendar.year.startDate ||
        leave.dates.endDate > y.setup.calendar.year.endDate
      )
        throw new Error(
          "Choose a staff member and dates in the academic year.",
        );
      y = putRecord(y, "leaves", {
        ...leave,
        ...scope(y),
        id: crypto.randomUUID(),
      });
      break;
    }
    case "billing-generate":
      y = generateInvoices(y, c.input);
      break;
    case "billing-collect":
      if (c.input.status !== "completed")
        throw new Error("New collections must be completed entries.");
      if (
        y.records.payments.some(
          (p) =>
            p.id === c.input.id && p.idempotencyKey !== c.input.idempotencyKey,
        )
      )
        throw new Error("Receipt ID already exists.");
      y = takePayment(y, c.input);
      break;
    case "billing-reverse": {
      const payment = y.records.payments.find((p) => p.id === c.id);
      if (!payment || payment.status !== "completed")
        throw new Error("Only a completed collection can be reversed.");
      y = putRecord(y, "payments", {
        ...payment,
        status: "reversed",
        note: c.note,
      });
      break;
    }
    case "billing-remind": {
      const invoices = y.records.invoices.filter(
        (i) =>
          c.ids.includes(i.id) && i.status === "issued" && balance(y, i.id) > 0,
      );
      if (!invoices.length) throw new Error("Select outstanding invoices.");
      const ids = invoices.map((i) => i.studentId);
      const recipients = [
        ...new Set(
          y.setup.relationships
            .filter((l) => ids.includes(l.studentId) && l.canReceiveNotices)
            .map((l) => l.guardianId),
        ),
      ];
      if (!recipients.length)
        throw new Error("No permitted guardian recipients found.");
      y = putRecord(y, "notices", {
        ...scope(y),
        id: crypto.randomUUID(),
        title: "Fee payment reminder",
        body: `Please review the outstanding school fee ledger.`,
        priority: "normal",
        audience: "guardians",
        classSectionIds: [],
        channels: ["App"],
        status: "published",
        scheduledFor: null,
        recipientIds: recipients,
        acknowledgedIds: [],
      });
      break;
    }
    case "hr-register":
      if (c.input.personType !== "staff")
        throw new Error("HR can manage only staff attendance.");
      y = saveRegister(y, c.input);
      break;
    case "hr-leave": {
      const leave = y.records.leaves.find((l) => l.id === c.id);
      if (
        !leave ||
        (actor.role === "hr" && leave.personType !== "staff") ||
        leave.personId === actor.personId
      )
        throw new Error("A different reviewer must decide staff leave.");
      y = decideLeave(y, c.id, c.decision, c.note);
      break;
    }
    case "staff-identity": {
      if (
        c.input.schoolId !== actor.schoolId ||
        !y.setup.staff.some((s) => s.id === c.input.id)
      )
        throw new Error("Staff is outside this school.");
      y = {
        ...y,
        setup: {
          ...y.setup,
          staff: y.setup.staff.map((s) => (s.id === c.input.id ? c.input : s)),
        },
      };
      break;
    }
    case "staff-profile": {
      const old = y.records.staffProfiles.find((p) => p.id === c.input.id);
      if (
        !old ||
        old.staffId !== c.input.staffId ||
        !y.setup.staff.some((s) => s.id === c.input.staffId)
      )
        throw new Error("Staff profile is outside this school.");
      if (actor.role === "hr" && old.roleId !== c.input.roleId)
        throw new Error("An administrator assigns role presets.");
      y = putRecord(y, "staffProfiles", c.input);
      break;
    }
    case "staff-onboard": {
      if (!y.records.roles.some((r) => r.id === c.input.roleId))
        throw new Error("Role preset is outside this school.");
      const staffId = crypto.randomUUID();
      y = {
        ...y,
        setup: {
          ...y.setup,
          staff: [
            ...y.setup.staff,
            {
              id: staffId,
              schoolId: actor.schoolId,
              displayName: c.input.displayName,
              designation: c.input.designation,
            },
          ],
        },
      };
      const {
        displayName: _name,
        designation: _designation,
        ...profile
      } = c.input;
      y = putRecord(y, "staffProfiles", {
        ...profile,
        ...scope(y),
        id: crypto.randomUUID(),
        staffId,
      });
      break;
    }
    case "leave":
      y = requestPortalLeave(y, actor, c.input);
      break;
    case "homework-submit":
      y = submitPortalHomework(y, actor, c.input);
      break;
    case "attendance-save":
      y = savePortalAttendance(y, actor, c.input);
      break;
    case "submission-grade":
      y = gradePortalSubmission(y, actor, c.input);
      break;
    case "mark-save":
      y = savePortalMark(y, actor, c.input);
      break;
    case "notice-ack":
      y = acknowledgePortalNotice(y, actor, c.id);
      break;
    case "teacher-create":
      y = createTeacherWork(y, actor, c.kind, c.input);
      break;
    case "lesson-submit":
      y = submitTeacherLesson(y, actor, c.id);
      break;
    case "operation-save":
      if (c.input.kind === "messages")
        throw new Error("Use the private conversation inbox for messages.");
      y = saveOperation(y, actor, c.input);
      break;
    case "operation-respond":
      y = respondOperation(y, actor, c.id, c.input);
      break;
    case "loan-renew":
      y = renewLoan(y, actor, c.id, c.dueDate);
      break;
  }
  y = {
    ...y,
    setup: appendAudit(y.setup, `Cloud: ${c.type}`, {
      accountId: actor.id,
      displayName: actor.name,
      role: actor.role,
    }),
  };
  return workspaceSchema.parse({
    ...root,
    revision: root.revision + 1,
    years: root.years.map((v, i) => (i === index ? y : v)),
  });
}
