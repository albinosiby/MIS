import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const learningProgressSchema = z.strictObject({
  id: identifierSchema,
  studentId: identifierSchema,
  resourceId: identifierSchema,
  state: z.enum(["started", "completed"]),
  updatedAt: z.iso.datetime(),
  actorId: identifierSchema,
});
export const learningProgressRequestSchema = z.strictObject({
  resourceId: identifierSchema,
  state: learningProgressSchema.shape.state,
});
export const quizGradeRequestSchema = z.strictObject({
  id: identifierSchema,
  score: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(2).max(1000),
});
