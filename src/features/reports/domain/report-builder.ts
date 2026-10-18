import {reportColumns} from "../data/report-columns.ts";
export {reportColumns};
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  reportBuilderSchema,
  publicationSchema,
  publishedReportScheduleSchema,
} from "../schemas/publication.schema.ts";
function permit(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("School reporting permission required.");
}
export function saveReportBuilder(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const report = reportBuilderSchema.parse(input),
    allowed: readonly string[] = reportColumns[report.source];
  if (
    new Set(report.columns).size !== report.columns.length ||
    [...report.columns, ...report.filters.map((f) => f.field)].some(
      (c) => !allowed.includes(c),
    )
  )
    throw new Error("Choose supported columns for this report source.");
  return {
    ...y,
    workflows: {
      ...y.workflows,
      reportBuilders: [
        ...y.workflows.reportBuilders.filter((r) => r.id !== report.id),
        report,
      ],
    },
  };
}
export function publishReport(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  id: string,
) {
  permit(y, a);
  const report = y.workflows.reportBuilders.find((r) => r.id === id);
  if (!report) throw new Error("Report definition unavailable.");
  let rows: Record<string, unknown>[] = [];
  switch (report.source) {
    case "students":
      rows = y.setup.students;
      break;
    case "attendance":
      rows = y.records.attendance;
      break;
    case "fees":
      rows = y.records.invoices.map((i) => ({
        ...i,
        amountMinor: i.lines.reduce((s, l) => s + l.amountMinor, 0),
      }));
      break;
    case "marks":
      rows = y.records.marks;
      break;
    case "staff":
      rows = y.setup.staff;
      break;
    case "admissions":
      rows = y.records.inquiries;
      break;
    case "ledger":
      rows = y.workflows.ledger.map((r) => ({
        reference: r.sourceKey,
        date: r.date,
        memo: r.memo,
        debitMinor: r.lines.reduce((s, l) => s + l.debitMinor, 0),
        creditMinor: r.lines.reduce((s, l) => s + l.creditMinor, 0),
      }));
      break;
    case "payroll":
      rows = y.workflows.payrollRuns.flatMap((r) =>
        r.lines.map((l) => ({ period: r.period, status: r.status, ...l })),
      );
      break;
  }
  const selected = rows
    .filter((row) =>
      report.filters.every((f) => {
        const value = row[f.field];
        switch (f.operator) {
          case "equals":
            return String(value ?? "") === f.value;
          case "contains":
            return String(value ?? "")
              .toLowerCase()
              .includes(f.value.toLowerCase());
          case "gte":
            return typeof value === "number"
              ? Number.isFinite(Number(f.value)) && value >= Number(f.value)
              : String(value ?? "") >= f.value;
          case "lte":
            return typeof value === "number"
              ? Number.isFinite(Number(f.value)) && value <= Number(f.value)
              : String(value ?? "") <= f.value;
        }
      }),
    )
    .map((row) =>
      Object.fromEntries(report.columns.map((c) => [c, row[c] ?? ""])),
    );
  if (selected.length > 1000)
    throw new Error(
      "Narrow report filters to at most 1,000 rows per published snapshot.",
    );
  const counter = (y.workflows.counters.report ?? 0) + 1;
  const pub = publicationSchema.parse({
    id: crypto.randomUUID(),
    kind: "report",
    sourceId: id,
    ownerType: "school",
    ownerId: a.schoolId,
    version:
      1 +
      y.workflows.publications.filter(
        (p) => p.kind === "report" && p.sourceId === id,
      ).length,
    reference: `RPT-${y.setup.calendar.year.id}-${counter}`,
    title: report.name,
    issuedBy: a.id,
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revocationReason: "",
    snapshot: {
      school: y.setup.school.name,
      year: y.setup.calendar.year.name,
      source: report.source,
      columns: report.columns,
      filters: report.filters,
      rows: selected,
    },
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      counters: { ...y.workflows.counters, report: counter },
      publications: [...y.workflows.publications, pub],
    },
  };
}
export function revokePublication(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  id: string,
  reason: string,
) {
  permit(y, a);
  const pub = y.workflows.publications.find((p) => p.id === id);
  if (!pub || pub.revokedAt) throw new Error("Choose a current publication.");
  return {
    ...y,
    workflows: {
      ...y.workflows,
      publications: y.workflows.publications.map((p) =>
        p.id === id
          ? {
              ...p,
              revokedAt: new Date().toISOString(),
              revocationReason: reason,
            }
          : p,
      ),
    },
  };
}

export function savePublishedReportSchedule(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  permit(y, a);
  const data = publishedReportScheduleSchema
    .omit({ createdBy: true, lastRun: true })
    .parse(input);
  if (!y.workflows.reportBuilders.some((r) => r.id === data.reportId))
    throw new Error("Choose a saved report in this year.");
  if (new Set(data.recipientIds).size !== data.recipientIds.length)
    throw new Error("Choose unique recipients.");
  const old = y.workflows.reportSchedules.find((s) => s.id === data.id);
  return {
    ...y,
    workflows: {
      ...y.workflows,
      reportSchedules: [
        ...y.workflows.reportSchedules.filter((s) => s.id !== data.id),
        { ...data, createdBy: a.id, lastRun: old?.lastRun ?? null },
      ],
    },
  };
}
