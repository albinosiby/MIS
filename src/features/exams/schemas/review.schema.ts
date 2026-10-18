import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const resultReviewRequestSchema = z.strictObject({
  publicationId: identifierSchema, subjectId: identifierSchema,
  proposedMarks: z.number().min(0).max(1000),
  reason: z.string().trim().min(8).max(500),
  sourceOperationId: identifierSchema.nullable().default(null),
});
export const moderationRequestSchema = resultReviewRequestSchema.omit({ publicationId: true }).extend({ examId: identifierSchema, studentId: identifierSchema });
export const resultReviewDecisionSchema = z.strictObject({
  id: identifierSchema, decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().min(8).max(500),
});
export const resultReviewSchema = resultReviewRequestSchema.extend({
  publicationId: identifierSchema.nullable(),
  id: identifierSchema, examId: identifierSchema, studentId: identifierSchema,
  previousMarks: z.number().min(0).max(1000),
  requestedBy: identifierSchema, requestedAt: z.iso.datetime(),
  status: z.enum(["submitted", "approved", "rejected"]),
  decidedBy: identifierSchema.nullable(), decidedAt: z.iso.datetime().nullable(),
  decisionNote: z.string().max(500), correctedPublicationId: identifierSchema.nullable(),
});
export const resultSubjectSnapshotSchema = z.strictObject({
  subjectId: identifierSchema, subject: z.string(), marks: z.number().nonnegative(),
  maximum: z.number().positive(), percent: z.number().min(0).max(100),
  grade: z.string(), remark: z.string(),
});
