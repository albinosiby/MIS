import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const groupPoliciesValuesSchema = z.strictObject({
  scope: z.enum(["Academic", "Finance", "HR", "Communication"]),
  policy: z.string().trim().min(1).max(4000),
});
export const groupPoliciesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("group-policies"),
  status: z.enum(["draft", "approved", "cancelled"]),
  values: groupPoliciesValuesSchema,
});
