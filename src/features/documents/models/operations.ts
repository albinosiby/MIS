import type { z } from "zod";
import type { documentRequestsRequestSchema } from "../schemas/operations.schema.ts";
export type DocumentRequestsRequest = z.infer<
  typeof documentRequestsRequestSchema
>;
import type { documentRegisterRequestSchema } from "../schemas/operations.schema.ts";
export type DocumentRegisterRequest = z.infer<
  typeof documentRegisterRequestSchema
>;
import type { certificateTemplatesRequestSchema } from "../schemas/operations.schema.ts";
export type CertificateTemplatesRequest = z.infer<
  typeof certificateTemplatesRequestSchema
>;
