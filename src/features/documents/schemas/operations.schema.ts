import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const documentRequestsValuesSchema = z.strictObject({
  type: z.enum([
    "Bona fide",
    "Transfer certificate",
    "Fee certificate",
    "Transcript",
    "Other",
  ]),
  reason: z.string().trim().min(1).max(4000),
});
export const documentRequestsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("document-requests"),
  status: z.enum(["requested", "approved", "issued", "cancelled"]),
  values: documentRequestsValuesSchema,
  studentId: identifierSchema,
});
export const documentRegisterValuesSchema = z.strictObject({
  filename: z.string().trim().min(1).max(254),
  category: z.enum(["Identity", "Academic", "Consent", "Other"]),
  review: z.string().trim().min(1).max(4000),
});
export const documentRegisterRequestSchema = operationBaseSchema.extend({
  kind: z.literal("document-register"),
  status: z.enum(["pending", "verified", "rejected", "cancelled"]),
  values: documentRegisterValuesSchema,
  studentId: identifierSchema,
});
export const certificateTemplatesValuesSchema = z.strictObject({
  prefix: z.string().trim().min(1).max(254),
  body: z.string().trim().min(1).max(4000),
});
export const certificateTemplatesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("certificate-templates"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: certificateTemplatesValuesSchema,
});
