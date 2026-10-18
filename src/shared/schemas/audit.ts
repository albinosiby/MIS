import { z } from "zod";
import { identifierSchema, displayNameSchema } from "./primitives.ts";
/** Display provenance for the local workspace, not proof of server-authorised access. */
export const auditActorSchema = z.strictObject({
  accountId: identifierSchema,
  displayName: displayNameSchema,
  role: z.string().trim().min(1).max(50),
});
