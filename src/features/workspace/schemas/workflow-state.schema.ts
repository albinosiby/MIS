import { bankStatementSchema } from "../../fees/schemas/bank-reconciliation.schema.ts";
import { websiteReleaseSchema } from "../../website/schemas/releases.schema.ts";
import { admissionDecisionSchema } from "../../admissions/schemas/completion.schema.ts";
import { resultReviewSchema } from "../../exams/schemas/review.schema.ts";
import {
  timetableVersionSchema,
  substitutionReviewSchema,
} from "../../timetable/schemas/publication.schema.ts";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { learningProgressSchema } from "../../learning/schemas/progress.schema.ts";
import { z } from "zod";
import {
  advancedSettingsSchema,
  customValuesSchema,
  workflowApprovalSchema,
} from "../../settings/schemas/advanced.schema.ts";
import {
  payrollPolicySchema,
  salaryPlanSchema,
  payrollRunSchema,
  employmentEventSchema,
} from "../../hr/schemas/payroll.schema.ts";
import {
  ledgerEntrySchema,
  feePlanSchema,
} from "../../fees/schemas/ledger.schema.ts";
import {
  publicationSchema,
  reportBuilderSchema,
  publishedReportScheduleSchema,
} from "../../reports/schemas/publication.schema.ts";
import { studentEventSchema } from "../../students/schemas/lifecycle.schema.ts";
export const workflowStateSchema = z
  .strictObject({
    bankStatements: z.array(bankStatementSchema).max(240).default([]),
    admissionDecisions: z.array(admissionDecisionSchema).max(5000).default([]),
    resultReviews: z.array(resultReviewSchema).max(5000).default([]),
    timetableVersions: z.array(timetableVersionSchema).max(100).default([]),
    substitutionReviews: z
      .array(substitutionReviewSchema)
      .max(5000)
      .default([]),
    websiteReleases: z.array(websiteReleaseSchema).max(100).default([]),
    activeWebsiteReleaseId: identifierSchema.nullable().default(null),
    learningProgress: z.array(learningProgressSchema).max(10000).default([]),
    advanced: advancedSettingsSchema.default(() =>
      advancedSettingsSchema.parse({}),
    ),
    customValues: z.array(customValuesSchema).max(5000).default([]),
    approvals: z.array(workflowApprovalSchema).max(5000).default([]),
    payrollPolicy: payrollPolicySchema.default(() =>
      payrollPolicySchema.parse({}),
    ),
    salaryPlans: z.array(salaryPlanSchema).max(200).default([]),
    payrollRuns: z.array(payrollRunSchema).max(120).default([]),
    employmentEvents: z.array(employmentEventSchema).max(2000).default([]),
    ledger: z.array(ledgerEntrySchema).max(50000).default([]),
    feePlans: z.array(feePlanSchema).max(5000).default([]),
    publications: z.array(publicationSchema).max(10000).default([]),
    reportBuilders: z.array(reportBuilderSchema).max(100).default([]),
    reportSchedules: z
      .array(publishedReportScheduleSchema)
      .max(100)
      .default([]),
    studentEvents: z.array(studentEventSchema).max(20000).default([]),
    counters: z.record(z.string(), z.number().int().nonnegative()).default({}),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.websiteReleases.map((release) => release.id)).size !==
        v.websiteReleases.length ||
      new Set(v.websiteReleases.map((release) => release.version)).size !==
        v.websiteReleases.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["websiteReleases"],
        message: "Website release IDs and versions must be unique.",
      });
    if (
      v.activeWebsiteReleaseId &&
      !v.websiteReleases.some(
        (release) => release.id === v.activeWebsiteReleaseId,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["activeWebsiteReleaseId"],
        message: "Choose a saved website release.",
      });
    if (
      new Set(v.learningProgress.map((p) => `${p.studentId}:${p.resourceId}`))
        .size !== v.learningProgress.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["learningProgress"],
        message: "Use one progress record per student and resource.",
      });
    for (const collection of [
      "bankStatements",
      "admissionDecisions",
      "resultReviews",
      "timetableVersions",
      "substitutionReviews",
      "approvals",
      "payrollRuns",
      "employmentEvents",
      "ledger",
      "feePlans",
      "publications",
      "reportBuilders",
      "reportSchedules",
      "studentEvents",
    ] as const) {
      const ids = v[collection].map((r) => r.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          path: [collection],
          message: "Record IDs must be unique.",
        });
    }
    if (new Set(v.ledger.map((r) => r.sourceKey)).size !== v.ledger.length)
      ctx.addIssue({
        code: "custom",
        path: ["ledger"],
        message: "Journal sources must be unique.",
      });
    if (
      new Set(v.salaryPlans.map((r) => `${r.staffId}:${r.effectiveFrom}`))
        .size !== v.salaryPlans.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["salaryPlans"],
        message: "Salary effective dates must be unique per employee.",
      });
    if (
      new Set(v.payrollRuns.map((r) => r.period)).size !== v.payrollRuns.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["payrollRuns"],
        message: "Payroll months must be unique.",
      });
    if (
      new Set(v.customValues.map((r) => `${r.entity}:${r.ownerId}`)).size !==
      v.customValues.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["customValues"],
        message: "Custom record values must be unique.",
      });
  });
