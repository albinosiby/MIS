import { admissionTransitionSchema } from "../../admissions/schemas/admission-command.schema.ts";
import { inquirySchema } from "../../admissions/schemas/admissions.schema.ts";
import { enrolStudentRequestSchema } from "../../students/schemas/students.schema.ts";
import { workflowCommandSchema } from "../../workspace/schemas/workflow-command.schema.ts";
import { workflowStateSchema } from "../../workspace/schemas/workflow-state.schema.ts";
import { staffSummarySchema } from "../../../shared/schemas/people.ts";
import {
  generateInvoicesRequestSchema,
  paymentSchema,
} from "../../fees/schemas/fees.schema.ts";
import { rolloverRequestSchema } from "../../settings/schemas/settings.schema.ts";
import { approvalSchema } from "../../settings/schemas/settings.schema.ts";
import {
  attendanceBatchRequestSchema,
  leaveRequestSchema,
} from "../../attendance/schemas/attendance.schema.ts";
import {
  staffProfileSchema,
  staffOnboardRequestSchema,
} from "../../staff/schemas/staff.schema.ts";
import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
import { setupConfigSchema } from "../../school-setup/schemas/setup-config.schema.ts";
import { moduleRecordsSchema } from "../../workspace/schemas/workspace.schema.ts";
import {
  operationRecordSchema,
  operationRequestSchema,
} from "../../operations/schemas/operations.schema.ts";
import {
  portalLeaveSchema,
  portalSubmissionSchema,
  portalAttendanceSchema,
  portalGradeSchema,
  portalMarkSchema,
} from "../../portals/schemas/portal.schema.ts";
import { roleSchema } from "../../identity/schemas/identity.schema.ts";
export const membershipSchema = z.object({
  user_id: z.uuid(),
  school_id: identifierSchema,
  role: roleSchema,
  person_id: identifierSchema.nullable(),
  display_name: z.string().min(1).max(160),
  active: z.boolean(),
});
// This is a permitted screen projection, not a canonical school workspace. Empty
// collections represent withheld records and must not be parsed as a complete school.
const projectedSetupSchema = z.strictObject({
  ...setupConfigSchema.shape,
  classes: z.array(setupConfigSchema.shape.classes.element).max(200),
  staff: z.array(setupConfigSchema.shape.staff.element).max(200),
  allocations: z.array(setupConfigSchema.shape.allocations.element).max(500),
  fees: z.array(setupConfigSchema.shape.fees.element).max(50),
});
export const cloudProjectionSchema = z.strictObject({
  version: z.literal(2),
  revision: z.number().int().nonnegative(),
  activeYearId: identifierSchema,
  years: z
    .array(
      z.strictObject({
        setup: projectedSetupSchema,
        records: moduleRecordsSchema,
        extensions: z.array(operationRecordSchema),
        locked: z.boolean(),
        workflows: workflowStateSchema.default(() =>
          workflowStateSchema.parse({}),
        ),
      }),
    )
    .min(1)
    .max(10),
});
export const cloudCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("admission-save"), input: inquirySchema }),
  z.strictObject({
    type: z.literal("admission-progress"),
    input: admissionTransitionSchema,
  }),
  z.strictObject({
    type: z.literal("student-enrol"),
    input: enrolStudentRequestSchema,
  }),
  z.strictObject({
    type: z.literal("year-rollover"),
    input: rolloverRequestSchema,
  }),
  z.strictObject({ type: z.literal("workflow"), input: workflowCommandSchema }),
  z.strictObject({
    type: z.literal("billing-concession"),
    input: approvalSchema,
  }),
  z.strictObject({
    type: z.literal("staff-leave-create"),
    input: leaveRequestSchema,
  }),
  z.strictObject({
    type: z.literal("billing-generate"),
    input: generateInvoicesRequestSchema,
  }),
  z.strictObject({ type: z.literal("billing-collect"), input: paymentSchema }),
  z.strictObject({
    type: z.literal("billing-reverse"),
    id: identifierSchema,
    note: z.string().trim().min(8).max(300),
  }),
  z.strictObject({
    type: z.literal("billing-remind"),
    ids: z.array(identifierSchema).min(1).max(2000),
  }),
  z.strictObject({
    type: z.literal("hr-register"),
    input: attendanceBatchRequestSchema,
  }),
  z.strictObject({
    type: z.literal("hr-leave"),
    id: identifierSchema,
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().min(8).max(500),
  }),
  z.strictObject({
    type: z.literal("staff-identity"),
    input: staffSummarySchema,
  }),
  z.strictObject({
    type: z.literal("staff-profile"),
    input: staffProfileSchema,
  }),
  z.strictObject({
    type: z.literal("staff-onboard"),
    input: staffOnboardRequestSchema,
  }),
  z.strictObject({ type: z.literal("leave"), input: portalLeaveSchema }),
  z.strictObject({
    type: z.literal("homework-submit"),
    input: portalSubmissionSchema,
  }),
  z.strictObject({
    type: z.literal("attendance-save"),
    input: portalAttendanceSchema,
  }),
  z.strictObject({
    type: z.literal("submission-grade"),
    input: portalGradeSchema,
  }),
  z.strictObject({ type: z.literal("mark-save"), input: portalMarkSchema }),
  z.strictObject({ type: z.literal("notice-ack"), id: identifierSchema }),
  z.strictObject({
    type: z.literal("teacher-create"),
    kind: z.enum(["homework", "lessons"]),
    input: z.unknown(),
  }),
  z.strictObject({ type: z.literal("lesson-submit"), id: identifierSchema }),
  z.strictObject({
    type: z.literal("operation-save"),
    input: operationRequestSchema,
  }),
  z.strictObject({
    type: z.literal("operation-respond"),
    id: identifierSchema,
    input: z.strictObject({ response: z.string().max(4000) }),
  }),
  z.strictObject({
    type: z.literal("loan-renew"),
    id: identifierSchema,
    dueDate: localDateSchema,
  }),
]);
export const cloudMutationSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  yearId: identifierSchema,
  command: cloudCommandSchema,
});

export const publicCloudCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("public-inquiry"), input: z.unknown() }),
  z.strictObject({ type: z.literal("public-tenant"), input: z.unknown() }),
]);

export const cloudActionResultSchema = z.discriminatedUnion("ok", [
  z.strictObject({ ok: z.literal(true), data: cloudProjectionSchema }),
  z.strictObject({ ok: z.literal(false), error: z.string().max(1000) }),
]);
