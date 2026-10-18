import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const alumniValuesSchema = z.strictObject({
  email: z.email().max(254),
  graduationYear: z.number().int().min(1950).max(2100),
  request: z.string().trim().min(1).max(4000),
});
export const alumniRequestSchema = operationBaseSchema.extend({
  kind: z.literal("alumni"),
  status: z.enum(["requested", "reviewed", "completed", "cancelled"]),
  values: alumniValuesSchema,
});
