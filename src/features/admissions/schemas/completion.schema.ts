import { z } from "zod";
import { identifierSchema, localDateSchema } from "../../../shared/schemas/primitives.ts";
export const continuationRequestSchema = z.strictObject({
  studentId: identifierSchema,
  decision: z.enum(["promote", "retain", "transfer"]),
  targetClassId: identifierSchema,
  note: z.string().trim().min(8).max(500),
});
export const withdrawalRequestSchema = z.strictObject({
  studentId: identifierSchema,
  date: localDateSchema,
  note: z.string().trim().min(8).max(500),
  feeTreatment: z.enum(["retain-balance", "void-uncollected"]),
});
export const admissionDecisionSchema = z.strictObject({
  id: identifierSchema,
  studentId: identifierSchema,
  kind: z.enum(["promote", "retain", "transfer", "withdrawn"]),
  targetClassId: identifierSchema.nullable(),
  note: z.string().trim().min(8).max(500),
  feeTreatment: z.enum(["retain-balance", "void-uncollected"]).nullable(),
  affectedInvoiceIds: z.array(identifierSchema).max(5000),
  actorId: identifierSchema,
  recordedAt: z.iso.datetime(),
});
export const admissionHandoffSchema = z.strictObject({
  applicationId: identifierSchema,
  role: z.enum(["parent", "student"]),
  personId: identifierSchema,
  email: z.email().max(254),
  authorityVerified: z.literal(true),
});
