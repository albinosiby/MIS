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
export const academicEventSchema = scopedRecordSchema.extend({
  title: displayNameSchema,
  category: z.enum([
    "Academic",
    "Exam",
    "Holiday",
    "PTM",
    "Sports",
    "Deadline",
  ]),
  dates: dateSpanSchema,
  description: z.string().trim().max(1500),
  classSectionIds: z.array(identifierSchema).max(200),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null),
  venue: z.string().trim().max(100).default(""),
  sourceUid: z.string().max(200).nullable().default(null),
  status: z.enum(["draft", "published"]),
});
export const noticeSchema = scopedRecordSchema.extend({
  title: displayNameSchema,
  body: z.string().trim().min(8).max(3000),
  priority: z.enum(["normal", "urgent"]),
  audience: z.enum(["all", "guardians", "staff"]),
  classSectionIds: z.array(identifierSchema).max(200),
  channels: z
    .array(z.enum(["App", "SMS", "WhatsApp", "Email"]))
    .min(1)
    .max(4),
  status: z.enum(["draft", "scheduled", "published"]),
  scheduledFor: localDateSchema.nullable(),
  recipientIds: z.array(identifierSchema).max(5000),
  acknowledgedIds: z.array(identifierSchema).max(5000),
});
export const notificationSchema = scopedRecordSchema.extend({
  title: displayNameSchema,
  body: z.string().trim().max(2000),
  category: z.enum(["urgent", "approvals", "statutory", "finance", "general"]),
  createdAt: z.iso.datetime(),
  read: z.boolean(),
  href: z.string().startsWith("/").max(200),
});
export const reportKeys = [
  "students",
  "attendance",
  "fees",
  "marks",
  "staff",
  "notices",
  "audit",
  "guardians",
  "period-attendance",
  "staff-attendance",
  "leaves",
  "calendar",
  "admissions",
  "admission-sources",
  "exam-schedule",
  "payments",
  "concessions",
  "promotions",
  "staff-documents",
  "class-capacity",
  "allocations",
  "syllabus",
  "lessons",
  "homework",
  "certificates",
  "notice-recipients",
  "roles",
  "enrolments",
  "reenrolment",
  "room-reservations",
  "health",
  "transport",
] as const;
export const exportJobSchema = scopedRecordSchema.extend({
  report: z.enum(reportKeys),
  createdAt: z.iso.datetime(),
  format: z.literal("csv"),
  rowCount: z.number().int().nonnegative(),
  status: z.literal("ready"),
  content: z.string().max(5_000_000).default(""),
  filename: z.string().max(120).default("report.csv"),
});

export const reportScheduleSchema = scopedRecordSchema.extend({
  report: z.enum(reportKeys),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  nextRun: localDateSchema,
  enabled: z.boolean(),
  recipientIds: z.array(identifierSchema).max(200),
  lastRun: localDateSchema.nullable(),
});
