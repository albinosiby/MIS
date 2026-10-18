import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { OperationRecord } from "../../operations/models/index.ts";
/** Carry school-owned masters and real on-hand stock; transactions remain in their archive. */
export function carryOperationalMasters(
  source: SchoolYearWorkspace,
  yearId: string,
  startDate: string,
): OperationRecord[] {
  const kinds = new Set([
    "vehicles",
    "stops",
    "drivers",
    "books",
    "copies",
    "vendors",
    "items",
    "assets",
    "beds",
    "grading-scales",
    "report-templates",
    "certificate-templates",
    "integrations",
    "webhooks",
  ]);
  const rows = source.extensions
    .filter((row) => kinds.has(row.kind))
    .map((row) => ({
      ...structuredClone(row),
      academicYearId: yearId,
      date: startDate,
    }));
  for (const item of rows.filter((row) => row.kind === "items")) {
    const quantity = source.extensions
      .filter(
        (row) =>
          row.kind === "stock-movements" &&
          row.status === "posted" &&
          row.values.itemId === item.id,
      )
      .reduce(
        (sum, row) =>
          sum +
          (row.values.direction === "Issue" ? -1 : 1) *
            Number(row.values.quantity),
        0,
      );
    if (quantity < 0 || quantity > 100000000)
      throw new Error("Reconcile inventory stock before rollover.");
    if (quantity)
      rows.push({
        id: crypto.randomUUID(),
        schoolId: source.setup.school.id,
        academicYearId: yearId,
        kind: "stock-movements",
        title: `Opening stock: ${item.title}`.slice(0, 160),
        date: startDate,
        studentId: null,
        staffId: null,
        status: "posted",
        values: {
          itemId: item.id,
          direction: "Receipt",
          quantity,
          department: "Opening stock from archived academic year",
        },
        createdBy: "year-rollover",
        history: [],
      });
  }
  return rows;
}
