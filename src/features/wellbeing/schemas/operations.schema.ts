import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const incidentsValuesSchema = z.strictObject({
  category: z.enum(["Positive", "Classroom", "Safety", "Attendance", "Other"]),
  details: z.string().trim().min(1).max(4000),
  action: z.string().trim().min(1).max(4000),
});
export const incidentsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("incidents"),
  status: z.enum(["reported", "reviewed", "resolved", "cancelled"]),
  values: incidentsValuesSchema,
  studentId: identifierSchema,
});
export const housePointsValuesSchema = z.strictObject({
  type: z.enum(["Positive points", "Detention"]),
  points: z.number().int().min(1).max(100),
  reason: z.string().trim().min(1).max(4000),
});
export const housePointsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("house-points"),
  status: z.enum(["draft", "approved", "cancelled"]),
  values: housePointsValuesSchema,
  studentId: identifierSchema,
});
export const counsellingValuesSchema = z.strictObject({
  concern: z.string().trim().min(1).max(4000),
  intervention: z.string().trim().min(1).max(4000),
  reviewDate: localDateSchema,
});
export const counsellingRequestSchema = operationBaseSchema.extend({
  kind: z.literal("counselling"),
  status: z.enum(["open", "review", "closed", "cancelled"]),
  values: counsellingValuesSchema,
  studentId: identifierSchema,
  staffId: identifierSchema,
});
export const iepValuesSchema = z.strictObject({
  goals: z.string().trim().min(1).max(4000),
  adjustments: z.string().trim().min(1).max(4000),
  reviewDate: localDateSchema,
});
export const iepRequestSchema = operationBaseSchema.extend({
  kind: z.literal("iep"),
  status: z.enum(["draft", "active", "reviewed", "cancelled"]),
  values: iepValuesSchema,
  studentId: identifierSchema,
});
export const safeguardingValuesSchema = z.strictObject({
  concern: z.string().trim().min(1).max(4000),
  action: z.string().trim().min(1).max(4000),
  reviewDate: localDateSchema,
});
export const safeguardingRequestSchema = operationBaseSchema.extend({
  kind: z.literal("safeguarding"),
  status: z.enum(["reported", "review", "escalated", "closed", "cancelled"]),
  values: safeguardingValuesSchema,
  studentId: identifierSchema,
});
