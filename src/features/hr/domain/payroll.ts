import { employedOn } from "./employment-status.ts";
import { isInstructionDay } from "../../attendance/domain/eligibility.ts";
import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  payrollPolicySchema,
  salaryPlanSchema,
  payrollRunSchema,
  employmentEventSchema,
} from "../schemas/payroll.schema.ts";
import { postJournal } from "../../fees/domain/ledger.ts";
function permit(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal", "hr"].includes(a.role)
  )
    throw new Error("Employment permission required.");
}
export function configurePayroll(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  return {
    ...y,
    workflows: {
      ...y.workflows,
      payrollPolicy: payrollPolicySchema.parse(input),
    },
  };
}
export function saveSalaryPlan(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const plan = salaryPlanSchema.parse(input);
  if (!y.setup.staff.some((s) => s.id === plan.staffId))
    throw new Error("Staff member is not in this school.");
  if (
    y.workflows.payrollRuns.some(
      (r) =>
        r.status === "finalised" && r.period >= plan.effectiveFrom.slice(0, 7),
    )
  )
    throw new Error("Salary changes must take effect after finalised payroll.");
  return {
    ...y,
    workflows: {
      ...y.workflows,
      salaryPlans: [
        ...y.workflows.salaryPlans.filter(
          (p) =>
            p.staffId !== plan.staffId ||
            p.effectiveFrom !== plan.effectiveFrom,
        ),
        plan,
      ],
    },
  };
}
export function preparePayroll(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const { period } = z
      .strictObject({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })
      .parse(input),
    start = period + "-01",
    end = new Date(
      Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5)), 0),
    )
      .toISOString()
      .slice(0, 10),
    days = Number(end.slice(-2));
  if (
    start < y.setup.calendar.year.startDate ||
    end > y.setup.calendar.year.endDate
  )
    throw new Error("Payroll month must be inside the academic year.");
  if (!y.workflows.payrollPolicy.approvedBySchool)
    throw new Error(
      "A school-approved payroll policy is required. Configure deductions before preparing payroll.",
    );
  if (y.workflows.payrollRuns.some((r) => r.period === period))
    throw new Error("Payroll for this month already exists.");
  const staffIds = [
    ...new Set(
      y.workflows.salaryPlans
        .filter((p) => p.effectiveFrom <= end)
        .map((p) => p.staffId),
    ),
  ];
  const lines = staffIds.map((staffId) => {
    const plans = y.workflows.salaryPlans
      .filter((p) => p.staffId === staffId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    let earnedGross = 0,
      earnedBasic = 0,
      unpaidDays = 0;
    for (let day = 1; day <= days; day++) {
      const date = period + "-" + String(day).padStart(2, "0"),
        plan = plans.find((p) => p.effectiveFrom <= date);
      if (!plan || !employedOn(y.workflows.employmentEvents, staffId, date))
        continue;
      if (
        y.records.attendance.some(
          (r) =>
            r.personType === "staff" &&
            r.personId === staffId &&
            r.status === "absent" &&
            r.date === date,
        ) ||
        y.records.leaves.some(
          (l) =>
            l.personType === "staff" &&
            l.personId === staffId &&
            l.status === "approved" &&
            l.paid === false &&
            l.dates.startDate <= date &&
            l.dates.endDate >= date &&
            isInstructionDay(y, date, ""),
        )
      ) {
        unpaidDays++;
        continue;
      }
      earnedGross += plan.grossMinor / days;
      earnedBasic += plan.basicMinor / days;
    }
    const gross = Math.round(earnedGross),
      basic = Math.round(earnedBasic);
    const deductions = (gross ? y.workflows.payrollPolicy.rules : []).map(
      (rule) => ({
        label: rule.label,
        amountMinor:
          rule.basis === "fixed"
            ? rule.amountMinor
            : Math.round(
                ((rule.basis === "gross" ? gross : basic) * rule.rateBps) /
                  10000,
              ),
        employerOnly: rule.employerOnly,
      }),
    );
    const net =
      gross -
      deductions
        .filter((d) => !d.employerOnly)
        .reduce((s, d) => s + d.amountMinor, 0);
    if (net < 0) throw new Error("Deductions exceed earned salary.");
    return {
      staffId,
      grossMinor: gross,
      basicMinor: basic,
      unpaidDays,
      daysInMonth: days,
      deductions,
      netMinor: net,
    };
  });
  const run = payrollRunSchema.parse({
    id: crypto.randomUUID(),
    period,
    status: "draft",
    createdBy: a.id,
    reviewedBy: null,
    createdAt: new Date().toISOString(),
    finalisedAt: null,
    lines,
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      payrollRuns: [...y.workflows.payrollRuns, run],
    },
  };
}
export function progressPayroll(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  id: string,
) {
  permit(y, a);
  const old = y.workflows.payrollRuns.find((r) => r.id === id);
  if (!old || old.status === "finalised")
    throw new Error("Choose a draft or reviewed payroll.");
  if (old.status === "draft" && old.createdBy === a.id)
    throw new Error("A different authorised reviewer must review payroll.");
  const next = payrollRunSchema.parse({
    ...old,
    status: old.status === "draft" ? "reviewed" : "finalised",
    reviewedBy: old.status === "draft" ? a.id : old.reviewedBy,
    finalisedAt: old.status === "reviewed" ? new Date().toISOString() : null,
  });
  let result = {
    ...y,
    workflows: {
      ...y.workflows,
      payrollRuns: y.workflows.payrollRuns.map((r) => (r.id === id ? next : r)),
    },
  };
  if (next.status === "finalised") {
    const amount = next.lines.reduce((s, l) => s + l.grossMinor, 0),
      net = next.lines.reduce((s, l) => s + l.netMinor, 0),
      employer = next.lines.reduce(
        (s, l) =>
          s +
          l.deductions
            .filter((d) => d.employerOnly)
            .reduce((t, d) => t + d.amountMinor, 0),
        0,
      );
    if (amount)
      result = postJournal(result, a, {
        sourceKey: `payroll:${id}`,
        date: next.period + "-01",
        memo: `Finalised payroll ${next.period}`,
        reversesId: null,
        lines: [
          { account: "Payroll expense", debitMinor: amount, creditMinor: 0 },
          ...(employer
            ? [
                {
                  account: "Employer contribution expense" as const,
                  debitMinor: employer,
                  creditMinor: 0,
                },
              ]
            : []),
          ...(net
            ? [
                {
                  account: "Payroll payable" as const,
                  debitMinor: 0,
                  creditMinor: net,
                },
              ]
            : []),
          ...(amount - net + employer
            ? [
                {
                  account: "Deductions payable" as const,
                  debitMinor: 0,
                  creditMinor: amount - net + employer,
                },
              ]
            : []),
        ],
      });
    let counter = result.workflows.counters["payslip"] ?? 0;
    result = {
      ...result,
      workflows: {
        ...result.workflows,
        counters: {
          ...result.workflows.counters,
          payslip: counter + next.lines.length,
        },
        publications: [
          ...result.workflows.publications,
          ...next.lines.map((line) => ({
            id: crypto.randomUUID(),
            kind: "payslip" as const,
            sourceId: next.id,
            ownerType: "staff" as const,
            ownerId: line.staffId,
            version: 1,
            reference: `PAY-${next.period}-${String(++counter).padStart(5, "0")}`,
            title: `Payslip ${next.period}`,
            issuedBy: a.id,
            issuedAt: new Date().toISOString(),
            revokedAt: null,
            revocationReason: "",
            snapshot: {
              school: y.setup.school.name,
              staff: y.setup.staff.find((s) => s.id === line.staffId)
                ?.displayName,
              period: next.period,
              currency: y.setup.school.currency,
              payrollPolicy: y.workflows.payrollPolicy,
              ...line,
            },
          })),
        ],
      },
    };
  }
  return result;
}
export function saveEmploymentEvent(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const event = employmentEventSchema
    .omit({ id: true, actorId: true })
    .parse(input);
  if(event.kind==="exited"&&event.staffId===a.personId)throw new Error("Another authorised reviewer must record your exit.");
  if (!y.setup.staff.some((s) => s.id === event.staffId))
    throw new Error("Staff member unavailable.");
  if (
    event.date < y.setup.calendar.year.startDate ||
    event.date > y.setup.calendar.year.endDate
  )
    throw new Error("Event date is outside this year.");
  if (
    y.workflows.employmentEvents.some(
      (e) =>
        e.staffId === event.staffId &&
        e.kind === event.kind &&
        e.date === event.date,
    )
  )
    throw new Error("This event is already recorded.");
  if (event.kind !== "contract-renewed") {
    const prior = y.workflows.employmentEvents
      .filter(
        (e) => e.staffId === event.staffId && e.kind !== "contract-renewed",
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (prior && (prior.date >= event.date || prior.kind === event.kind))
      throw new Error(
        "Joining and exit events must alternate in chronological order.",
      );
  }
  return {
    ...y,
    workflows: {
      ...y.workflows,
      employmentEvents: [
        ...y.workflows.employmentEvents,
        { ...event, id: crypto.randomUUID(), actorId: a.id },
      ],
    },
  };
}
