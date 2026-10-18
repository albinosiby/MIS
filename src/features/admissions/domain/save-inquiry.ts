import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { inquirySchema } from "../schemas/admissions.schema.ts";
import { submitInquiry } from "./admission-workflow.ts";
/** Editing contact/assessment data cannot bypass the admission state machine. */
export function saveInquiry(year: SchoolYearWorkspace, input: unknown) {
  const record = inquirySchema.parse(input),
    existing = year.records.inquiries.find((row) => row.id === record.id);
  if (
    record.schoolId !== year.setup.school.id ||
    record.academicYearId !== year.setup.calendar.year.id
  )
    throw new Error("Application is outside this school/year.");
  if (existing) {
    if (
      record.stage !== existing.stage ||
      record.studentId !== existing.studentId
    )
      throw new Error(
        "Use admission progression or enrolment to change the application state.",
      );
    if (existing.stage === "enrolled")
      throw new Error(
        "An enrolled application is immutable; update the student's record instead.",
      );
  } else if (record.stage !== "new" || record.studentId)
    throw new Error("New applications must start at the inquiry stage.");
  return submitInquiry(year, record);
}
