import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const documentOwnerTypeSchema = z.enum([
  "school",
  "student",
  "staff",
  "admission",
]);
export const MAX_DOCUMENT_BYTES = 5_000_000;
export const documentCategorySchema = z.enum([
  "general",
  "identity",
  "academic",
  "employment",
  "medical",
  "counselling",
  "finance",
]);
export const documentUploadSchema = z.strictObject({
  yearId: identifierSchema,
  ownerType: documentOwnerTypeSchema,
  ownerId: identifierSchema,
  category: documentCategorySchema,
  replacesId: z.uuid().nullable().default(null),
});
export const privateDocumentSchema = z.strictObject({
  id: z.uuid(),
  school_id: identifierSchema,
  academic_year_id: identifierSchema,
  owner_type: documentOwnerTypeSchema,
  owner_id: identifierSchema,
  category: documentCategorySchema,
  filename: z.string().min(1).max(180),
  mime_type: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  byte_size: z.number().int().min(1).max(MAX_DOCUMENT_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  object_path: z.string().min(1).max(500),
  created_by: z.uuid(),
  status: z.enum([
    "uploading",
    "ready",
    "superseded",
    "revoked",
    "deleting",
    "deleted",
  ]),
  version: z.number().int().positive(),
  replaces_id: z.uuid().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  retain_until: z.iso.datetime({ offset: true }),
});
/** Permitted list projection; object paths and uploader IDs stay on the server. */
export const privateDocumentSummarySchema = privateDocumentSchema
  .omit({ object_path: true, created_by: true, sha256: true })
  .extend({ isUploader: z.boolean() });
export const documentMutationSchema = z.strictObject({
  action: z.enum(["revoke", "purge", "resume", "discard"]),
});

export const documentCursorSchema = z.strictObject({
  at: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export const documentListSchema = z.strictObject({
  files: privateDocumentSummarySchema.array(),
  next: z.string().nullable(),
});
