import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const visitorsValuesSchema = z.strictObject({
  visitor: z.string().trim().min(1).max(254),
  host: z.string().trim().min(1).max(254),
  purpose: z.string().trim().min(1).max(4000),
});
export const visitorsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("visitors"),
  status: z.enum(["checked-in", "checked-out", "cancelled"]),
  values: visitorsValuesSchema,
});
export const gatePassesValuesSchema = z.strictObject({
  collector: z.string().trim().min(1).max(254),
  authorisation: z.string().trim().min(1).max(254),
  reason: z.string().trim().min(1).max(4000),
});
export const gatePassesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("gate-passes"),
  status: z.enum(["requested", "approved", "used", "cancelled"]),
  values: gatePassesValuesSchema,
  studentId: identifierSchema,
});
export const appointmentsValuesSchema = z.strictObject({
  contact: z.string().trim().min(1).max(254),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM in 24-hour time."),
  purpose: z.string().trim().min(1).max(4000),
});
export const appointmentsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("appointments"),
  status: z.enum(["requested", "confirmed", "completed", "cancelled"]),
  values: appointmentsValuesSchema,
});
