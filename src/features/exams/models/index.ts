import type { z } from "zod";
import type {
  examCycleSchema,
  examPaperSchema,
  examMarkSchema,
  marksBatchRequestSchema,
} from "../schemas/exams.schema.ts";
export type ExamCycle = z.infer<typeof examCycleSchema>;
export type ExamPaper = z.infer<typeof examPaperSchema>;
export type ExamMark = z.infer<typeof examMarkSchema>;
export type MarksBatchRequest = z.infer<typeof marksBatchRequestSchema>;
export type ResultReview = z.infer<typeof import("../schemas/review.schema.ts").resultReviewSchema>;
export type ResultReviewRequest = z.infer<typeof import("../schemas/review.schema.ts").resultReviewRequestSchema>;
