import { z } from "zod";
import {
  countSchema,
  displayNameSchema,
  identifierSchema,
  localDateSchema,
  percentageSchema,
} from "../../../shared/schemas/primitives.ts";
import { staffSummarySchema } from "../../../shared/schemas/people.ts";

export const setupPhaseIds = [
  "school-profile",
  "academic-terms",
  "classes-sections",
  "bell-schedule",
  "fee-structure",
  "staff-allocations",
  "data-ingestion",
  "portal-gateway",
] as const;
export const setupPhaseSchema = z.strictObject({
  id: z.enum(setupPhaseIds),
  title: displayNameSchema,
  description: z.string().trim().min(1).max(500),
  status: z.enum(["completed", "in_progress", "locked"]),
});
export const setupPipelineSchema = z
  .array(setupPhaseSchema)
  .length(setupPhaseIds.length)
  .superRefine((phases, ctx) => {
    let reachedActive = false;
    phases.forEach((phase, index) => {
      if (phase.id !== setupPhaseIds[index])
        ctx.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Phases must appear once in prerequisite order",
        });
      if (!reachedActive && phase.status === "completed") return;
      if (!reachedActive && phase.status === "in_progress") {
        reachedActive = true;
        return;
      }
      if (!reachedActive || phase.status !== "locked")
        ctx.addIssue({
          code: "custom",
          path: [index, "status"],
          message:
            "Complete prerequisites before starting a phase; later phases stay locked",
        });
    });
  });

export const exceptionCategorySchema = z.enum(["uid", "sibling", "address"]);
// Screen projection: names and appearance are not canonical Student/Guardian models.
export const exceptionRecordSchema = z.strictObject({
  id: identifierSchema,
  schoolId: identifierSchema,
  academicYearId: identifierSchema,
  name: displayNameSchema,
  guardian: displayNameSchema,
  grade: z.string().trim().min(1).max(40),
  image: z
    .string()
    .regex(/^\/assets\/[A-Za-z0-9/_-]+\.(?:png|jpe?g|webp)$/)
    .optional(),
  status: z.string().trim().min(1).max(80),
  tone: z.enum(["danger", "warning", "info", "success"]),
  discrepancy: z.string().trim().min(1).max(1000),
  action: z.string().trim().min(1).max(80),
  category: exceptionCategorySchema,
});
export const exceptionReviewSchema = z.strictObject({
  schoolId: identifierSchema,
  academicYearId: identifierSchema,
  exceptionId: identifierSchema,
  note: z
    .string()
    .trim()
    .min(8, "Enter at least 8 characters explaining the review")
    .max(500, "Keep the review note within 500 characters"),
});
export const exceptionQuerySchema = z.strictObject({
  search: z.string().trim().max(200).default(""),
  category: z.enum(["all", "uid", "sibling", "address"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(6),
});
export const batchNotificationSchema = z
  .strictObject({
    schoolId: identifierSchema,
    academicYearId: identifierSchema,
    exceptionIds: z
      .array(identifierSchema)
      .min(1, "Select at least one record")
      .max(100),
  })
  .refine(
    (value) => new Set(value.exceptionIds).size === value.exceptionIds.length,
    { path: ["exceptionIds"], message: "Selected records must be unique" },
  );
export const setupSummarySchema = z
  .strictObject({
    pipelineVelocityPercent: percentageSchema,
    velocityChangePerHour: z.number().min(-100).max(100),
    validatedStudents: countSchema,
    totalStudents: countSchema,
    deadlineDays: countSchema,
    targetTermStart: localDateSchema,
    completionPercent: percentageSchema,
    pendingApprovals: countSchema,
    upcomingEvents: countSchema,
  })
  .refine((value) => value.validatedStudents <= value.totalStudents, {
    path: ["validatedStudents"],
    message: "Validated students cannot exceed total students",
  });
export const complianceCheckSchema = z.strictObject({
  id: identifierSchema,
  label: displayNameSchema,
  detail: z.string().trim().min(1).max(200),
  status: z.enum(["pass", "warning", "unverified"]),
  value: z.string().trim().min(1).max(100),
  supportingText: z.string().trim().min(1).max(200),
});
export const signingAuthoritySummarySchema = z.strictObject({
  staff: staffSummarySchema,
  tokenStatus: z.enum(["active", "inactive", "expired", "unavailable"]),
  tokenSerial: z.string().trim().min(1).max(100),
  fingerprintDisplay: z.string().trim().min(1).max(100),
  ledgerCount: countSchema,
  rosterCount: countSchema,
});
export const snapshotSummarySchema = z.strictObject({
  id: identifierSchema,
  schoolId: identifierSchema,
  sourceAcademicYearId: identifierSchema,
  ageMinutes: countSchema,
  status: z.enum(["available", "unavailable", "failed"]),
});
export const setupWizardSnapshotSchema = z
  .strictObject({
    schoolId: identifierSchema,
    academicYearId: identifierSchema,
    batchId: identifierSchema,
    phases: setupPipelineSchema,
    summary: setupSummarySchema,
    exceptions: z.array(exceptionRecordSchema).max(100),
    compliance: z.array(complianceCheckSchema).max(50),
    authority: signingAuthoritySummarySchema,
    snapshot: snapshotSummarySchema,
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    value.exceptions.forEach((record, index) => {
      if (ids.has(record.id))
        ctx.addIssue({
          code: "custom",
          path: ["exceptions", index, "id"],
          message: "Exception IDs must be unique",
        });
      ids.add(record.id);
      if (
        record.schoolId !== value.schoolId ||
        record.academicYearId !== value.academicYearId
      )
        ctx.addIssue({
          code: "custom",
          path: ["exceptions", index],
          message:
            "Exception must belong to the current school and academic year",
        });
    });
    if (value.authority.staff.schoolId !== value.schoolId)
      ctx.addIssue({
        code: "custom",
        path: ["authority", "staff", "schoolId"],
        message: "Authority must belong to the current school",
      });
    if (value.snapshot.schoolId !== value.schoolId)
      ctx.addIssue({
        code: "custom",
        path: ["snapshot", "schoolId"],
        message: "Snapshot must belong to the current school",
      });
    if (
      new Set(value.compliance.map((check) => check.id)).size !==
      value.compliance.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["compliance"],
        message: "Compliance check IDs must be unique",
      });
  });
