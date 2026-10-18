import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  lateFeeRuleRequestSchema,
  assessLateChargeSchema,
  ledgerStatementSchema,
} from "../schemas/finance-workflow.schema.ts";
import { scope, balance } from "../../workspace/domain/operations.ts";
import { publicationSchema } from "../../reports/schemas/publication.schema.ts";
function permit(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal", "accountant"].includes(a.role)
  )
    throw new Error("Finance permission required.");
}
export function configureLateFees(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = lateFeeRuleRequestSchema.parse(input),
    plan = y.workflows.feePlans.find((p) => p.id === r.planId);
  if (!plan) throw new Error("Payment plan unavailable.");
  if (
    y.workflows.counters[`late-fees-${plan.id}`] &&
    (plan.lateFeeMinorPerDay !== r.dailyMinor ||
      plan.lateFeeCapMinor !== r.capMinor)
  )
    throw new Error(
      "Assessed late-fee rules cannot be changed retrospectively.",
    );
  return {
    ...y,
    workflows: {
      ...y.workflows,
      feePlans: y.workflows.feePlans.map((p) =>
        p.id === plan.id
          ? {
              ...p,
              lateFeeMinorPerDay: r.dailyMinor,
              lateFeeCapMinor: r.capMinor,
            }
          : p,
      ),
    },
  };
}
export function previewLateCharge(
  y: SchoolYearWorkspace,
  planId: string,
  today: string,
) {
  const plan = y.workflows.feePlans.find((p) => p.id === planId);
  if (!plan) throw new Error("Payment plan unavailable.");
  let accrued = 0;
  for (const [index, instalment] of plan.instalments.entries()) {
    const invoice = y.records.invoices.find(
      (i) => i.reference === `PLAN-${plan.id.slice(0, 80)}-${index + 1}`,
    );
    if (
      invoice?.status === "issued" &&
      balance(y, invoice.id) > 0 &&
      instalment.dueDate < today
    ) {
      const days = Math.floor(
        (Date.parse(today + "T00:00:00Z") -
          Date.parse(instalment.dueDate + "T00:00:00Z")) /
          86400000,
      );
      accrued += days * plan.lateFeeMinorPerDay;
    }
  }
  return Math.max(
    0,
    Math.min(accrued, plan.lateFeeCapMinor) -
      (y.workflows.counters[`late-fees-${plan.id}`] ?? 0),
  );
}
export function assessLateCharge(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = assessLateChargeSchema.parse(input),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: y.workflows.advanced.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    amount = previewLateCharge(y, r.planId, today),
    plan = y.workflows.feePlans.find((p) => p.id === r.planId)!;
  if (
    today < y.setup.calendar.year.startDate ||
    today > y.setup.calendar.year.endDate ||
    !amount
  )
    throw new Error(
      "No additional late charge is due in the active academic year.",
    );
  const count = (y.workflows.counters["late-invoice"] ?? 0) + 1;
  return {
    ...y,
    records: {
      ...y.records,
      invoices: [
        ...y.records.invoices,
        {
          ...scope(y),
          id: crypto.randomUUID(),
          studentId: plan.studentId,
          reference: `LATE-${y.setup.calendar.year.id.slice(0, 60)}-${count}`,
          period: `Late charges: ${plan.name}`.slice(0, 80),
          issuedOn: today,
          dueDate: today,
          lines: [
            {
              id: crypto.randomUUID(),
              name: `Late charge for ${plan.name}`.slice(0, 160),
              amountMinor: amount,
            },
          ],
          concessionMinor: 0,
          status: "issued" as const,
        },
      ],
    },
    workflows: {
      ...y.workflows,
      counters: {
        ...y.workflows.counters,
        "late-invoice": count,
        [`late-fees-${plan.id}`]:
          (y.workflows.counters[`late-fees-${plan.id}`] ?? 0) + amount,
      },
    },
  };
}
export function publishLedgerStatement(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const r = ledgerStatementSchema.parse(input);
  if (
    r.from < y.setup.calendar.year.startDate ||
    r.to > y.setup.calendar.year.endDate
  )
    throw new Error("Choose dates within this academic year.");
  const rows = y.workflows.ledger
    .filter((j) => j.date >= r.from && j.date <= r.to)
    .flatMap((j) =>
      j.lines.map((l) => ({
        date: j.date,
        memo: j.memo,
        account: l.account,
        debitMinor: l.debitMinor,
        creditMinor: l.creditMinor,
      })),
    );
  if (rows.length > 5000)
    throw new Error("Narrow the statement date range to 5,000 journal lines.");
  const counter = (y.workflows.counters["ledger-statement"] ?? 0) + 1,
    pub = publicationSchema.parse({
      id: crypto.randomUUID(),
      kind: "report",
      sourceId: `ledger-${r.from}-${r.to}`,
      ownerType: "school",
      ownerId: a.schoolId,
      version: 1,
      reference: `LEDGER-${y.setup.calendar.year.id.slice(0, 60)}-${counter}`,
      title: `Ledger statement ${r.from} to ${r.to}`,
      issuedBy: a.id,
      issuedAt: new Date().toISOString(),
      revokedAt: null,
      revocationReason: "",
      snapshot: {
        school: y.setup.school.name,
        year: y.setup.calendar.year.name,
        source: "ledger",
        from: r.from,
        to: r.to,
        columns: ["date", "memo", "account", "debitMinor", "creditMinor"],
        rows,
      },
    });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      counters: { ...y.workflows.counters, "ledger-statement": counter },
      publications: [...y.workflows.publications, pub],
    },
  };
}
