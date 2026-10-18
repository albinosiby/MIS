import {
  importBankStatement,
  matchBankLine,
  closeBankStatement,
  issueServiceCharge,
  unmatchBankLine,
  voidBankStatement,
  billLibraryFine,
} from "../../fees/domain/bank-reconciliation.ts";
import {
  confirmContinuation,
  withdrawAdmission,
} from "../../admissions/domain/completion.ts";
import {
  requestMarkModeration,
  requestResultReview,
  decideResultReview,
} from "../../exams/domain/reviews.ts";
import {
  requestSubstitution,
  decideSubstitution,
} from "../../timetable/domain/substitutions.ts";
import {
  publishWebsite,
  selectWebsiteRelease,
} from "../../website/domain/releases.ts";
import { recordLearningProgress } from "../../learning/domain/progress.ts";
import {
  configureLateFees,
  assessLateCharge,
  publishLedgerStatement,
} from "../../fees/domain/finance-workflows.ts";
import {
  issueBulkCertificates,
  publishCertificate,
} from "../../documents/domain/issue-publications.ts";
import type { SchoolYearWorkspace } from "../models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { workflowCommandSchema } from "../schemas/workflow-command.schema.ts";
import {
  saveAdvancedSettings,
  saveCustomValues,
  decideWorkflowApproval,
} from "../../settings/domain/advanced-settings.ts";
import {
  configurePayroll,
  saveSalaryPlan,
  preparePayroll,
  progressPayroll,
  saveEmploymentEvent,
} from "../../hr/domain/payroll.ts";
import {
  generateTimetable,
  publishTimetable,
} from "../../timetable/domain/generate-timetable.ts";
import {
  publishExamResults,
  publishTranscript,
} from "../../exams/domain/publications.ts";
import { changeStudentLifecycle } from "../../students/domain/lifecycle.ts";
import { gradeQuizAttempt } from "../../learning/domain/grade-quiz.ts";
import {
  saveReportBuilder,
  publishReport,
  revokePublication,
  savePublishedReportSchedule,
} from "../../reports/domain/report-builder.ts";
export function applyWorkflowCommand(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
): SchoolYearWorkspace {
  const c = workflowCommandSchema.parse(input);
  switch (c.action) {
    case "library-fine-bill":
      return billLibraryFine(y, a, c.input);
    case "bank-unmatch":
      return unmatchBankLine(y, a, c.input);
    case "bank-void":
      return voidBankStatement(y, a, c.input);
    case "bank-import":
      return importBankStatement(y, a, c.input);
    case "bank-match":
      return matchBankLine(y, a, c.input);
    case "bank-close":
      return closeBankStatement(y, a, c.input);
    case "service-charge":
      return issueServiceCharge(y, a, c.input);
    case "admission-continuation":
      return confirmContinuation(y, a, c.input);
    case "admission-withdrawal":
      return withdrawAdmission(y, a, c.input);
    case "result-review-request":
      return requestResultReview(y, a, c.input);
    case "result-moderation-request":
      return requestMarkModeration(y, a, c.input);
    case "result-review-decide":
      return decideResultReview(y, a, c.input);
    case "substitution-request":
      return requestSubstitution(y, a, c.input);
    case "substitution-decide":
      return decideSubstitution(y, a, c.input);
    case "website-publish":
      return publishWebsite(y, a, c.input);
    case "website-select":
      return selectWebsiteRelease(y, a, c.input);
    case "late-fee-rules":
      return configureLateFees(y, a, c.input);
    case "late-fee-assess":
      return assessLateCharge(y, a, c.input);
    case "ledger-statement":
      return publishLedgerStatement(y, a, c.input);
    case "settings":
      return saveAdvancedSettings(y, a, c.input);
    case "custom-values":
      return saveCustomValues(y, a, c.input);
    case "approval":
      return decideWorkflowApproval(y, a, c.input);
    case "payroll-policy":
      return configurePayroll(y, a, c.input);
    case "salary-plan":
      return saveSalaryPlan(y, a, c.input);
    case "payroll-prepare":
      return preparePayroll(y, a, c.input);
    case "payroll-progress":
      return progressPayroll(y, a, c.input.id);
    case "employment":
      return saveEmploymentEvent(y, a, c.input);
    case "timetable-generate":
      return generateTimetable(y, a, c.input);
    case "timetable-publish":
      return publishTimetable(y, a, c.input);
    case "results-publish":
      return publishExamResults(y, a, c.input);
    case "transcript-publish":
      return publishTranscript(y, a, c.input);
    case "student-lifecycle":
      return changeStudentLifecycle(y, a, c.input);
    case "learning-progress":
      return recordLearningProgress(y, a, c.input);
    case "quiz-grade":
      return gradeQuizAttempt(y, a, c.input);
    case "certificate-bulk":
      return issueBulkCertificates(y, a, c.input);
    case "certificate-publish":
      return publishCertificate(y, a, c.input.id, undefined, true);
    case "report-schedule":
      return savePublishedReportSchedule(y, a, c.input);
    case "report-builder":
      return saveReportBuilder(y, a, c.input);
    case "report-publish":
      return publishReport(y, a, c.input.id);
    case "publication-revoke":
      return revokePublication(y, a, c.input.id, c.input.reason);
  }
}
