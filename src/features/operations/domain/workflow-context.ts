import { jsonEqual } from "../../../shared/domain/json-equality.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { OperationRecord } from "../models/index.ts";
export function activeStudent(y: SchoolYearWorkspace, id: string | null) {
  if (
    !id ||
    !y.setup.students.some((s) => s.id === id) ||
    y.records.studentProfiles.some(
      (p) => p.studentId === id && p.status !== "active",
    )
  )
    throw new Error("An active enrolled student is required.");
}
export function operationalDate(y: SchoolYearWorkspace, date: string) {
  if (
    date < y.setup.calendar.year.startDate ||
    date > y.setup.calendar.year.endDate
  )
    throw new Error("Choose a date inside this academic year.");
}
export function overlaps(a: OperationRecord, b: OperationRecord) {
  return (
    String(a.values.startDate) <= String(b.values.endDate) &&
    String(b.values.startDate) <= String(a.values.endDate)
  );
}
export function unchangedDetails(
  previous: OperationRecord,
  row: OperationRecord,
) {
  if (
    !jsonEqual(
      [
        previous.title,
        previous.date,
        previous.studentId,
        previous.staffId,
        previous.values,
      ],
      [row.title, row.date, row.studentId, row.staffId, row.values],
    )
  )
    throw new Error(
      "Progress this record without changing its approved details. Create a corrected request instead.",
    );
}
