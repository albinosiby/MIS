import type { SetupConfig } from "../models/index.ts";
import { setupConfigSchemaFor } from "../schemas/setup-config.schema.ts";

export const studentCsvHeader =
  "admissionNumber,displayName,classSectionId,guardianName,guardianEmail,guardianPhone";
import { parseCsv } from "../../../shared/data/csv.ts";
export { parseCsv } from "../../../shared/data/csv.ts";
export function importStudents(
  current: SetupConfig,
  text: string,
  inactiveStudentIds: readonly string[] = [],
): SetupConfig {
  const [header, ...rows] = parseCsv(text);
  if (header?.join(",") !== studentCsvHeader)
    throw new Error(`Use the template columns: ${studentCsvHeader}`);
  if (!rows.length) throw new Error("Add at least one student row.");
  const next = structuredClone(current);
  rows.forEach((cells, index) => {
    if (cells.length !== 6)
      throw new Error(`Row ${index + 2}: expected 6 columns.`);
    const [
      admissionNumber,
      displayName,
      classSectionId,
      guardianName,
      guardianEmail,
      guardianPhone,
    ] = cells;
    if (next.students.some((s) => s.admissionNumber === admissionNumber))
      throw new Error(`Row ${index + 2}: admission number already exists.`);
    const id = crypto.randomUUID();
    const guardianId = crypto.randomUUID();
    next.students.push({
      id,
      schoolId: next.school.id,
      academicYearId: next.calendar.year.id,
      admissionNumber,
      displayName,
      classSectionId,
    });
    next.guardians.push({
      id: guardianId,
      schoolId: next.school.id,
      displayName: guardianName,
      email: guardianEmail,
      phone: guardianPhone,
    });
    next.relationships.push({
      schoolId: next.school.id,
      studentId: id,
      guardianId,
      relationship: "parent",
      canViewRecords: true,
      canReceiveNotices: true,
    });
  });
  // Changing ingestion invalidates its sign-off and portal activation.
  next.completed = next.completed.slice(0, 6);
  next.portal.invitationsPrepared = false;
  return setupConfigSchemaFor(new Set(inactiveStudentIds)).parse(next);
}
