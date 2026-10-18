import { jsonEqual } from "../../../shared/domain/json-equality.ts";
import { guardCirculation } from "../../library/domain/circulation.ts";
import { guardResidence } from "../../hostel/domain/residence.ts";
import { guardDispatch } from "../../transport/domain/dispatch.ts";
import { guardStock } from "../../inventory/domain/stock.ts";
import { prepareQuizSubmission } from "../../learning/domain/quiz-submission.ts";
import {
  approvalSatisfied,
  requestWorkflowApproval,
} from "../../settings/domain/advanced-settings.ts";
import { z } from "zod";
const responseSchema = z.strictObject({ response: z.string().max(4000) });
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { canAccess } from "../../identity/domain/access.ts";
import { operationRequestSchema } from "../schemas/operations.schema.ts";
import { definition } from "../data/module-definitions.ts";
import type { OperationRecord } from "../models/index.ts";
export function scopedStudentIds(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
) {
  if (actor.schoolId !== y.setup.school.id) return [];
  if (actor.role === "student")
    return y.setup.students
      .filter((s) => s.id === actor.personId)
      .map((s) => s.id);
  if (actor.role === "parent")
    return y.setup.relationships
      .filter((l) => l.guardianId === actor.personId && l.canViewRecords)
      .map((l) => l.studentId);
  if (actor.role === "teacher") {
    const classIds = y.setup.allocations
      .filter((a) => a.staffId === actor.personId)
      .map((a) => a.classSectionId);
    return y.setup.students
      .filter((s) => classIds.includes(s.classSectionId))
      .map((s) => s.id);
  }
  if (actor.role === "driver") {
    const trips = y.extensions.filter(
      (r) =>
        r.kind === "trips" &&
        r.staffId === actor.personId &&
        r.status !== "cancelled",
    );
    return y.setup.students
      .filter(
        (student) =>
          y.extensions.some(
            (r) =>
              r.kind === "boarding" &&
              r.studentId === student.id &&
              trips.some((t) => t.id === r.values.tripId),
          ) ||
          y.extensions.some(
            (r) =>
              r.kind === "transport-allocations" &&
              r.studentId === student.id &&
              ["active", "ended"].includes(r.status) &&
              trips.some(
                (t) =>
                  t.values.routeId === r.values.routeId &&
                  String(r.values.startDate) <= t.date &&
                  String(r.values.endDate) >= t.date,
              ),
          ) ||
          (!y.extensions.some(
            (r) =>
              r.kind === "transport-allocations" && r.studentId === student.id,
          ) &&
            y.records.studentProfiles.some(
              (p) =>
                p.studentId === student.id &&
                trips.some((t) => t.values.routeId === p.routeId),
            )),
      )
      .map((student) => student.id);
  }
  return y.setup.students.map((s) => s.id);
}
const selfServiceKinds = [
  "messages",
  "ptm",
  "consents",
  "re-evaluations",
  "document-requests",
  "quiz-attempts",
  "activity-enrolments",
  "reservations",
  "payment-attempts",
  "surveys",
];
export function canUseCollection(
  actor: AccountIdentity,
  kind: string,
  write = false,
) {
  const def = definition(kind);
  if (kind === "quiz-attempts" && actor.role === "parent" && write)
    return false;
  if (["admin", "principal"].includes(actor.role))
    return !["platform", "group"].includes(def.area);
  if (actor.role === "platform" || actor.role === "group")
    return def.area === actor.role;
  if (
    actor.role === "accountant" &&
    [
      "hostel-allocations",
      "transport-allocations",
      "library-fines",
      "purchase-orders",
    ].includes(kind)
  )
    return !write;
  if (def.restricted)
    return (
      (def.area === "health" && actor.role === "nurse") ||
      (def.area === "wellbeing" && actor.role === "counsellor")
    );
  if (canAccess(actor.role, `/${def.area}`)) return true;
  if (["parent", "student"].includes(actor.role))
    return (
      (selfServiceKinds.includes(kind) &&
        (!write || !["ptm", "consents", "surveys"].includes(kind))) ||
      (!write &&
        [
          "transport-allocations",
          "stops",
          "outpasses",
          "resources",
          "live-classes",
          "quizzes",
          "books",
          "loans",
          "library-fines",
          "clubs",
          "trips-events",
          "achievements",
          "seating",
          "report-templates",
        ].includes(kind))
    );
  if (actor.role === "teacher")
    if (["re-evaluations", "moderation"].includes(kind)) return !write;
  if (actor.role === "teacher")
    return [
      "messages",
      "ptm",
      "resources",
      "live-classes",
      "quizzes",
      "quiz-attempts",
      "incidents",
      "house-points",
      "activity-enrolments",
    ].includes(kind);
  if (actor.role === "driver")
    return ["vehicles", "stops", "transport-allocations"].includes(kind)
      ? !write
      : ["trips", "boarding", "transport-alerts"].includes(kind);
  if (actor.role === "staff")
    return (
      ["expenses", "training", "messages"].includes(kind) ||
      (!write && ["payroll", "contracts", "appraisals"].includes(kind))
    );
  return false;
}
export function visibleOperations(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  kind: string,
) {
  if (actor.schoolId !== y.setup.school.id || !canUseCollection(actor, kind))
    return [];
  const ids = scopedStudentIds(y, actor);
  return y.extensions
    .filter(
      (row) =>
        row.kind === kind &&
        (row.studentId
          ? ids.includes(row.studentId)
          : !["parent", "student"].includes(actor.role) ||
            row.createdBy === actor.id ||
            [
              "stops",
              "books",
              "resources",
              "live-classes",
              "quizzes",
              "clubs",
              "trips-events",
              "report-templates",
            ].includes(kind)),
    )
    .filter(
      (row) =>
        !["staff", "driver"].includes(actor.role) ||
        !row.staffId ||
        row.staffId === actor.personId,
    )
    .filter(
      (row) =>
        row.kind !== "messages" ||
        (["parent", "student"].includes(actor.role)
          ? row.createdBy === actor.id
          : !["teacher", "staff"].includes(actor.role) ||
            row.staffId === actor.personId),
    )
    .filter((row) => {
      if (actor.role !== "driver") return true;
      if (row.kind === "boarding" || row.kind === "transport-alerts")
        return y.extensions.some(
          (t) =>
            t.kind === "trips" &&
            t.id === row.values.tripId &&
            t.staffId === actor.personId,
        );
      if (row.kind === "stops" || row.kind === "transport-allocations")
        return y.extensions.some(
          (t) =>
            t.kind === "trips" &&
            t.staffId === actor.personId &&
            t.values.routeId === row.values.routeId,
        );
      if (row.kind === "vehicles")
        return y.extensions.some(
          (t) =>
            t.kind === "trips" &&
            t.values.vehicleId === row.id &&
            t.staffId === actor.personId,
        );
      return row.kind === "trips" && row.staffId === actor.personId;
    })
    .filter((row) => {
      if (actor.role === "teacher" && row.kind === "quiz-attempts") {
        const quiz = y.extensions.find(
          (q) => q.id === row.values.quizId && q.kind === "quizzes",
        );
        return Boolean(
          quiz &&
            y.setup.allocations.some(
              (a) =>
                a.staffId === actor.personId &&
                a.classSectionId === quiz.values.classSectionId,
            ) &&
            y.setup.students.some(
              (s) =>
                s.id === row.studentId &&
                s.classSectionId === quiz.values.classSectionId,
            ),
        );
      }
      if (actor.role === "teacher" && row.values.classSectionId)
        return y.setup.allocations.some(
          (a) =>
            a.staffId === actor.personId &&
            a.classSectionId === row.values.classSectionId,
        );
      return true;
    })
    .filter((row) => {
      if (!["parent", "student"].includes(actor.role)) return true;
      if (kind === "stops")
        return (
          row.status === "active" &&
          y.extensions.some(
            (r) =>
              r.kind === "transport-allocations" &&
              r.status === "active" &&
              ids.includes(r.studentId ?? "") &&
              r.values.stopId === row.id,
          )
        );
      if (["resources", "live-classes", "quizzes"].includes(kind))
        return (
          !["draft", "cancelled"].includes(row.status) &&
          y.setup.students.some(
            (s) =>
              ids.includes(s.id) &&
              s.classSectionId === row.values.classSectionId,
          )
        );
      if (["clubs", "trips-events"].includes(kind))
        return ["open", "completed"].includes(row.status);
      if (kind === "report-templates") return row.status === "published";
      return true;
    })
    .map((row) =>
      ["parent", "student"].includes(actor.role) && row.kind === "quizzes"
        ? {
            ...row,
            values: { ...row.values, answer: "Available after teacher review" },
          }
        : row,
    );
}
/** Self-service authors may prepare and submit records; school reviewers decide them. */
export function canEditOperation(actor: AccountIdentity, row: OperationRecord) {
  if (!canUseCollection(actor, row.kind, true)) return false;
  if (
    row.kind === "library-fines" ||
    row.kind === "boarding" ||
    row.kind === "reservations" ||
    (row.kind === "hostel-allocations" && row.status === "active") ||
    (row.kind === "transport-allocations" && row.status === "active") ||
    (row.kind === "outpasses" && row.status !== "requested") ||
    (row.kind === "trips" && row.status === "started") ||
    ([
      "purchase-orders",
      "refunds",
      "expenses",
      "payment-plans",
      "contracts",
      "training",
    ].includes(row.kind) &&
      ["submitted", "approved", "received", "completed"].includes(row.status))
  )
    return false;

  if (row.kind === "quiz-attempts")
    return (
      actor.role === "student" &&
      row.createdBy === actor.id &&
      row.status === "submitted"
    );
  if (actor.role === "staff" && ["expenses", "training"].includes(row.kind))
    return row.staffId === actor.personId && row.status === "draft";
  if (["parent", "student"].includes(actor.role))
    return (
      row.createdBy === actor.id &&
      row.status === definition(row.kind).states[0]
    );
  return true;
}
export function canTransitionOperation(
  actor: AccountIdentity,
  row: OperationRecord,
  next: string,
) {
  if (!canUseCollection(actor, row.kind, true)) return false;
  if (
    ["expenses", "payment-plans"].includes(row.kind) &&
    row.status === "approved" &&
    next === "cancelled"
  )
    return false;
  if (actor.role === "staff" && ["expenses", "training"].includes(row.kind))
    return (
      row.staffId === actor.personId &&
      row.status === "draft" &&
      ["submitted", "cancelled"].includes(next)
    );
  if (["parent", "student"].includes(actor.role))
    return (
      row.createdBy === actor.id &&
      (["messages", "payment-attempts"].includes(row.kind) ||
        (row.kind === "reservations" &&
          ["requested", "ready"].includes(row.status) &&
          next === "cancelled"))
    );
  return true;
}
export function saveOperation(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  input: unknown,
) {
  const row = operationRequestSchema.parse(input);
  if (row.kind === "payment-attempts" && row.status === "simulated-success")
    throw new Error(
      "The payment gateway is disconnected. Record offline collections through Finance.",
    );
  const def = definition(row.kind);
  if (y.locked) throw new Error("Archived years are read-only.");
  if (
    actor.schoolId !== y.setup.school.id ||
    !canUseCollection(actor, row.kind, true)
  )
    throw new Error("This role cannot change these records.");
  if (
    row.schoolId !== actor.schoolId ||
    row.academicYearId !== y.setup.calendar.year.id
  )
    throw new Error("Record belongs to another school/year.");
  const previous = y.extensions.find((x) => x.id === row.id);
  if (
    !previous &&
    ["parent", "student"].includes(actor.role) &&
    row.studentId &&
    y.records.studentProfiles.some(
      (p) => p.studentId === row.studentId && p.status !== "active",
    )
  )
    throw new Error("New requests require an active enrolment.");
  if (
    previous &&
    [
      "purchase-orders",
      "refunds",
      "expenses",
      "payment-plans",
      "contracts",
      "training",
    ].includes(row.kind) &&
    ["submitted", "approved", "received", "completed"].includes(
      previous.status,
    ) &&
    !jsonEqual(
      {
        title: row.title,
        date: row.date,
        studentId: row.studentId,
        staffId: row.staffId,
        values: row.values,
      },
      {
        title: previous.title,
        date: previous.date,
        studentId: previous.studentId,
        staffId: previous.staffId,
        values: previous.values,
      },
    )
  )
    throw new Error(
      "Submitted requests cannot change their reviewed details. Cancel and submit a corrected request.",
    );
  if (row.kind === "quiz-attempts") {
    const quiz = y.extensions.find(
      (q) => q.id === row.values.quizId && q.kind === "quizzes",
    );
    if (!quiz || Number(row.values.score) > Number(quiz.values.maxScore))
      throw new Error("Quiz score exceeds its maximum.");
  }

  if (actor.role === "driver" && row.kind === "trips") {
    if (
      !previous ||
      previous.staffId !== actor.personId ||
      row.staffId !== actor.personId ||
      !jsonEqual(row.values, previous.values) ||
      row.studentId !== previous.studentId ||
      row.title !== previous.title ||
      row.date !== previous.date
    )
      throw new Error(
        "Transport staff assign trips; drivers may only progress their own assigned trip.",
      );
  }
  if (
    row.kind === "messages" &&
    ["teacher", "staff"].includes(actor.role) &&
    (!actor.personId || row.staffId !== actor.personId)
  )
    throw new Error("Messages must use your own staff identity.");

  if (
    actor.role === "staff" &&
    ["expenses", "training"].includes(row.kind) &&
    row.staffId !== actor.personId
  )
    throw new Error("You can submit records only for yourself.");
  if (
    previous &&
    (row.status === previous.status
      ? !canEditOperation(actor, previous)
      : !canTransitionOperation(actor, previous, row.status))
  )
    throw new Error(
      "This request is with school reviewers and cannot be changed by this account.",
    );
  if (previous && previous.kind !== row.kind)
    throw new Error("Record kind cannot change.");
  if (
    previous &&
    !visibleOperations(y, actor, row.kind).some((x) => x.id === row.id)
  )
    throw new Error("Record is outside this account’s scope.");
  if (
    actor.role === "driver" &&
    ["boarding", "transport-alerts"].includes(row.kind) &&
    !y.extensions.some(
      (t) =>
        t.kind === "trips" &&
        t.id === row.values.tripId &&
        t.staffId === actor.personId,
    )
  )
    throw new Error("Trip is not assigned to this driver.");
  if (
    actor.role === "teacher" &&
    row.values.classSectionId &&
    !y.setup.allocations.some(
      (a) =>
        a.staffId === actor.personId &&
        a.classSectionId === row.values.classSectionId,
    )
  )
    throw new Error("Class is not assigned to this teacher.");
  if (
    ["parent", "student"].includes(actor.role) &&
    row.kind === "quiz-attempts" &&
    Number(row.values.score) !== 0
  )
    throw new Error("Only a teacher can grade a quiz.");
  if (row.studentId && !scopedStudentIds(y, actor).includes(row.studentId))
    throw new Error("Student is outside this account’s scope.");
  if (
    ["parent", "student"].includes(actor.role) &&
    row.kind === "quiz-attempts"
  ) {
    const quiz = y.extensions.find(
      (r) =>
        r.kind === "quizzes" &&
        r.id === row.values.quizId &&
        r.status === "published",
    );
    if (
      !quiz ||
      !y.setup.students.some(
        (s) =>
          s.id === row.studentId &&
          s.classSectionId === quiz.values.classSectionId,
      )
    )
      throw new Error("Quiz is not published for this student.");
  }
  if (["parent", "student"].includes(actor.role)) {
    if (previous?.createdBy !== actor.id && previous)
      throw new Error("You can only update your own requests.");
    if (
      row.kind === "payment-attempts" &&
      (!previous || previous.status !== row.status)
    ) {
      const invoice = y.records.invoices.find(
        (i) =>
          i.id === row.values.invoiceId &&
          i.studentId === row.studentId &&
          i.status === "issued",
      );
      const paid = y.records.payments
        .filter((p) => p.invoiceId === invoice?.id && p.status === "completed")
        .reduce((s, p) => s + p.amountMinor - p.refundedMinor, 0);
      if (
        !invoice ||
        Number(row.values.amountMinor) >
          invoice.lines.reduce((s, l) => s + l.amountMinor, 0) -
            invoice.concessionMinor -
            paid
      )
        throw new Error(
          "Choose an unpaid invoice and an amount within its remaining balance.",
        );
    }
    if (!previous && row.status !== def.states[0])
      throw new Error("A new request must start at its initial state.");
    if (
      previous &&
      row.status !== previous.status &&
      !(row.kind === "reservations" && row.status === "cancelled") &&
      !["payment-attempts", "messages", "consents", "surveys"].includes(
        row.kind,
      )
    )
      throw new Error("School staff must review this request.");
  }
  if (!previous && row.status !== def.states[0])
    throw new Error("New records must start at their initial state.");
  if (previous && row.status !== previous.status) {
    const from = def.states.indexOf(previous.status),
      to = def.states.indexOf(row.status);
    if (
      row.status !== "cancelled" &&
      to !== from + 1 &&
      !(
        row.kind === "payment-attempts" &&
        previous.status === "pending" &&
        row.status === "failed"
      )
    )
      throw new Error("Follow the workflow in order.");
  }
  if (
    previous &&
    [
      "ended",
      "collected",
      "settled",
      "checked-out",
      "received",
      "posted",
      "finalised",
      "completed",
      "returned",
      "issued",
      "published",
      "reconciled",
      "simulated-success",
      "cancelled",
    ].includes(previous.status) &&
    row.status === previous.status &&
    !jsonEqual({ ...previous, history: [] }, { ...row, history: [] })
  )
    throw new Error("Finalised records cannot be silently edited.");
  if (
    previous &&
    row.status !== previous.status &&
    ["approved", "posted", "issued", "completed"].includes(row.status) &&
    !approvalSatisfied(y, row.kind, row.id)
  )
    throw new Error(
      "Complete the configured approval steps before progressing this record.",
    );
  if (row.kind === "purchase-payments" && row.status === "posted") {
    const po = y.extensions.find(
      (r) =>
        r.kind === "purchase-orders" && r.id === row.values.purchaseOrderId,
    );
    const accrued = y.workflows.ledger
      .filter(
        (j) =>
          j.sourceKey === `purchase:${po?.id}` ||
          y.extensions.some(
            (r) =>
              r.kind === "purchase-receipts" &&
              r.values.purchaseOrderId === po?.id &&
              j.sourceKey === `purchase-receipt:${r.id}`,
          ),
      )
      .flatMap((j) => j.lines)
      .filter((l) => l.account === "Trade payable")
      .reduce((sum, l) => sum + l.creditMinor - l.debitMinor, 0);
    const paid = y.extensions
      .filter(
        (r) =>
          r.id !== row.id &&
          r.kind === "purchase-payments" &&
          r.status === "posted" &&
          r.values.purchaseOrderId === po?.id,
      )
      .reduce((sum, r) => sum + Number(r.values.amountMinor), 0);
    if (
      !po ||
      !["approved", "received"].includes(po.status) ||
      Number(row.values.amountMinor) > accrued - paid
    )
      throw new Error(
        "Payment exceeds this order's received, unpaid purchase liability.",
      );
    if (row.date < po.date)
      throw new Error("A vendor payment cannot precede its purchase order.");
    if (
      y.extensions.some(
        (r) =>
          r.id !== row.id &&
          r.kind === "purchase-payments" &&
          r.status === "posted" &&
          String(r.values.bankReference).toLowerCase() ===
            String(row.values.bankReference).toLowerCase(),
      )
    )
      throw new Error("This bank payment reference has already been recorded.");
  }
  if (row.kind === "reconciliation" && row.status !== "cancelled") {
    const payment = y.records.payments.find(
      (p) =>
        p.id === row.values.paymentId &&
        p.status === "completed" &&
        p.method !== "Cash",
    );
    if (!payment || payment.amountMinor !== row.values.amountMinor)
      throw new Error(
        "Reconciliation requires an exact completed non-cash collection.",
      );
    if (
      y.extensions.some(
        (r) =>
          r.id !== row.id &&
          r.kind === "reconciliation" &&
          r.status !== "cancelled" &&
          (r.values.paymentId === row.values.paymentId ||
            String(r.values.bankReference).toLowerCase() ===
              String(row.values.bankReference).toLowerCase()),
      )
    )
      throw new Error(
        "Payment or bank reference already has a reconciliation record.",
      );
    if (previous && ["matched", "reconciled"].includes(row.status)) {
      const journal = y.workflows.ledger.find(
        (j) =>
          j.sourceKey === `collection:${payment.id}` ||
          j.sourceKey === `opening-collection:${payment.id}`,
      );
      const statement = y.workflows.bankStatements.find(
        (s) =>
          !s.voidedAt &&
          s.matches.some(
            (m) =>
              !m.voidedAt &&
              m.journalId === journal?.id &&
              s.lines.some(
                (l) =>
                  l.id === m.lineId &&
                  l.reference.toLowerCase() ===
                    String(row.values.bankReference).toLowerCase(),
              ),
          ),
      );
      if (!statement || (row.status === "reconciled" && !statement.closedAt))
        throw new Error(
          "Match the collection to its imported bank statement and close that statement before final reconciliation.",
        );
    }
  }
  guardCirculation(y, row, previous);
  guardResidence(y, row, previous);
  guardDispatch(y, row, previous);
  guardStock(y, row, previous);
  const saved: OperationRecord = prepareQuizSubmission(
    y,
    actor,
    {
      ...row,
      createdBy: previous?.createdBy ?? actor.id,
      history: [
        ...(previous?.history ?? []),
        {
          at: new Date().toISOString(),
          actorId: actor.id,
          action: previous ? `${previous.status} → ${row.status}` : "Created",
        },
      ],
    },
    previous,
  );
  const next = {
    ...y,
    extensions: previous
      ? y.extensions.map((x) => (x.id === row.id ? saved : x))
      : [...y.extensions, saved],
  };
  return row.status === "submitted"
    ? requestWorkflowApproval(next, actor, row.kind, row.id)
    : next;
}
export function renewLoan(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  id: string,
  dueDate: string,
) {
  const previous = y.extensions.find(
    (r) => r.id === id && r.kind === "loans" && r.status === "issued",
  );
  if (
    !previous ||
    !canUseCollection(actor, "loans", true) ||
    actor.schoolId !== y.setup.school.id ||
    y.locked
  )
    throw new Error("Only library staff can renew an active loan.");
  const copy = y.extensions.find(
    (r) => r.id === previous.values.copyId && r.kind === "copies",
  );
  if (
    y.extensions.some(
      (r) =>
        r.kind === "reservations" &&
        ["requested", "ready"].includes(r.status) &&
        r.values.bookId === copy?.values.bookId &&
        r.studentId !== previous.studentId,
    )
  )
    throw new Error(
      "Return this copy for the waiting reservation queue instead of renewing.",
    );
  if (dueDate > y.setup.calendar.year.endDate)
    throw new Error("Renewal must stay inside the academic year.");
  if (dueDate <= String(previous.values.dueDate))
    throw new Error("Renewal date must extend the current due date.");
  const row = operationRequestSchema.parse({
    ...previous,
    values: { ...previous.values, dueDate },
    history: [
      ...previous.history,
      {
        at: new Date().toISOString(),
        actorId: actor.id,
        action: `Renewed until ${dueDate}`,
      },
    ],
  });
  return { ...y, extensions: y.extensions.map((x) => (x.id === id ? row : x)) };
}
/** Narrow family action: preserve the school-authored request and its scope. */
export function respondOperation(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  id: string,
  input: unknown,
) {
  const row = y.extensions.find((r) => r.id === id);
  if (
    !row ||
    y.locked ||
    actor.schoolId !== y.setup.school.id ||
    !["parent", "student"].includes(actor.role) ||
    !row.studentId ||
    !scopedStudentIds(y, actor).includes(row.studentId)
  )
    throw new Error("Request is outside your linked records.");
  const value = responseSchema.parse(input);
  let updated: OperationRecord;
  if (
    row.kind === "outpasses" &&
    row.status === "requested" &&
    row.values.guardianApproval === "Pending" &&
    actor.role === "parent" &&
    ["Granted", "Declined"].includes(value.response) &&
    y.setup.relationships.some(
      (link) =>
        link.guardianId === actor.personId &&
        link.studentId === row.studentId &&
        link.canViewRecords &&
        ["parent", "guardian"].includes(link.relationship),
    )
  )
    updated = {
      ...row,
      values: { ...row.values, guardianApproval: value.response },
    };
  else if (row.kind === "ptm" && row.status === "available")
    updated = { ...row, status: "booked" };
  else if (
    row.kind === "consents" &&
    row.status === "requested" &&
    ["Granted", "Declined"].includes(value.response)
  )
    updated = {
      ...row,
      status: "responded",
      values: { ...row.values, response: value.response },
    };
  else if (
    row.kind === "surveys" &&
    row.status === "open" &&
    value.response.trim().length
  )
    updated = {
      ...row,
      values: { ...row.values, response: value.response.trim() },
    };
  else throw new Error("This request is not open for your response.");
  updated = {
    ...updated,
    history: [
      ...row.history,
      {
        at: new Date().toISOString(),
        actorId: actor.id,
        action:
          row.kind === "ptm"
            ? "Family booked meeting"
            : "Family response recorded",
      },
    ],
  };
  return {
    ...y,
    extensions: y.extensions.map((r) => (r.id === id ? updated : r)),
  };
}
