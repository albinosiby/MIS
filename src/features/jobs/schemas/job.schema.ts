import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const jobKindSchema = z.enum([
  "message-delivery",
  "notice-delivery",
  "attendance-alert",
  "report-export",
]);
export const durableJobSchema = z.object({
  id: z.uuid(),
  school_id: identifierSchema,
  created_by: z.uuid().nullable(),
  kind: jobKindSchema,
  payload: z.record(z.string(), z.unknown()),
  dedupe_key: z.string().min(1).max(250),
  status: z.enum([
    "pending",
    "running",
    "retry",
    "completed",
    "failed",
    "cancelled",
    "blocked",
  ]),
  run_at: z.iso.datetime({ offset: true }),
  attempts: z.number().int().min(0).max(10),
  max_attempts: z.number().int().min(1).max(10),
  lease_token: z.uuid().nullable(),
  lease_until: z.iso.datetime({ offset: true }).nullable(),
  last_error: z.string().max(500).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
});
export const jobControlSchema = z.strictObject({
  id: z.uuid(),
  action: z.enum(["retry", "cancel"]),
});
export const jobAttemptSchema = z.object({
  id: z.number().int(),
  job_id: z.uuid(),
  attempt: z.number().int(),
  outcome: z.enum(["completed", "retry", "failed", "cancelled", "blocked"]),
  detail: z.string().max(500),
  created_at: z.iso.datetime({ offset: true }),
});

export const jobConsoleResponseSchema = z.object({
  jobs: durableJobSchema
    .omit({
      payload: true,
      lease_token: true,
      lease_until: true,
      created_by: true,
    })
    .array(),
  attempts: jobAttemptSchema.array(),
  providers: z.record(z.string(), z.string()),
});
