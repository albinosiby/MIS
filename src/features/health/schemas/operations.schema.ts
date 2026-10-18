import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const clinicValuesSchema = z.strictObject({
  complaint: z.string().trim().min(1).max(4000),
  care: z.string().trim().min(1).max(4000),
  guardianNotified: z.enum(["Pending", "Yes", "Not required"]),
});
export const clinicRequestSchema = operationBaseSchema.extend({
  kind: z.literal("clinic"),
  status: z.enum(["open", "reviewed", "closed", "cancelled"]),
  values: clinicValuesSchema,
  studentId: identifierSchema,
});
export const medicationValuesSchema = z.strictObject({
  medication: z.string().trim().min(1).max(254),
  authorisation: z.string().trim().min(1).max(254),
  administration: z.string().trim().min(1).max(4000),
});
export const medicationRequestSchema = operationBaseSchema.extend({
  kind: z.literal("medication"),
  status: z.enum(["scheduled", "administered", "missed", "cancelled"]),
  values: medicationValuesSchema,
  studentId: identifierSchema,
});
export const immunisationsValuesSchema = z.strictObject({
  recordType: z.enum(["Immunisation", "Health check"]),
  provider: z.string().trim().min(1).max(254),
  note: z.string().trim().min(1).max(4000),
});
export const immunisationsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("immunisations"),
  status: z.enum(["pending", "verified", "cancelled"]),
  values: immunisationsValuesSchema,
  studentId: identifierSchema,
});
