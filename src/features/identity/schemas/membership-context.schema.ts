import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { roleSchema } from "./identity.schema.ts";
export const membershipContextSchema = z.object({
  membership_id: z.string().min(1).max(128),
  user_id: z.uuid(),
  school_id: identifierSchema,
  role: roleSchema,
  person_id: identifierSchema.nullable(),
  display_name: z.string().min(1).max(160),
  active: z.boolean(),
});
export const contextSelectionSchema = z.strictObject({
  membershipId: z.string().min(1).max(128),
});
export const roleGrantRequestSchema = z.strictObject({
  userId: z.uuid(),
  role: roleSchema,
  personId: identifierSchema.nullable(),
  active: z.boolean(),
});

export const schoolContextsResponseSchema = z.object({
  contexts: z.array(
    z.object({
      id: z.string(),
      schoolId: z.string(),
      schoolName: z.string(),
      role: roleSchema,
      personId: z.string().nullable(),
      current: z.boolean(),
    }),
  ),
});

export const contextSelectionResponseSchema=z.strictObject({href:z.string().startsWith("/")});

export const roleGrantListResponseSchema = z.object({
  grants: z.array(
    z.object({
      id: z.uuid(),
      user_id: z.uuid(),
      role: roleSchema.refine(r=>!["platform","group"].includes(r)),
      person_id: z.string().nullable(),
      display_name: z.string(),
      active: z.boolean(),
    }),
  ),
});
