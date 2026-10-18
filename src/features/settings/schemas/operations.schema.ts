import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const integrationsValuesSchema = z.strictObject({
  provider: z.string().trim().min(1).max(254),
  purpose: z.string().trim().min(1).max(4000),
});
export const integrationsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("integrations"),
  status: z.enum(["unconfigured", "cancelled"]),
  values: integrationsValuesSchema,
});
export const webhooksValuesSchema = z.strictObject({
  url: z
    .url()
    .max(2000)
    .refine((v) => v.startsWith("https://"), "Use an HTTPS URL."),
  event: z.enum(["student.created", "invoice.issued", "attendance.saved"]),
});
export const webhooksRequestSchema = operationBaseSchema.extend({
  kind: z.literal("webhooks"),
  status: z.enum(["draft", "paused", "cancelled"]),
  values: webhooksValuesSchema,
});
export const modulesValuesSchema = z.strictObject({
  module: z.string().trim().min(1).max(254),
  enabled: z.enum(["Enabled", "Disabled"]),
  reason: z.string().trim().min(1).max(4000),
});
export const modulesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("modules"),
  status: z.enum(["requested", "approved", "cancelled"]),
  values: modulesValuesSchema,
});
export const billingValuesSchema = z.strictObject({
  plan: z.enum(["Pilot", "School", "Group"]),
  seats: z.number().int().min(1).max(100000),
});
export const billingRequestSchema = operationBaseSchema.extend({
  kind: z.literal("billing"),
  status: z.enum(["requested", "reviewed", "cancelled"]),
  values: billingValuesSchema,
});
