import type { z } from "zod";
import type { messageTemplatesRequestSchema } from "../schemas/operations.schema.ts";
export type MessageTemplatesRequest = z.infer<
  typeof messageTemplatesRequestSchema
>;
import type { messagesRequestSchema } from "../schemas/operations.schema.ts";
export type MessagesRequest = z.infer<typeof messagesRequestSchema>;
import type { deliveriesRequestSchema } from "../schemas/operations.schema.ts";
export type DeliveriesRequest = z.infer<typeof deliveriesRequestSchema>;
import type { ptmRequestSchema } from "../schemas/operations.schema.ts";
export type PtmRequest = z.infer<typeof ptmRequestSchema>;
import type { surveysRequestSchema } from "../schemas/operations.schema.ts";
export type SurveysRequest = z.infer<typeof surveysRequestSchema>;
import type { consentsRequestSchema } from "../schemas/operations.schema.ts";
export type ConsentsRequest = z.infer<typeof consentsRequestSchema>;
