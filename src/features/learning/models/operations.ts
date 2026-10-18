import type { z } from "zod";
import type { resourcesRequestSchema } from "../schemas/operations.schema.ts";
export type ResourcesRequest = z.infer<typeof resourcesRequestSchema>;
import type { liveClassesRequestSchema } from "../schemas/operations.schema.ts";
export type LiveClassesRequest = z.infer<typeof liveClassesRequestSchema>;
import type { quizzesRequestSchema } from "../schemas/operations.schema.ts";
export type QuizzesRequest = z.infer<typeof quizzesRequestSchema>;
import type { quizAttemptsRequestSchema } from "../schemas/operations.schema.ts";
export type QuizAttemptsRequest = z.infer<typeof quizAttemptsRequestSchema>;
