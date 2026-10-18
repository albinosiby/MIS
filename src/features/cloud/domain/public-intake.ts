import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { inquirySchema } from "../../admissions/schemas/admissions.schema.ts";
import { submitInquiry } from "../../admissions/domain/admission-workflow.ts";
/** Force public intake into the configured school/year and initial workflow state. */
export function preparePublicInquiry(
  year: SchoolYearWorkspace,
  input: unknown,
) {
  if (year.locked) throw new Error("Intake is closed for this year.");
  const raw = z.record(z.string(), z.unknown()).parse(input);
  const siblingReference =
    typeof raw.siblingStudentId === "string" ? raw.siblingStudentId.trim() : "";
  const sibling = year.setup.students.find(
    (s) => s.admissionNumber === siblingReference,
  );
  const record = inquirySchema.parse({
    ...raw,
    id: crypto.randomUUID(),
    schoolId: year.setup.school.id,
    academicYearId: year.setup.calendar.year.id,
    stage: "new",
    source: "Website",
    counselorId: null,
    score: null,
    interviewDate: null,
    offerExpiry: null,
    studentId: null,
    lostReason: "",
    siblingStudentId: sibling?.id ?? null,
    followUpDate: year.setup.calendar.year.startDate,
  });
  return submitInquiry(year, record, true).records.inquiries.find(
    (r) => r.id === record.id,
  )!;
}
