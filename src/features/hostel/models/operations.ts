import type { z } from "zod";
import type { bedsRequestSchema } from "../schemas/operations.schema.ts";
export type BedsRequest = z.infer<typeof bedsRequestSchema>;
import type { hostelAllocationsRequestSchema } from "../schemas/operations.schema.ts";
export type HostelAllocationsRequest = z.infer<
  typeof hostelAllocationsRequestSchema
>;
import type { rollCallRequestSchema } from "../schemas/operations.schema.ts";
export type RollCallRequest = z.infer<typeof rollCallRequestSchema>;
import type { outpassesRequestSchema } from "../schemas/operations.schema.ts";
export type OutpassesRequest = z.infer<typeof outpassesRequestSchema>;
import type { hostelVisitorsRequestSchema } from "../schemas/operations.schema.ts";
export type HostelVisitorsRequest = z.infer<typeof hostelVisitorsRequestSchema>;
import type { messRequestSchema } from "../schemas/operations.schema.ts";
export type MessRequest = z.infer<typeof messRequestSchema>;
