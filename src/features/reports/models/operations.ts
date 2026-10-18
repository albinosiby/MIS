import type { z } from "zod";
import type { savedReportsRequestSchema } from "../schemas/operations.schema.ts";
export type SavedReportsRequest = z.infer<typeof savedReportsRequestSchema>;
import type { statutoryRequestSchema } from "../schemas/operations.schema.ts";
export type StatutoryRequest = z.infer<typeof statutoryRequestSchema>;
