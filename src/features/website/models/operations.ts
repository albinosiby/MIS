import type { z } from "zod";
import type { cmsPagesRequestSchema } from "../schemas/operations.schema.ts";
export type CmsPagesRequest = z.infer<typeof cmsPagesRequestSchema>;
import type { cmsNewsRequestSchema } from "../schemas/operations.schema.ts";
export type CmsNewsRequest = z.infer<typeof cmsNewsRequestSchema>;
import type { domainsRequestSchema } from "../schemas/operations.schema.ts";
export type DomainsRequest = z.infer<typeof domainsRequestSchema>;
