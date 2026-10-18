import type { z } from "zod";
import type { gradingScalesRequestSchema } from "../schemas/operations.schema.ts";
export type GradingScalesRequest = z.infer<typeof gradingScalesRequestSchema>;
import type { reportTemplatesRequestSchema } from "../schemas/operations.schema.ts";
export type ReportTemplatesRequest = z.infer<
  typeof reportTemplatesRequestSchema
>;
import type { moderationRequestSchema } from "../schemas/operations.schema.ts";
export type ModerationRequest = z.infer<typeof moderationRequestSchema>;
import type { seatingRequestSchema } from "../schemas/operations.schema.ts";
export type SeatingRequest = z.infer<typeof seatingRequestSchema>;
import type { reEvaluationsRequestSchema } from "../schemas/operations.schema.ts";
export type ReEvaluationsRequest = z.infer<typeof reEvaluationsRequestSchema>;
