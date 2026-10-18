import { z } from "zod";
import {
  scopedRecordSchema,
  attachmentSchema,
} from "../../../shared/schemas/workflow.ts";
import {
  displayNameSchema,
  identifierSchema,
  emailSchema,
  phoneSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const admissionStageSchema = z.enum([
  "new",
  "contacted",
  "campus_visit",
  "application",
  "assessment",
  "offered",
  "waitlisted",
  "enrolled",
  "lost",
]);
export const inquirySchema = scopedRecordSchema.extend({
  studentName: displayNameSchema,
  guardianName: displayNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  classSectionId: identifierSchema,
  source: z.enum(["Website", "Walk-in", "Referral", "Phone", "Campaign"]),
  stage: admissionStageSchema,
  counselorId: identifierSchema.nullable(),
  followUpDate: localDateSchema,
  notes: z.string().trim().max(1000),
  score: z.number().min(0).max(100).nullable(),
  interviewDate: localDateSchema.nullable(),
  offerExpiry: localDateSchema.nullable(),
  studentId: identifierSchema.nullable(),
  answers: z.record(identifierSchema, z.string().trim().max(1000)).default({}),
  documents: z.array(attachmentSchema).max(20).default([]),
  siblingStudentId: identifierSchema.nullable().default(null),
  lostReason: z.string().trim().max(300),
});
export const admissionFormSchema = scopedRecordSchema.extend({
  title: displayNameSchema,
  accepting: z.boolean(),
  requireDocuments: z.boolean(),
  requireSibling: z.boolean(),
  applicationFeeMinor: z.number().int().min(0).max(1000000),
  fields: z
    .array(
      z.strictObject({
        id: identifierSchema,
        label: displayNameSchema,
        type: z.enum(["text", "email", "phone", "date", "select"]),
        required: z.boolean(),
        options: z.string().trim().max(1000).default(""),
      }),
    )
    .min(1)
    .max(30),
});
export const reenrolmentSchema = scopedRecordSchema.extend({
  studentId: identifierSchema,
  intent: z.enum(["pending", "continue", "withdraw"]),
  note: z.string().trim().max(500),
});
