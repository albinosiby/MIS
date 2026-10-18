import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const cmsPagesValuesSchema = z.strictObject({
  slug: z.string().trim().min(1).max(254),
  body: z.string().trim().min(1).max(4000),
});
export const cmsPagesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("cms-pages"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: cmsPagesValuesSchema,
});
export const cmsNewsValuesSchema = z.strictObject({
  body: z.string().trim().min(1).max(4000),
  imageUrl: z
    .url()
    .max(2000)
    .refine((v) => v.startsWith("https://"), "Use an HTTPS URL."),
});
export const cmsNewsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("cms-news"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: cmsNewsValuesSchema,
});
export const domainsValuesSchema = z.strictObject({
  domain: z.string().trim().min(1).max(254),
  description: z.string().trim().min(1).max(4000),
});
export const domainsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("domains"),
  status: z.enum(["unconfigured", "cancelled"]),
  values: domainsValuesSchema,
});
