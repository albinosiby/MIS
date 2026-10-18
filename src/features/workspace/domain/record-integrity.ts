import { jsonEqual } from "../../../shared/domain/json-equality.ts";
import { applyEnrolmentEvents } from "../../students/domain/enrolment-events.ts";
import { assertApprovedResultChanges } from "../../exams/domain/reviews.ts";
import { leaveWorkingDates } from "../../attendance/domain/leave-policy.ts";
import { applyCertificateEffects } from "../../documents/domain/issue-publications.ts";
import { applyOperationalEffects } from "../../operations/domain/connected-effects.ts";
import type { Workspace, SchoolYearWorkspace } from "../models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { postFinancialChanges } from "../../fees/domain/ledger.ts";
const same = jsonEqual;
function preserveRows<T extends { id: string }>(
  old: T[],
  next: T[],
  label: string,
  select: (row: T) => unknown = (row) => row,
) {
  for (const row of old) {
    const updated = next.find((v) => v.id === row.id);
    if (!updated || !same(select(row), select(updated)))
      throw new Error(`${label} history cannot be removed or rewritten.`);
  }
}
export function assertYearIntegrity(
  old: SchoolYearWorkspace,
  next: SchoolYearWorkspace,
) {
  for (const profile of old.records.studentProfiles) {
    const saved = next.records.studentProfiles.find((p) => p.id === profile.id);
    if (!saved || saved.studentId !== profile.studentId)
      throw new Error(
        "Student enrolment profiles cannot be removed or reassigned.",
      );
    if (
      saved &&
      saved.status !== profile.status &&
      (!next.workflows.studentEvents.some(
        (e) =>
          e.studentId === profile.studentId &&
          ["withdrawn", "transferred"].includes(e.kind) &&
          !old.workflows.studentEvents.some((o) => o.id === e.id),
      ) ||
        profile.status !== "active")
    )
      throw new Error(
        "Use a student lifecycle action to change enrolment status.",
      );
  }
  preserveRows(
    old.workflows.bankStatements,
    next.workflows.bankStatements,
    "Imported bank statement",
    ({
      matches: _m,
      closedAt: _a,
      closedBy: _b,
      voidedAt: _va,
      voidedBy: _vb,
      voidReason: _vr,
      ...stable
    }) => stable,
  );
  preserveRows(
    old.workflows.bankStatements.filter((s) => s.closedAt || s.voidedAt),
    next.workflows.bankStatements,
    "Closed bank statement",
  );
  for (const s of old.workflows.bankStatements) {
    const saved = next.workflows.bankStatements.find((v) => v.id === s.id)!;
    if (saved.matches.length < s.matches.length)
      throw new Error("Bank match history cannot be removed.");
    for (const [i, m] of s.matches.entries()) {
      const updated = saved.matches[i];
      const stable = ({
        voidedAt: _a,
        voidedBy: _b,
        voidReason: _r,
        ...v
      }: typeof m) => v;
      if (
        !same(stable(m), stable(updated)) ||
        (m.voidedAt && !same(m, updated))
      )
        throw new Error("Bank match history cannot be rewritten.");
    }
  }
  preserveRows(
    old.workflows.admissionDecisions,
    next.workflows.admissionDecisions,
    "Admission decision",
  );
  preserveRows(
    old.workflows.timetableVersions,
    next.workflows.timetableVersions,
    "Published timetable",
  );
  preserveRows(
    old.workflows.resultReviews.filter((r) => r.status !== "submitted"),
    next.workflows.resultReviews,
    "Decided result review",
  );
  preserveRows(
    old.workflows.substitutionReviews.filter((r) =>
      ["cancelled", "rejected"].includes(r.status),
    ),
    next.workflows.substitutionReviews,
    "Closed substitution review",
  );
  preserveRows(
    old.workflows.resultReviews,
    next.workflows.resultReviews,
    "Result review request",
    ({
      status: _s,
      decidedAt: _a,
      decidedBy: _b,
      decisionNote: _n,
      correctedPublicationId: _p,
      ...request
    }) => request,
  );
  preserveRows(
    old.workflows.substitutionReviews,
    next.workflows.substitutionReviews,
    "Substitution request",
    ({ status: _s, decisions: _d, ...request }) => request,
  );
  for (const review of old.workflows.substitutionReviews) {
    const updated = next.workflows.substitutionReviews.find(
      (r) => r.id === review.id,
    )!;
    if (
      !same(
        review.decisions,
        updated.decisions.slice(0, review.decisions.length),
      )
    )
      throw new Error("Substitution decision history cannot be rewritten.");
  }
  preserveRows(
    old.workflows.websiteReleases,
    next.workflows.websiteReleases,
    "Published website",
  );

  preserveRows(
    old.workflows.employmentEvents,
    next.workflows.employmentEvents,
    "Employment lifecycle",
  );
  preserveRows(
    old.workflows.studentEvents,
    next.workflows.studentEvents,
    "Student timeline",
  );
  preserveRows(
    old.records.leaves.filter((l) => l.status === "approved"),
    next.records.leaves,
    "Approved leave",
  );
  for (const leave of next.records.leaves.filter(
    (l) =>
      l.personType === "staff" &&
      l.status === "approved" &&
      old.records.leaves.find((o) => o.id === l.id)?.status !== "approved",
  )) {
    const type = leave.leaveType ?? "Casual leave",
      policy = next.workflows.payrollPolicy.leaveTypes.find(
        (t) => t.name === type,
      );
    const days = new Set(
      next.records.leaves
        .filter(
          (l) =>
            l.personType === "staff" &&
            l.personId === leave.personId &&
            l.status === "approved" &&
            (l.leaveType ?? "Casual leave") === type,
        )
        .flatMap((l) =>
          leaveWorkingDates(next, l.dates.startDate, l.dates.endDate),
        ),
    ).size;
    if (!policy || leave.paid !== policy.paid || days > policy.annualDays)
      throw new Error(
        "Staff leave must follow the configured allowance and paid/unpaid rule.",
      );
  }
  preserveRows(old.workflows.ledger, next.workflows.ledger, "Posted journal");
  preserveRows(
    old.workflows.publications,
    next.workflows.publications,
    "Issued publication",
    ({ revokedAt: _at, revocationReason: _reason, ...stable }) => stable,
  );
  preserveRows(
    old.workflows.payrollRuns.filter((r) => r.status === "finalised"),
    next.workflows.payrollRuns,
    "Finalised payroll",
  );
  for (const invoice of old.records.invoices) {
    const saved = next.records.invoices.find((i) => i.id === invoice.id);
    if (!saved) throw new Error("Issued invoices cannot be deleted.");
    const { concessionMinor: _c, status: _s, ...fixed } = invoice,
      { concessionMinor: _nc, status: _ns, ...newFixed } = saved;
    if (
      !same(fixed, newFixed) ||
      saved.concessionMinor < invoice.concessionMinor
    )
      throw new Error("Issued invoice amounts and ownership are immutable.");
    if (
      saved.concessionMinor !== invoice.concessionMinor &&
      !next.records.approvals.some(
        (a) =>
          a.category === "concession" &&
          a.targetId === invoice.id &&
          a.status === "approved" &&
          old.records.approvals.find((o) => o.id === a.id)?.status !==
            "approved" &&
          a.amountMinor === saved.concessionMinor - invoice.concessionMinor,
      )
    )
      throw new Error("Concessions require a new approved request.");
    if (invoice.status === "void" && saved.status !== "void")
      throw new Error("Voided invoices cannot be reopened.");
    if (
      saved.status === "void" &&
      next.records.payments.some(
        (p) =>
          p.invoiceId === saved.id &&
          p.status === "completed" &&
          p.amountMinor > (p.refundedMinor ?? 0),
      )
    )
      throw new Error(
        "Reverse or refund collections before voiding an invoice.",
      );
  }
  for (const payment of old.records.payments) {
    const saved = next.records.payments.find((p) => p.id === payment.id);
    if (!saved) throw new Error("Collections cannot be deleted.");
    const { status: _s, note: _n, refundedMinor: _r, ...fixed } = payment,
      { status: _ns, note: _nn, refundedMinor: _nr, ...newFixed } = saved;
    if (
      !same(fixed, newFixed) ||
      (saved.refundedMinor ?? 0) < (payment.refundedMinor ?? 0) ||
      (saved.refundedMinor ?? 0) > saved.amountMinor
    )
      throw new Error("Posted collection amounts and ownership cannot change.");
    if (payment.status === "reversed" && !same(payment, saved))
      throw new Error("Reversed collections are immutable.");
    if (
      saved.status === "reversed" &&
      payment.status !== "reversed" &&
      saved.note.trim().length < 8
    )
      throw new Error("A reversal reason is required.");
  }
  for (const exam of old.records.exams.filter(
    (e) => e.status === "completed",
  )) {
    const saved = next.records.exams.find((e) => e.id === exam.id);
    const unlock = next.records.approvals.some(
      (a) =>
        a.category === "exam_unlock" &&
        a.targetId === exam.id &&
        a.status === "approved" &&
        old.records.approvals.find((o) => o.id === a.id)?.status !== "approved",
    );
    if (
      !saved ||
      (!unlock &&
        (!same(saved, exam) ||
          (!assertApprovedResultChanges(old, next, exam.id) &&
            !same(
              old.records.marks.filter((m) => m.examId === exam.id),
              next.records.marks.filter((m) => m.examId === exam.id),
            ))))
    )
      throw new Error(
        "Published results are locked. Request a new review/version before changing marks.",
      );
  }
  preserveRows(
    old.records.certificates.filter((c) => c.status === "issued"),
    next.records.certificates,
    "Issued certificate",
  );
  for (const row of old.extensions.filter((r) =>
    [
      "ended",
      "collected",
      "settled",
      "checked-out",
      "posted",
      "finalised",
      "completed",
      "returned",
      "issued",
      "received",
      "reconciled",
    ].includes(r.status),
  )) {
    const saved = next.extensions.find((r) => r.id === row.id);
    if (!saved)
      throw new Error("Finalised operational records cannot be removed.");
    const { history: _history, status: _status, ...stable } = row,
      { history: _newHistory, status: _newStatus, ...newStable } = saved;
    const renewedLoan =
      row.kind === "loans" &&
      row.status === "issued" &&
      saved.status === "issued" &&
      String(saved.values.dueDate) > String(row.values.dueDate) &&
      same(
        {
          ...newStable,
          values: { ...saved.values, dueDate: row.values.dueDate },
        },
        stable,
      );
    if (
      (!same(stable, newStable) && !renewedLoan) ||
      saved.status === "cancelled"
    )
      throw new Error(
        "Finalised operational records require an explicit correction, not rewriting or cancellation.",
      );
  }
}
export function applyCanonicalEffects(
  previous: Workspace,
  next: Workspace,
  actor: AccountIdentity,
): Workspace {
  if (
    [...previous.years, ...next.years].some(
      (y) => y.setup.school.id !== actor.schoolId,
    )
  )
    throw new Error("School scope mismatch.");
  for (const old of previous.years) {
    const updated = next.years.find(
      (y) => y.setup.calendar.year.id === old.setup.calendar.year.id,
    );
    if (!updated) throw new Error("Academic years cannot be removed.");
    if (old.locked) {
      if (!same(old, updated)) throw new Error("Archived years are immutable.");
    } else assertYearIntegrity(old, updated);
  }
  return {
    ...next,
    years: next.years.map((y) => {
      const old = previous.years.find(
        (o) => o.setup.calendar.year.id === y.setup.calendar.year.id,
      );
      if (!old || y.locked) return y;
      const changed =
        JSON.stringify(old.records.invoices) !==
          JSON.stringify(y.records.invoices) ||
        JSON.stringify(old.records.payments) !==
          JSON.stringify(y.records.payments);
      if (changed && !["admin", "principal", "accountant"].includes(actor.role))
        throw new Error(
          "Only finance roles can directly edit invoices and collections.",
        );
      return postFinancialChanges(
        old,
        applyEnrolmentEvents(
          old,
          applyCertificateEffects(
            old,
            applyOperationalEffects(old, y, actor),
            actor,
          ),
          actor,
        ),
        actor,
        true,
      );
    }),
  };
}
