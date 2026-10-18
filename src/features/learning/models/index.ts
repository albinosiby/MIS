export type * from "./operations.ts";

import type { z } from "zod";
import type {
  learningProgressSchema,
  learningProgressRequestSchema,
  quizGradeRequestSchema,
} from "../schemas/progress.schema.ts";
export type LearningProgress = z.infer<typeof learningProgressSchema>;
export type LearningProgressRequest = z.infer<
  typeof learningProgressRequestSchema
>;
export type QuizGradeRequest = z.infer<typeof quizGradeRequestSchema>;
