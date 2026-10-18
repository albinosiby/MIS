import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const portalLeaveSchema = z
  .strictObject({
    personId: identifierSchema,
    leaveType:z.string().trim().min(2).max(60).optional(),
    startDate: localDateSchema,
    endDate: localDateSchema,
    reason: z.string().trim().min(8).max(500),
  })
  .refine((v) => v.startDate <= v.endDate, {
    path: ["endDate"],
    message: "Return date cannot precede start date.",
  });
export const portalSubmissionSchema = z.strictObject({
  homeworkId: identifierSchema,
  studentId: identifierSchema,
  answer: z.string().trim().min(8).max(4000),
});
export const portalAttendanceSchema = z.strictObject({
  classSectionId: identifierSchema,
  date: localDateSchema,
  entries: z
    .array(
      z.strictObject({
        studentId: identifierSchema,
        status: z.enum(["present", "absent", "late", "excused"]),
      }),
    )
    .min(1)
    .max(2000),
});
export const portalGradeSchema = z.strictObject({
  submissionId: identifierSchema,
  score: z.number().min(0).max(1000),
  feedback: z.string().trim().max(1000),
});
export const portalMarkSchema = z.strictObject({
  examId: identifierSchema,
  studentId: identifierSchema,
  subjectId: identifierSchema,
  marks: z.number().min(0).max(1000),
  remark: z.string().trim().max(300),
});
