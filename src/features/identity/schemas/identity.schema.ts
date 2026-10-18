import {mutationCapabilitySchema} from "../../../shared/schemas/permissions.ts";
import { z } from "zod";
import {
  identifierSchema,
  emailSchema,
} from "../../../shared/schemas/primitives.ts";
export const roleSchema = z.enum([
  "admin",
  "principal",
  "teacher",
  "staff",
  "accountant",
  "parent",
  "student",
  "driver",
  "librarian",
  "hr",
  "nurse",
  "counsellor",
  "transport",
  "inventory",
  "warden",
  "platform",
  "group",
]);
export const accountIdentitySchema = z.strictObject({
  id: identifierSchema,
  email: emailSchema,
  name: z.string().min(1).max(160),
  role: roleSchema,
  schoolId: identifierSchema,
  personId: identifierSchema.nullable(),
  blockedMutations:z.array(mutationCapabilitySchema).max(9).optional(),
});
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export const localSessionSchema = z.strictObject({
  identity: accountIdentitySchema,
  expiresAt: z.number().int().positive(),
  version: z.number().int().nonnegative(),
});
