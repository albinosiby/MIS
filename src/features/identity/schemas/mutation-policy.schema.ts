import { z } from "zod";
import { roleSchema } from "./identity.schema.ts";
import { mutationCapabilitySchema } from "../../../shared/schemas/permissions.ts";
export { mutationCapabilitySchema };
export const mutationPolicySchema = z
  .strictObject({
    role: roleSchema,
    blocked: z.array(mutationCapabilitySchema).max(9),
  })
  .refine((v) => new Set(v.blocked).size === v.blocked.length, {
    message: "Restrictions must be unique.",
  });
