import { z } from "zod";
import {
  scopedRecordSchema,
  dateSpanSchema,
} from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  displayNameSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const examCycleSchema = scopedRecordSchema
  .extend({
    name: displayNameSchema,
    dates: dateSpanSchema,
    classSectionIds: z.array(identifierSchema).min(1).max(200),
    subjectIds: z.array(identifierSchema).min(1).max(50),
    maxMarks: z.number().int().min(1).max(1000),
    passMarks: z.number().int().min(0).max(1000),
    status: z.enum(["draft", "published", "completed"]),
  })
  .refine((v) => v.passMarks <= v.maxMarks, {
    path: ["passMarks"],
    message: "Pass marks cannot exceed maximum marks",
  });
export const examPaperSchema = scopedRecordSchema.extend({
  examId: identifierSchema,
  classSectionId: identifierSchema,
  subjectId: identifierSchema,
  date: localDateSchema,
  periodId: identifierSchema,
  room: displayNameSchema,
  invigilatorId: identifierSchema,
});
export const examMarkSchema = scopedRecordSchema.extend({
  examId: identifierSchema,
  subjectId: identifierSchema,
  studentId: identifierSchema,
  marks: z.number().min(0).max(1000),
  remark: z.string().trim().max(300),
});
export const marksBatchRequestSchema = z.strictObject({
  schoolId: identifierSchema,
  academicYearId: identifierSchema,
  examId: identifierSchema,
  subjectId: identifierSchema,
  classSectionId: identifierSchema,
  entries: z
    .array(
      z.strictObject({
        studentId: identifierSchema,
        marks: z.number().min(0).max(1000).nullable(),
      }),
    )
    .min(1)
    .max(2000),
});
