import type { z } from "zod";
import type { alumniRequestSchema } from "../schemas/operations.schema.ts";
export type AlumniRequest = z.infer<typeof alumniRequestSchema>;
