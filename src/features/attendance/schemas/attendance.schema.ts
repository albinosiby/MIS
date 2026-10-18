import { z } from "zod";
import {
  scopedRecordSchema,
  dateSpanSchema,
} from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const attendanceRecordSchema = scopedRecordSchema.extend({
  personType: z.enum(["student", "staff"]),
  personId: identifierSchema,
  date: localDateSchema,
  periodId: identifierSchema.nullable(),
  status: z.enum(["present", "absent", "late", "excused"]),
  note: z.string().trim().max(300),
});
export const leaveRequestSchema = scopedRecordSchema.extend({
  personType: z.enum(["student", "staff"]),
  personId: identifierSchema,
  dates: dateSpanSchema,
  reason: z.string().trim().min(8).max(500),
  leaveType:z.string().trim().min(2).max(60).optional(),
  paid:z.boolean().optional(),
  status: z.enum(["pending", "approved", "rejected"]),
  decisionNote: z.string().trim().max(500),
});
export const attendanceBatchRequestSchema = z.strictObject({
  schoolId: identifierSchema,
  academicYearId: identifierSchema,
  classSectionId: identifierSchema.nullable(),
  personType: z.enum(["student", "staff"]),
  date: localDateSchema,
  periodId: identifierSchema.nullable(),
  entries: z
    .array(
      z.strictObject({
        personId: identifierSchema,
        status: z.enum(["present", "absent", "late", "excused"]),
        note: z.string().trim().max(300),
      }),
    )
    .min(1)
    .max(2000),
});
