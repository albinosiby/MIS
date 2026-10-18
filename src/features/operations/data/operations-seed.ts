import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { moduleDefinitions } from "./module-definitions.ts";
import { operationRecordSchema } from "../schemas/operations.schema.ts";
import type { OperationRecord } from "../models/index.ts";
/** Synthetic operational fixtures reference the existing canonical school records. */
export function createOperationsSeed(y: SchoolYearWorkspace) {
  const rows: OperationRecord[] = [];
  const date = y.setup.calendar.year.startDate;
  for (const d of moduleDefinitions) {
    const values: Record<string, string | number> = {};
    let skip = false;
    for (const f of d.fields) {
      if (f.relation) {
        const canonical =
          f.relation === "classes"
            ? y.setup.classes
            : f.relation === "payments"
              ? y.records.payments.filter((p) => p.status === "completed")
              : (y.records as unknown as Record<string, { id: string }[]>)[
                  f.relation
                ];
        const ref = (canonical ?? rows.filter((r) => r.kind === f.relation))[0]
          ?.id;
        if (!ref) {
          skip = true;
          break;
        }
        values[f.name] = ref;
      } else if (f.type === "date") values[f.name] = date;
      else if (f.type === "number")
        values[f.name] =
          f.name === "deductionMinor"
            ? 0
            : Math.max(
                f.min ?? 0,
                f.name === "grossMinor"
                  ? 500000
                  : f.name === "capacity"
                    ? 30
                    : f.name === "maximum"
                      ? 100
                      : 1,
              );
      else if (f.type === "select") values[f.name] = f.options![0];
      else if (f.name.toLowerCase().includes("email"))
        values[f.name] = "school@example.com";
      else if (f.name === "url" || f.name === "imageUrl")
        values[f.name] = "https://example.com";
      else if (["time", "pickupTime"].includes(f.name))
        values[f.name] = "09:00";
      else
        values[f.name] =
          f.name === "creditAccount"
            ? "Bank clearing"
            : `Sample ${f.label.toLowerCase()}`;
    }
    if(d.kind==="certificate-templates")values.prefix="GF";
    if(d.kind==="journals"){values.debitAccount="Operating expense";values.creditAccount="Bank";}
    if (skip || (d.student && !y.setup.students.length)) continue;
    let studentId = d.student ? y.setup.students[0].id : null;
    if (d.kind === "payment-attempts")
      studentId =
        y.records.invoices.find((i) => i.id === values.invoiceId)?.studentId ??
        studentId;
    if (d.kind === "refunds")
      studentId =
        y.records.invoices.find(
          (i) =>
            i.id ===
            y.records.payments.find((p) => p.id === values.paymentId)
              ?.invoiceId,
        )?.studentId ?? studentId;
    if (["refunds", "reconciliation"].includes(d.kind))
      values.amountMinor =
        y.records.payments.find((p) => p.id === values.paymentId)
          ?.amountMinor ?? 1;
    rows.push(
      operationRecordSchema.parse({
        id: `op-demo-${d.kind}`,
        schoolId: y.setup.school.id,
        academicYearId: y.setup.calendar.year.id,
        kind: d.kind,
        title: `${d.title} · sample`,
        date,
        studentId,
        staffId: d.staff
          ? (y.setup.staff.find(
              (s) =>
                s.id ===
                (["drivers", "trips"].includes(d.kind)
                  ? "staff-4"
                  : [
                        "payroll",
                        "contracts",
                        "training",
                        "appraisals",
                        "expenses",
                      ].includes(d.kind)
                    ? "staff-2"
                    : "staff-1"),
            )?.id ?? y.setup.staff[0].id)
          : null,
        status: [
          "resources",
          "quizzes",
          "report-templates",
          "grading-scales",
        ].includes(d.kind)
          ? "published"
          : d.kind === "clubs"
            ? "open"
            : d.kind === "payroll"
              ? "finalised"
              : d.states[0],
        values,
        createdBy: "demo-admin",
        history: [
          {
            at: new Date().toISOString(),
            actorId: "demo-admin",
            action: "Created synthetic sample",
          },
        ],
      }),
    );
  }
  return rows;
}
