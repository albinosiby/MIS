import { z } from "zod";
import {
  scopedRecordSchema,
  attachmentSchema,
} from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  displayNameSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const syllabusUnitSchema = scopedRecordSchema
  .extend({
    subjectId: identifierSchema,
    classSectionId: identifierSchema,
    title: displayNameSchema,
    description: z.string().trim().max(1000),
    plannedPeriods: z.number().int().min(1).max(200),
    completedPeriods: z.number().int().nonnegative().max(200),
  })
  .refine((v) => v.completedPeriods <= v.plannedPeriods, {
    path: ["completedPeriods"],
    message: "Completed periods cannot exceed planned periods",
  });
export const lessonPlanSchema = scopedRecordSchema.extend({
  unitId: identifierSchema,
  staffId: identifierSchema,
  title: displayNameSchema,
  date: localDateSchema,
  objectives: z.string().trim().min(8).max(2000),
  status: z.enum(["draft", "submitted", "approved", "returned"]),
});
export const homeworkSchema = scopedRecordSchema.extend({
  classSectionId: identifierSchema,
  subjectId: identifierSchema,
  staffId: identifierSchema,
  title: displayNameSchema,
  instructions: z.string().trim().min(8).max(2000),
  dueDate: localDateSchema,
  maxScore: z.number().int().min(1).max(1000),
  attachments: z.array(attachmentSchema).max(10),
});
export const homeworkSubmissionSchema = scopedRecordSchema.extend({
  homeworkId: identifierSchema,
  studentId: identifierSchema,
  status: z.enum(["pending", "submitted", "graded"]),
  score: z.number().min(0).max(1000).nullable(),
  feedback: z.string().trim().max(1000),
  answer: z.string().trim().max(4000).default(""),
});
