import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const publicationSchema = z.strictObject({
  id: identifierSchema,
  kind: z.enum([
    "report-card",
    "transcript",
    "certificate",
    "payslip",
    "report",
  ]),
  sourceId: identifierSchema,
  ownerType: z.enum(["student", "staff", "school"]),
  ownerId: identifierSchema,
  version: z.number().int().positive(),
  reference: identifierSchema,
  title: z.string().min(2).max(160),
  issuedBy: identifierSchema,
  issuedAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
  revocationReason: z.string().max(500),
  snapshot: z.record(z.string(), z.unknown()),
});
export const reportBuilderSchema = z.strictObject({
  id: identifierSchema,
  name: z.string().trim().min(2).max(100),
  source: z.enum([
    "students",
    "attendance",
    "fees",
    "marks",
    "staff",
    "admissions",
    "ledger",
    "payroll",
  ]),
  columns: z
    .array(z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,60}$/))
    .min(1)
    .max(30),
  filters: z
    .array(
      z.strictObject({
        field: z.string().regex(/^[A-Za-z][A-Za-z0-9_.]{0,60}$/),
        operator: z.enum(["equals", "contains", "gte", "lte"]),
        value: z.string().max(200),
      }),
    )
    .max(10),
});
export const publishedReportScheduleSchema = z.strictObject({
  id: identifierSchema,
  reportId: identifierSchema,
  frequency: z.enum(["daily", "weekly", "monthly"]),
  nextRun: z.iso.date(),
  enabled: z.boolean(),
  createdBy: z.uuid(),
  lastRun: z.iso.date().nullable(),
  recipientIds: z.array(z.uuid()).min(1).max(30),
});
