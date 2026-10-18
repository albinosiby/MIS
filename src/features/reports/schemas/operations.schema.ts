import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const savedReportsValuesSchema = z.strictObject({
  source: z.enum(["Students", "Attendance", "Invoices", "Staff"]),
  filter: z.string().trim().min(1).max(254),
  columns: z.string().trim().min(1).max(254),
});
export const savedReportsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("saved-reports"),
  status: z.enum(["draft", "saved", "cancelled"]),
  values: savedReportsValuesSchema,
});
export const statutoryValuesSchema = z.strictObject({
  pack: z.enum(["UDISE+", "CBSE", "Other"]),
  period: z.string().trim().min(1).max(254),
  note: z.string().trim().min(1).max(4000),
});
export const statutoryRequestSchema = operationBaseSchema.extend({
  kind: z.literal("statutory"),
  status: z.enum(["draft", "reviewed", "cancelled"]),
  values: statutoryValuesSchema,
});
