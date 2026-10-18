import type { z } from "zod";
import type {
  institutionCreateSchema,
  accountCreateSchema,
  platformCommandSchema,
  platformListSchema,
  institutionRowSchema,
  ticketSchema,
  ticketDetailSchema,
  supportCreateSchema,
} from "../schemas/platform.schema.ts";
export type InstitutionCreate = z.infer<typeof institutionCreateSchema>;
export type AccountCreate = z.infer<typeof accountCreateSchema>;
export type PlatformCommand = z.infer<typeof platformCommandSchema>;
export type PlatformList = z.infer<typeof platformListSchema>;
export type InstitutionSummary = z.infer<typeof institutionRowSchema>;
export type SupportTicket = z.infer<typeof ticketSchema>;
export type SupportDetail = z.infer<typeof ticketDetailSchema>;
export type SupportCreate = z.infer<typeof supportCreateSchema>;
export type InstitutionCreateResponse = z.infer<
  typeof import("../schemas/platform.schema.ts").institutionCreateResponseSchema
>;
export type ActivationResponse = z.infer<
  typeof import("../schemas/platform.schema.ts").activationResponseSchema
>;
