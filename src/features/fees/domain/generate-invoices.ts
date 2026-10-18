import { generateInvoicesRequestSchema } from "../schemas/fees.schema.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import { scope } from "../../workspace/domain/operations.ts";
export function generateInvoices(y: SchoolYearWorkspace, input: unknown) {
  const data = generateInvoicesRequestSchema.parse(input);
  if (
    data.schoolId !== y.setup.school.id ||
    data.academicYearId !== y.setup.calendar.year.id
  )
    throw new Error("Billing request belongs to another school/year.");
  if (
    new Set(data.studentIds).size !== data.studentIds.length ||
    new Set(data.feeHeadIds).size !== data.feeHeadIds.length
  )
    throw new Error("Billing selection contains duplicates.");
  const lines = data.feeHeadIds.map((id) => {
    const fee = y.setup.fees.find((f) => f.id === id);
    if (!fee) throw new Error("Fee head not found.");
    return { id: fee.id, name: fee.name, amountMinor: fee.amountMinor };
  });
  const next = structuredClone(y);
  for (const id of data.studentIds) {
    if (!y.setup.students.some((s) => s.id === id))
      throw new Error("Selected student does not belong to this school.");
    if (
      next.records.invoices.some(
        (i) =>
          i.studentId === id &&
          i.period === data.period &&
          i.status === "issued",
      )
    )
      continue;
    next.records.invoices.push({
      ...scope(y),
      id: crypto.randomUUID(),
      studentId: id,
      reference: `INV-${Date.now()}-${next.records.invoices.length + 1}`,
      period: data.period,
      issuedOn: data.issuedOn,
      dueDate: data.dueDate,
      lines,
      concessionMinor: Math.round(
        (lines.reduce((s, l) => s + l.amountMinor, 0) *
          data.concessionPercent) /
          100,
      ),
      status: "issued",
    });
  }
  return schoolYearWorkspaceSchema.parse(next);
}
