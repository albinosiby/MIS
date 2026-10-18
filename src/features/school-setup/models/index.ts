import type { z } from "zod";
import type {
  exceptionCategorySchema,
  exceptionRecordSchema,
  exceptionReviewSchema,
  exceptionQuerySchema,
  batchNotificationSchema,
  setupPhaseSchema,
  setupSummarySchema,
  complianceCheckSchema,
  signingAuthoritySummarySchema,
  snapshotSummarySchema,
  setupWizardSnapshotSchema,
} from "../schemas/setup-wizard.schema.ts";

export type ExceptionCategory = z.infer<typeof exceptionCategorySchema>;
export type ExceptionRecord = z.infer<typeof exceptionRecordSchema>;
export type ExceptionReview = z.infer<typeof exceptionReviewSchema>;
export type ExceptionQuery = z.infer<typeof exceptionQuerySchema>;
export type BatchNotification = z.infer<typeof batchNotificationSchema>;
export type SetupPhase = z.infer<typeof setupPhaseSchema>;
export type SetupSummary = z.infer<typeof setupSummarySchema>;
export type ComplianceCheck = z.infer<typeof complianceCheckSchema>;
export type SigningAuthoritySummary = z.infer<
  typeof signingAuthoritySummarySchema
>;
export type SnapshotSummary = z.infer<typeof snapshotSummarySchema>;
export type SetupWizardSnapshot = z.infer<typeof setupWizardSnapshotSchema>;

export type SetupConfig = z.infer<
  typeof import("../schemas/setup-config.schema.ts").setupConfigSchema
>;
export type SetupStepId =
  (typeof import("../schemas/setup-wizard.schema.ts").setupPhaseIds)[number];
export type BellSlot = z.infer<
  typeof import("../schemas/setup-config.schema.ts").bellSlotSchema
>;
export type FeeHead = z.infer<
  typeof import("../schemas/setup-config.schema.ts").feeHeadSchema
>;
export type StaffAllocation = z.infer<
  typeof import("../schemas/setup-config.schema.ts").staffAllocationSchema
>;
