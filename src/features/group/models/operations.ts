import type { z } from "zod";
import type { groupPoliciesRequestSchema } from "../schemas/operations.schema.ts";
export type GroupPoliciesRequest = z.infer<typeof groupPoliciesRequestSchema>;
