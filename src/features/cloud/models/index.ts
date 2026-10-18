import type { z } from "zod";
import type {
  cloudCommandSchema,
  cloudActionResultSchema,
  publicCloudCommandSchema,
  cloudProjectionSchema,
  membershipSchema,
} from "../schemas/cloud.schema.ts";
export type CloudCommand = z.infer<typeof cloudCommandSchema>;
/** Screen projection. Withheld collections are empty; this is not a canonical entity. */
export type CloudWorkspaceProjection = z.infer<typeof cloudProjectionSchema>;
export type Membership = z.infer<typeof membershipSchema>;

export type PublicCloudCommand = z.infer<typeof publicCloudCommandSchema>;

export type CloudActionResult = z.infer<typeof cloudActionResultSchema>;
