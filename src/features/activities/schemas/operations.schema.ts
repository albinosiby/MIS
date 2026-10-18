import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const clubsValuesSchema = z.strictObject({
  category: z.enum(["Sport", "Arts", "Science", "Service"]),
  capacity: z.number().int().min(1).max(500),
  description: z.string().trim().min(1).max(4000),
});
export const clubsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("clubs"),
  status: z.enum(["draft", "open", "closed", "cancelled"]),
  values: clubsValuesSchema,
  staffId: identifierSchema,
});
export const activityEnrolmentsValuesSchema = z.strictObject({
  clubId: identifierSchema,
});
export const activityEnrolmentsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("activity-enrolments"),
  status: z.enum(["requested", "approved", "completed", "cancelled"]),
  values: activityEnrolmentsValuesSchema,
  studentId: identifierSchema,
});
export const tripsEventsValuesSchema = z.strictObject({
  destination: z.string().trim().min(1).max(254),
  capacity: z.number().int().min(1).max(2000),
  amountMinor: z.number().int().min(0).max(100000000),
});
export const tripsEventsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("trips-events"),
  status: z.enum(["draft", "open", "completed", "cancelled"]),
  values: tripsEventsValuesSchema,
});
export const achievementsValuesSchema = z.strictObject({
  category: z.string().trim().min(1).max(254),
  description: z.string().trim().min(1).max(4000),
});
export const achievementsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("achievements"),
  status: z.enum(["draft", "verified", "cancelled"]),
  values: achievementsValuesSchema,
  studentId: identifierSchema,
});
