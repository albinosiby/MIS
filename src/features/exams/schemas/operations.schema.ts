import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const gradingScalesValuesSchema = z.strictObject({
  minimum: z.number().int().min(0).max(100),
  maximum: z.number().int().min(0).max(100),
  grade: z.string().trim().min(1).max(254),
  descriptor: z.string().trim().min(1).max(4000),
});
export const gradingScalesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("grading-scales"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: gradingScalesValuesSchema,
});
export const reportTemplatesValuesSchema = z.strictObject({
  heading: z.string().trim().min(1).max(254),
  layout: z.enum(["Term summary", "Detailed subjects", "Skills & remarks"]),
  footer: z.string().trim().min(1).max(4000),
});
export const reportTemplatesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("report-templates"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: reportTemplatesValuesSchema,
});
export const moderationValuesSchema = z.strictObject({
  examId: identifierSchema,
  subjectId: identifierSchema,
  remark: z.string().trim().min(1).max(4000),
});
export const moderationRequestSchema = operationBaseSchema.extend({
  kind: z.literal("moderation"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: moderationValuesSchema,
  studentId: identifierSchema,
  staffId: identifierSchema,
});
export const seatingValuesSchema = z.strictObject({
  examId: identifierSchema,
  room: z.string().trim().min(1).max(254),
  seat: z.string().trim().min(1).max(254),
});
export const seatingRequestSchema = operationBaseSchema.extend({
  kind: z.literal("seating"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: seatingValuesSchema,
  studentId: identifierSchema,
});
export const reEvaluationsValuesSchema = z.strictObject({
  examId: identifierSchema,
  subjectId: identifierSchema,
  reason: z.string().trim().min(1).max(4000),
  decision: z.string().trim().min(1).max(4000),
});
export const reEvaluationsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("re-evaluations"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: reEvaluationsValuesSchema,
  studentId: identifierSchema,
});
