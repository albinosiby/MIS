import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { publicationSchema } from "./publication.schema.ts";
/** Permitted register projection; issued document contents are downloaded separately. */
export const publicationSummarySchema = publicationSchema
  .omit({ snapshot: true, issuedBy: true })
  .extend({ ownerName: z.string().max(160) });
export const publicationListResponseSchema = z.strictObject({
  publications: publicationSummarySchema.array().max(100),
  next: z.number().int().nonnegative().nullable(),
});
export const publicationListRequestSchema = z.strictObject({
  yearId: identifierSchema,
  offset: z.number().int().min(0).max(10000).default(0),
  search: z.string().trim().max(100).default(""),
});
export const publicationRevokeRequestSchema = z.strictObject({
  yearId: identifierSchema,
  reason: z.string().trim().min(8).max(500),
});
export const publicationRevocationSchema = z.object({
  school_id: identifierSchema,
  academic_year_id: identifierSchema,
  publication_id: identifierSchema,
  reference: identifierSchema,
  reason: z.string().min(8).max(500),
  revoked_by: z.uuid(),
  revoked_at: z.iso.datetime({ offset: true }),
});

export const publicationDownloadRequestSchema = z.strictObject({
  yearId: identifierSchema,
  format: z.enum(["pdf", "xlsx"]).default("pdf"),
});
