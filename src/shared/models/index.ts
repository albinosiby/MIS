import type { z } from "zod";
import type {
  academicYearSchema,
  academicTermSchema,
  classSectionSchema,
  academicCalendarSchema,
} from "../schemas/academics.ts";
import type {
  schoolAddressSchema,
  schoolProfileSchema,
} from "../schemas/school.ts";
import type {
  personSummarySchema,
  studentSummarySchema,
  guardianSummarySchema,
  staffSummarySchema,
  guardianRelationshipSchema,
} from "../schemas/people.ts";
import type { nonnegativeMoneySchema } from "../schemas/primitives.ts";

export type SchoolAddress = z.infer<typeof schoolAddressSchema>;
export type SchoolProfile = z.infer<typeof schoolProfileSchema>;
export type AcademicYear = z.infer<typeof academicYearSchema>;
export type AcademicTerm = z.infer<typeof academicTermSchema>;
export type AcademicCalendar = z.infer<typeof academicCalendarSchema>;
export type ClassSection = z.infer<typeof classSectionSchema>;
export type PersonSummary = z.infer<typeof personSummarySchema>;
export type StudentSummary = z.infer<typeof studentSummarySchema>;
export type GuardianSummary = z.infer<typeof guardianSummarySchema>;
export type StaffSummary = z.infer<typeof staffSummarySchema>;
export type GuardianRelationship = z.infer<typeof guardianRelationshipSchema>;
export type NonnegativeMoney = z.infer<typeof nonnegativeMoneySchema>;

export type EnrolledStudent = z.infer<
  typeof import("../schemas/school-records.ts").enrolledStudentSchema
>;
export type GuardianContact = z.infer<
  typeof import("../schemas/school-records.ts").guardianContactSchema
>;
export type Subject = z.infer<
  typeof import("../schemas/workflow.ts").subjectSchema
>;
export type Attachment = z.infer<
  typeof import("../schemas/workflow.ts").attachmentSchema
>;

import type { auditActorSchema } from "../schemas/audit.ts";
export type AuditActor = z.infer<typeof auditActorSchema>;
