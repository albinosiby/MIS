import type { z } from "zod";
import type { integrationsRequestSchema } from "../schemas/operations.schema.ts";
export type IntegrationsRequest = z.infer<typeof integrationsRequestSchema>;
import type { webhooksRequestSchema } from "../schemas/operations.schema.ts";
export type WebhooksRequest = z.infer<typeof webhooksRequestSchema>;
import type { modulesRequestSchema } from "../schemas/operations.schema.ts";
export type ModulesRequest = z.infer<typeof modulesRequestSchema>;
import type { billingRequestSchema } from "../schemas/operations.schema.ts";
export type BillingRequest = z.infer<typeof billingRequestSchema>;
