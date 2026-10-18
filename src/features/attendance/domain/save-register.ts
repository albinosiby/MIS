import { attendanceBatchRequestSchema } from "../schemas/attendance.schema.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
export function saveRegister(year: SchoolYearWorkspace, input: unknown) {
  const data = attendanceBatchRequestSchema.parse(input);
  if (
    data.schoolId !== year.setup.school.id ||
    data.academicYearId !== year.setup.calendar.year.id
  )
    throw new Error("Register belongs to another school/year.");
  if (new Set(data.entries.map((e) => e.personId)).size !== data.entries.length)
    throw new Error("Duplicate attendance entries.");
  const next = structuredClone(year);
  for (const entry of data.entries) {
    const person =
      data.personType === "student"
        ? year.setup.students.find(
            (s) =>
              s.id === entry.personId &&
              s.classSectionId === data.classSectionId,
          )
        : year.setup.staff.find((s) => s.id === entry.personId);
    if (!person) throw new Error("A selected person is not in this register.");
    if (data.personType === "staff" && data.periodId)
      throw new Error("Staff registers use daily attendance.");
    const leave = year.records.leaves.find(
      (l) =>
        l.personType === data.personType &&
        l.personId === entry.personId &&
        l.status === "approved" &&
        l.dates.startDate <= data.date &&
        l.dates.endDate >= data.date,
    );
    if (leave && entry.status !== "excused")
      throw new Error(
        "An approved leave must remain excused. Review the leave decision before changing attendance.",
      );
    const existing = next.records.attendance.find(
      (r) =>
        r.personType === data.personType &&
        r.personId === entry.personId &&
        r.date === data.date &&
        r.periodId === data.periodId,
    );
    const record = {
      id: existing?.id ?? crypto.randomUUID(),
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      personType: data.personType,
      personId: entry.personId,
      date: data.date,
      periodId: data.periodId,
      status: entry.status,
      note: entry.note,
    };
    next.records.attendance = next.records.attendance.filter(
      (r) => r.id !== record.id,
    );
    next.records.attendance.push(record);
  }
  return schoolYearWorkspaceSchema.parse(next);
}
