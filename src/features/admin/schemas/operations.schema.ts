import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const supportTicketsValuesSchema = z.strictObject({
  requester: z.string().trim().min(1).max(254),
  description: z.string().trim().min(1).max(4000),
});
export const supportTicketsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("support-tickets"),
  status: z.enum(["open", "in-progress", "resolved", "cancelled"]),
  values: supportTicketsValuesSchema,
});
export const tenantRequestsValuesSchema = z.strictObject({
  schoolName: z.string().trim().min(1).max(254),
  country: z.string().trim().min(1).max(254),
  email: z.email().max(254),
});
export const tenantRequestsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("tenant-requests"),
  status: z.enum(["requested", "reviewed", "approved", "cancelled"]),
  values: tenantRequestsValuesSchema,
});
export const plansValuesSchema = z.strictObject({
  priceMinor: z.number().int().min(0).max(100000000),
  studentLimit: z.number().int().min(1).max(100000),
  features: z.string().trim().min(1).max(4000),
});
export const plansRequestSchema = operationBaseSchema.extend({
  kind: z.literal("plans"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: plansValuesSchema,
});
export const supportGrantsValuesSchema = z.strictObject({
  schoolName: z.string().trim().min(1).max(254),
  reason: z.string().trim().min(1).max(4000),
  minutes: z.number().int().min(5).max(60),
});
export const supportGrantsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("support-grants"),
  status: z.enum(["requested", "approved", "expired", "cancelled"]),
  values: supportGrantsValuesSchema,
});
