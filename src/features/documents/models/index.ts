export type * from './operations.ts';
import type { z } from "zod";
import type { documentUploadSchema, privateDocumentSchema, privateDocumentSummarySchema } from "../schemas/private-document.schema.ts";
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
export type PrivateDocument = z.infer<typeof privateDocumentSchema>;
export type PrivateDocumentSummary = z.infer<typeof privateDocumentSummarySchema>;
