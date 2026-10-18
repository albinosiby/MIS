import {
  bankImportSchema,
  bankMatchSchema,
  bankCloseSchema,
  serviceChargeSchema,
  bankUnmatchSchema,
  bankVoidSchema,
  bankFineSchema,
} from "../../fees/schemas/bank-reconciliation.schema.ts";
import {
  continuationRequestSchema,
  withdrawalRequestSchema,
} from "../../admissions/schemas/completion.schema.ts";
import {
  moderationRequestSchema,
  resultReviewRequestSchema,
  resultReviewDecisionSchema,
} from "../../exams/schemas/review.schema.ts";
import {
  substitutionRequestSchema,
  substitutionDecisionSchema,
  timetablePublishRequestSchema,
} from "../../timetable/schemas/publication.schema.ts";
import {
  websitePublishSchema,
  websiteSelectSchema,
} from "../../website/schemas/releases.schema.ts";
import {
  learningProgressRequestSchema,
  quizGradeRequestSchema,
} from "../../learning/schemas/progress.schema.ts";
import {
  lateFeeRuleRequestSchema,
  assessLateChargeSchema,
  ledgerStatementSchema,
} from "../../fees/schemas/finance-workflow.schema.ts";
import { certificateBulkSchema } from "../../documents/schemas/certificate-issue.schema.ts";
import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
import {
  advancedSettingsSchema,
  customValuesSchema,
} from "../../settings/schemas/advanced.schema.ts";
import {
  payrollPolicySchema,
  salaryPlanSchema,
  employmentEventSchema,
} from "../../hr/schemas/payroll.schema.ts";
import { timetableGenerateSchema } from "../../timetable/schemas/generator.schema.ts";
import {
  publishResultsSchema,
  publishTranscriptSchema,
} from "../../exams/schemas/results.schema.ts";
import {
  reportBuilderSchema,
  publishedReportScheduleSchema,
} from "../../reports/schemas/publication.schema.ts";
const request = <T extends string, S extends z.ZodType>(action: T, input: S) =>
  z.strictObject({ action: z.literal(action), input });
export const workflowCommandSchema = z.discriminatedUnion("action", [
  request("library-fine-bill", bankFineSchema),
  request("bank-unmatch", bankUnmatchSchema),
  request("bank-void", bankVoidSchema),
  request("bank-import", bankImportSchema),
  request("bank-match", bankMatchSchema),
  request("bank-close", bankCloseSchema),
  request("service-charge", serviceChargeSchema),
  request("admission-continuation", continuationRequestSchema),
  request("admission-withdrawal", withdrawalRequestSchema),
  request("result-review-request", resultReviewRequestSchema),
  request("result-moderation-request", moderationRequestSchema),
  request("result-review-decide", resultReviewDecisionSchema),
  request("substitution-request", substitutionRequestSchema),
  request("substitution-decide", substitutionDecisionSchema),
  request("website-publish", websitePublishSchema),
  request("website-select", websiteSelectSchema),
  request("late-fee-rules", lateFeeRuleRequestSchema),
  request("late-fee-assess", assessLateChargeSchema),
  request("ledger-statement", ledgerStatementSchema),
  request("settings", advancedSettingsSchema),
  request("custom-values", customValuesSchema),
  request(
    "approval",
    z.strictObject({
      id: identifierSchema,
      decision: z.enum(["approved", "rejected"]),
      note: z.string().trim().min(8).max(500),
    }),
  ),
  request("payroll-policy", payrollPolicySchema),
  request("salary-plan", salaryPlanSchema),
  request(
    "payroll-prepare",
    z.strictObject({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }),
  ),
  request("payroll-progress", z.strictObject({ id: identifierSchema })),
  request(
    "employment",
    employmentEventSchema.omit({ id: true, actorId: true }),
  ),
  request("timetable-generate", timetableGenerateSchema),
  request("timetable-publish", timetablePublishRequestSchema),
  request("results-publish", publishResultsSchema),
  request("transcript-publish", publishTranscriptSchema),
  request(
    "student-lifecycle",
    z.strictObject({
      studentId: identifierSchema,
      kind: z.enum(["class-changed", "transferred", "withdrawn"]),
      classSectionId: identifierSchema.nullable(),
      date: localDateSchema,
      note: z.string().trim().min(8).max(500),
    }),
  ),
  request("quiz-grade", quizGradeRequestSchema),
  request("learning-progress", learningProgressRequestSchema),
  request("certificate-bulk", certificateBulkSchema),
  request("certificate-publish", z.strictObject({ id: identifierSchema })),
  request("report-builder", reportBuilderSchema),
  request(
    "report-schedule",
    publishedReportScheduleSchema.omit({ createdBy: true, lastRun: true }),
  ),
  request("report-publish", z.strictObject({ id: identifierSchema })),
  request(
    "publication-revoke",
    z.strictObject({
      id: identifierSchema,
      reason: z.string().trim().min(8).max(500),
    }),
  ),
]);
