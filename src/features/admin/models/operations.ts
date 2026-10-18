import type { z } from "zod";
import type { supportTicketsRequestSchema } from "../schemas/operations.schema.ts";
export type SupportTicketsRequest = z.infer<typeof supportTicketsRequestSchema>;
import type { tenantRequestsRequestSchema } from "../schemas/operations.schema.ts";
export type TenantRequestsRequest = z.infer<typeof tenantRequestsRequestSchema>;
import type { plansRequestSchema } from "../schemas/operations.schema.ts";
export type PlansRequest = z.infer<typeof plansRequestSchema>;
import type { supportGrantsRequestSchema } from "../schemas/operations.schema.ts";
export type SupportGrantsRequest = z.infer<typeof supportGrantsRequestSchema>;
