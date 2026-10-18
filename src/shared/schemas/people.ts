import { z } from "zod";
import { displayNameSchema, identifierSchema } from "./primitives.ts";

// Minimal shared summaries, not complete medical, HR, or identity records.
export const personSummarySchema = z.strictObject({
  id: identifierSchema,
  schoolId: identifierSchema,
  displayName: displayNameSchema,
});
export const studentSummarySchema = personSummarySchema.extend({
  admissionNumber: identifierSchema,
});
export const guardianSummarySchema = personSummarySchema.extend({});
export const staffSummarySchema = personSummarySchema.extend({
  designation: z.string().trim().min(1).max(100),
});
export const guardianRelationshipSchema = z.strictObject({
  schoolId: identifierSchema,
  studentId: identifierSchema,
  guardianId: identifierSchema,
  relationship: z.enum(["parent", "guardian", "other"]),
  canViewRecords: z.boolean(),
  canReceiveNotices: z.boolean(),
});
