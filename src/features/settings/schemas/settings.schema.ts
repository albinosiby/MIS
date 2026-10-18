import { z } from "zod";
import { scopedRecordSchema } from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  displayNameSchema,
} from "../../../shared/schemas/primitives.ts";
export const preferenceSchema = z.strictObject({
  language: z.enum(["English", "Hindi"]),
  dateFormat: z.enum(["DD MMM YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
  workingDays: z
    .array(
      z.enum([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]),
    )
    .min(1)
    .max(7),
  principalBio: z.string().trim().max(2000),
  qualification: z.string().trim().max(300),
  emergencyAlerts: z.boolean(),
  auditAlerts: z.boolean(),
  weeklyDigest: z.boolean(),
  schoolCode: z.string().trim().max(50),
  letterheadFooter: z.string().trim().max(300),
  demoMfa: z.boolean().default(false),
});
export const approvalSchema = scopedRecordSchema.extend({
  title: displayNameSchema,
  category: z.enum([
    "leave",
    "concession",
    "exam_unlock",
    "gate_pass",
    "purchase",
  ]),
  requesterId: identifierSchema,
  targetId: identifierSchema.nullable(),
  reason: z.string().trim().min(8).max(1000),
  amountMinor: z.number().int().nonnegative(),
  status: z.enum(["pending", "approved", "rejected"]),
  decisionNote: z.string().trim().max(500),
});

export const rolloverRequestSchema = z
  .strictObject({
    name: displayNameSchema,
    startDate: z.string().date(),
    endDate: z.string().date(),
    acknowledged: z.literal(true),
  })
  .refine((v) => v.startDate < v.endDate, {
    path: ["endDate"],
    message: "Academic year must end after it starts",
  });
