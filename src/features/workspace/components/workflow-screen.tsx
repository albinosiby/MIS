"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { OperationsShell } from "../../operations/components/operations-shell";
import { canAccess } from "../../identity/domain/access";
import type { AccountIdentity } from "../../identity/models";
import {
  WorkflowActionsProvider,
  useWorkflowActions,
} from "../hooks/workflow-actions";
import { workflowDestinations as destinations } from "../data/workflow-routes";
const WebsiteReleasePanel = dynamic(() =>
  import("../../website/components/website-release-panel").then(
    (module) => module.WebsiteReleasePanel,
  ),
);
const EligibilityPanel = dynamic(() =>
  import("../../attendance/components/eligibility-panel").then(
    (m) => m.EligibilityPanel,
  ),
);
const AdvancedSettingsPanel = dynamic(() =>
  import("../../settings/components/advanced-settings-panel").then(
    (m) => m.AdvancedSettingsPanel,
  ),
);
const ApprovalQueuePanel = dynamic(() =>
  import("../../settings/components/approval-queue-panel").then(
    (m) => m.ApprovalQueuePanel,
  ),
);
const PayrollPanel = dynamic(() =>
  import("../../hr/components/payroll-panel").then((m) => m.PayrollPanel),
);
const TimetableGeneratorPanel = dynamic(() =>
  import("../../timetable/components/timetable-generator-panel").then(
    (m) => m.TimetableGeneratorPanel,
  ),
);
const ExamPublicationPanel = dynamic(() =>
  import("../../exams/components/exam-publication-panel").then(
    (m) => m.ExamPublicationPanel,
  ),
);
const StudentLifecyclePanel = dynamic(() =>
  import("../../students/components/student-lifecycle-panel").then(
    (m) => m.StudentLifecyclePanel,
  ),
);
const ReportBuilderPanel = dynamic(() =>
  import("../../reports/components/report-builder-panel").then(
    (m) => m.ReportBuilderPanel,
  ),
);
const CertificateIssuePanel = dynamic(() =>
  import("../../documents/components/certificate-issue-panel").then(
    (m) => m.CertificateIssuePanel,
  ),
);
const PublicationRegisterPanel = dynamic(() =>
  import("../../documents/components/publication-register-panel").then(
    (m) => m.PublicationRegisterPanel,
  ),
);
const FinanceLedger = dynamic(() =>
  import("../../fees/components/finance-ledger").then((m) => m.FinanceLedger),
);
const CustomRecordFields = dynamic(() =>
  import("../../settings/components/custom-record-fields").then(
    (m) => m.CustomRecordFields,
  ),
);
const panels: Record<string, React.ComponentType> = {
  "/fees/bank-statements": dynamic(() =>
    import("../../fees/components/bank-reconciliation-panel").then(
      (m) => m.BankReconciliationPanel,
    ),
  ),
  "/admissions/completion": dynamic(() =>
    import("../../admissions/components/completion-panel").then(
      (m) => m.AdmissionCompletionPanel,
    ),
  ),
  "/exams/reviews": dynamic(() =>
    import("../../exams/components/result-review-panel").then(
      (m) => m.ResultReviewPanel,
    ),
  ),
  "/timetable/versions": dynamic(() =>
    import("../../timetable/components/publication-panel").then(
      (m) => m.TimetablePublicationPanel,
    ),
  ),
  "/timetable/substitutions": dynamic(() =>
    import("../../timetable/components/publication-panel").then(
      (m) => m.TimetablePublicationPanel,
    ),
  ),
  "/website/releases": WebsiteReleasePanel,
  "/attendance/eligibility": EligibilityPanel,
  "/settings/advanced": AdvancedSettingsPanel,
  "/settings/approvals": ApprovalQueuePanel,
  "/account/approvals": ApprovalQueuePanel,
  "/hr/payroll-runs": PayrollPanel,
  "/timetable/generate": TimetableGeneratorPanel,
  "/exams/publications": ExamPublicationPanel,
  "/students/lifecycle": StudentLifecyclePanel,
  "/reports/builder": ReportBuilderPanel,
  "/documents/issue": CertificateIssuePanel,
  "/documents/publications": PublicationRegisterPanel,
};
export function WorkflowScreen({
  actor,
  route,
}: {
  actor: AccountIdentity;
  route: string;
}) {
  return (
    <WorkflowActionsProvider actor={actor}>
      <WorkflowContent route={route} />
    </WorkflowActionsProvider>
  );
}
function WorkflowContent({ route }: { route: string }) {
  const { actor, year: y, error, status } = useWorkflowActions(),
    current = destinations.find(
      ([href]) =>
        href ===
        (route === "/timetable/substitutions" ? "/timetable/versions" : route),
    ),
    Panel = panels[route];
  return (
    <OperationsShell actor={actor} route={route}>
      <div className="op-heading">
        <div>
          <span className="op-eyebrow">School / connected workflows</span>
          <h1>{current?.[1] ?? "School workflows"}</h1>
          <p>
            {y.setup.calendar.year.name} ·{" "}
            {y.locked
              ? "Archived records are read only"
              : "Changes are validated and saved to your school workspace"}
          </p>
        </div>
      </div>
      <nav className="op-links mb-5" aria-label="Workflow navigation">
        {destinations
          .filter(([href]) => canAccess(actor.role, href))
          .map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={href === route ? "page" : undefined}
            >
              {label} →
            </Link>
          ))}
      </nav>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="op-notice" role="status">
          {status}
        </p>
      )}
      {route === "/fees/ledger" ? (
        <FinanceLedger actor={actor} />
      ) : route === "/hr/custom-records" ? (
        <CustomRecordFields actor={actor} />
      ) : Panel ? (
        <Panel />
      ) : null}
    </OperationsShell>
  );
}
