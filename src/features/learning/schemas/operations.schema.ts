import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const resourcesValuesSchema = z.strictObject({
  classSectionId: identifierSchema,
  url: z
    .url()
    .max(2000)
    .refine((v) => v.startsWith("https://"), "Use an HTTPS URL."),
  description: z.string().trim().min(1).max(4000),
});
export const resourcesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("resources"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: resourcesValuesSchema,
});
export const liveClassesValuesSchema = z.strictObject({
  classSectionId: identifierSchema,
  url: z
    .url()
    .max(2000)
    .refine((v) => v.startsWith("https://"), "Use an HTTPS URL."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM in 24-hour time."),
});
export const liveClassesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("live-classes"),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  values: liveClassesValuesSchema,
  staffId: identifierSchema,
});
export const quizzesValuesSchema = z.strictObject({
  classSectionId: identifierSchema,
  question: z.string().trim().min(1).max(4000),
  answer: z.string().trim().min(1).max(254),
  maxScore: z.number().int().min(1).max(100),
  gradingMode: z.enum(["Manual", "Exact answer"]).default("Manual"),
  maxAttempts: z.number().int().min(1).max(10).default(1),
});
export const quizzesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("quizzes"),
  status: z.enum(["draft", "published", "closed", "cancelled"]),
  values: quizzesValuesSchema,
});
export const quizAttemptsValuesSchema = z.strictObject({
  quizId: identifierSchema,
  response: z.string().trim().min(1).max(4000),
  score: z.number().int().min(0).max(100),
  feedback: z.string().trim().max(1000).default(""),
});
export const quizAttemptsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("quiz-attempts"),
  status: z.enum(["submitted", "graded", "cancelled"]),
  values: quizAttemptsValuesSchema,
  studentId: identifierSchema,
});
