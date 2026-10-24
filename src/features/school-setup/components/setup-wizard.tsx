"use client";

import { useBackend } from "../../identity/components/identity-context";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { titleRoutes } from "../../workspace/data/screen-catalog";
import { SchoolShell } from "@/components/layout/school-shell";
import { FigmaAsset } from "@/components/layout/figma-asset";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { wizardPreview } from "../data/setup-preview";
import type {
  ExceptionCategory,
  ExceptionRecord,
  SetupStepId,
} from "../models";
import { reviewException } from "../domain/review-exception";
import {
  batchNotificationSchema,
  exceptionQuerySchema,
  setupWizardSnapshotSchema,
} from "../schemas/setup-wizard.schema";
import { FirstRowHeader } from "../../workspace/components/first-row-header";
import { LinkButton } from "../../workspace/components/workspace-ui";
import { MigrationResume } from "./migration-resume";
import { SetupPipeline } from "./setup-pipeline";
import { SetupGovernance } from "./setup-governance";
import "../styles/setup-wizard.css";
import "../styles/setup-config.css";
import { useSetupWorkspace } from "../hooks/setup-workspace-provider";
import { SetupStepForm } from "./setup-step-form";
import { readableError } from "./form-errors";
import { SetupWorkspaceTools } from "./setup-workspace-tools";
import { canonicalSetupConfigSchema as setupConfigSchema } from "../schemas/setup-config.schema";
import { setupPhases, projectExceptions } from "../domain/setup-workflow";

type Modal =
  | { title: string; content: ReactNode }
  | { title: string; record: ExceptionRecord };
const filters: { key: "all" | ExceptionCategory; label: string }[] = [
  { key: "all", label: "All Exceptions" },
  { key: "uid", label: "Missing Aadhaar / UID" },
  { key: "sibling", label: "Sibling Link Broken" },
  { key: "address", label: "Address & Transport Mismatch" },
];

export function SetupWizard({ step }: { step?: SetupStepId }) {
  const { root, year, switchYear, config, commit, busy } = useSetupWorkspace();
  const router = useRouter();
  const cloud = useBackend() === "supabase";
  const schoolProfile = config.school;
  const academicCalendar = config.calendar;
  const previewContext = {
    schoolId: config.school.id,
    academicYearId: config.calendar.year.id,
  };
  const records = projectExceptions(config);
  const phases = setupPhases(config);
  const summary = {
    ...wizardPreview.summary,
    completionPercent: Math.round((config.completed.length / 8) * 100),
    pipelineVelocityPercent: Math.round((config.completed.length / 8) * 100),
    velocityChangePerHour: 0,
    totalStudents: config.students.length,
    validatedStudents: Math.max(0, config.students.length - records.length),
    targetTermStart:
      config.calendar.terms[0]?.startDate ?? config.calendar.year.startDate,
    deadlineDays: Math.max(
      0,
      Math.ceil(
        (Date.parse(config.calendar.year.endDate) - Date.now()) / 86400000,
      ),
    ),
    pendingApprovals: 0,
    upcomingEvents: 0,
  };
  const principal = config.staff[0];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ExceptionCategory>("all");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [notice, setNotice] = useState("");
  const [validationRunning, setValidationRunning] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const query = exceptionQuerySchema.parse({ search, category: filter, page });
  const filtered = records.filter(
    (row) =>
      (filter === "all" || row.category === filter) &&
      `${row.name} ${row.guardian} ${row.id}`
        .toLowerCase()
        .includes(query.search.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 6));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 6, currentPage * 6);
  const allSelected =
    visible.length > 0 && visible.every((row) => selection.includes(row.id));
  const hasSomeSelected = visible.some((row) => selection.includes(row.id));
  function inspect(title: string, content?: ReactNode) {
    if (titleRoutes[title]) {
      router.push(titleRoutes[title]);
      return;
    }
    if (title === "System Audit Log")
      content = (
        <div className="config-audit">
          {config.audit.length ? (
            config.audit
              .slice()
              .reverse()
              .map((entry) => (
                <p key={entry.id}>
                  <time>{new Date(entry.at).toLocaleString()}</time>
                  <br />
                  {entry.action}
                </p>
              ))
          ) : (
            <p>No saved actions yet.</p>
          )}
        </div>
      );
    if (title === "Notifications")
      content = (
        <div>
          {config.notifications.length ? (
            config.notifications
              .slice()
              .reverse()
              .map((n) => (
                <p key={n.id}>
                  {new Date(n.at).toLocaleString()}
                  <br />
                  {n.recipients.length} guardian recipients · Simulated only ·
                  Nothing sent
                </p>
              ))
          ) : (
            <p>No notifications prepared yet.</p>
          )}
        </div>
      );
    if (title === "Principal profile")
      content = (
        <div>
          <p>
            {principal.displayName} · {principal.designation}
          </p>
          <p>
            {config.school.name} · {config.school.email}
          </p>
        </div>
      );
    if (title === "Browse Snapshots") content = <SetupWorkspaceTools />;
    if (title === "Class roster map")
      content = (
        <ul>
          {config.classes.map((c) => (
            <li key={c.id}>
              {c.grade} – {c.section}:{" "}
              {config.students.filter((s) => s.classSectionId === c.id).length}/
              {c.capacity} seats
            </li>
          ))}
        </ul>
      );
    setModal({
      title,
      content: content ?? (
        <>
          <p>Open the connected operations workspace to continue.</p>
          <p>
            School modules share your saved workspace records. External services
            require separate configuration.
          </p>
        </>
      ),
    });
  }
  function toggleRow(id: string, checked: boolean) {
    setSelection((value) =>
      checked
        ? [...new Set([...value, id])]
        : value.filter((item) => item !== id),
    );
  }
  function runValidation() {
    if (validationRunning) return;
    setValidationRunning(true);
    window.setTimeout(() => {
      setValidationRunning(false);
      setNotice(
        setupConfigSchema.safeParse(config).success &&
          setupWizardSnapshotSchema.safeParse({
            ...wizardPreview,
            phases,
            summary,
            exceptions: records,
          }).success
          ? `Preview validation finished: ${records.length} sample exceptions still need review. No external services were contacted.`
          : "Preview data does not match the school setup contract. No external services were contacted.",
      );
    }, 700);
  }
  return (
    <SchoolShell
      logo={config.branding.logo}
      school={schoolProfile}
      principal={principal}
      academicYearName={`AY ${academicCalendar.year.name}`}
      search={search}
      onSearch={(value) => {
        const parsed = exceptionQuerySchema.safeParse({ search: value });
        if (!parsed.success) {
          setNotice("Keep the search within 200 characters.");
          return;
        }
        setSearch(value);
        setPage(1);
      }}
      onInspect={inspect}
      unreadCount={year.records.notifications.filter((n) => !n.read).length}
      years={root.years.map((y) => ({
        id: y.setup.calendar.year.id,
        name: y.setup.calendar.year.name,
      }))}
      selectedYearId={root.activeYearId}
      onYearChange={(id) =>
        void switchYear(id).catch((error) => setNotice(readableError(error)))
      }
    >
      <main
        id="main-content"
        className={`setup-content ${!step || step === "data-ingestion" ? "fr-page" : ""}`}
      >
        {step === "data-ingestion" ? (
          <>
            <FirstRowHeader route="/school-setup/data-ingestion" />
            <MigrationResume key={config.calendar.year.id} />
          </>
        ) : step ? (
          <SetupStepForm
            key={`${config.calendar.year.id}-${step}-${config.revision}`}
            step={step}
          />
        ) : (
          <>
            <FirstRowHeader route="/school-setup" />
            <div className="fr-toolbar">
              <p>
                Eight connected phases for academic year{" "}
                {config.calendar.year.name}.
              </p>
              <div className="ws-actions">
                <LinkButton href="/school-setup/data-ingestion">
                  Resume migration
                </LinkButton>
                <LinkButton
                  variant="default"
                  href={`/school-setup/${phases.find((p) => p.status === "in_progress")?.id ?? "school-profile"}`}
                >
                  {config.completed.length === 8
                    ? "Review configuration"
                    : "Continue current phase"}
                </LinkButton>
              </div>
            </div>
            <section
              className="fr-setup-summary"
              aria-label="School setup summary"
            >
              <div>
                <span>Setup complete</span>
                <strong>{summary.completionPercent}%</strong>
              </div>
              <div>
                <span>Student records</span>
                <strong>{config.students.length}</strong>
              </div>
              <div>
                <span>Unresolved exceptions</span>
                <strong>{records.length}</strong>
              </div>
              <div>
                <span>Class sections</span>
                <strong>{config.classes.length}</strong>
              </div>
            </section>
            <SetupPipeline inspect={inspect} phases={phases} />
            <SetupWorkspaceTools />
            {config.completed.length === 8 && (
              <div className="config-success" role="status">
                All eight steps completed. Your school is ready.
              </div>
            )}
            <div className="setup-workspace">
              <div className="workspace-left">
                <section
                  className="setup-panel exceptions-panel"
                  aria-labelledby="exceptions-heading"
                >
                  <header className="exceptions-header">
                    <div className="heading-line">
                      <h2 id="exceptions-heading">
                        Stage 7: Ingestion Flagged Discrepancies
                      </h2>
                      <span className="exception-count">
                        {records.length} Unresolved Exceptions
                      </span>
                    </div>
                    <div className="exceptions-header-bottom">
                      <p>
                        Saved student data ingestion records
                        <br />
                        awaiting administrative review.
                      </p>
                      <div>
                        <Button
                          variant="outline"
                          onClick={() =>
                            inspect(
                              "Filter exceptions",
                              <div className="dialog-filter-options">
                                {filters.map((item) => (
                                  <Button
                                    key={item.key}
                                    variant={
                                      item.key === filter
                                        ? "secondary"
                                        : "outline"
                                    }
                                    onClick={() => {
                                      setFilter(item.key);
                                      setPage(1);
                                      setModal(null);
                                    }}
                                  >
                                    {item.label}
                                  </Button>
                                ))}
                              </div>,
                            )
                          }
                        >
                          <FigmaAsset group="workspace" name="imgContainer" />
                          Filters
                        </Button>
                        <Button
                          className="notify-button"
                          onClick={() =>
                            inspect(
                              "Notify selected guardians",
                              <>
                                <p>
                                  {selection.length
                                    ? `${selection.length} sample records selected.`
                                    : "Select records in the table before preparing a notification."}
                                </p>
                                <p>
                                  No messages will be sent from this preview.
                                </p>
                                <Button
                                  disabled={
                                    !batchNotificationSchema.safeParse({
                                      ...previewContext,
                                      exceptionIds: selection,
                                    }).success
                                  }
                                  onClick={() => {
                                    void commit((current) => {
                                      const selectedStudents =
                                        current.students.filter((student) =>
                                          selection.includes(
                                            student.admissionNumber,
                                          ),
                                        );
                                      const recipients = [
                                        ...new Set(
                                          current.relationships
                                            .filter(
                                              (link) =>
                                                link.canReceiveNotices &&
                                                selectedStudents.some(
                                                  (student) =>
                                                    student.id ===
                                                    link.studentId,
                                                ),
                                            )
                                            .map((link) => link.guardianId),
                                        ),
                                      ];
                                      if (!recipients.length)
                                        throw new Error(
                                          "No linked recipients found.",
                                        );
                                      return {
                                        ...current,
                                        notifications: [
                                          ...current.notifications,
                                          {
                                            id: crypto.randomUUID(),
                                            at: new Date().toISOString(),
                                            recipients,
                                            status: "simulated" as const,
                                          },
                                        ].slice(-200),
                                      };
                                    }, "Prepared guardian notification")
                                      .then(() => {
                                        setNotice(
                                          "Simulated notification saved. No messages sent.",
                                        );
                                        setModal(null);
                                      })
                                      .catch((e) =>
                                        setNotice(readableError(e)),
                                      );
                                  }}
                                >
                                  Prepare notification preview
                                </Button>
                              </>,
                            )
                          }
                        >
                          <FigmaAsset group="workspace" name="imgContainer1" />
                          Batch Notify Parents
                        </Button>
                      </div>
                    </div>
                  </header>
                  <div
                    className="filter-chips"
                    aria-label="Exception categories"
                  >
                    <strong>FILTER VIEW:</strong>
                    {filters.map((item) => (
                      <button
                        key={item.key}
                        aria-pressed={filter === item.key}
                        className={filter === item.key ? "active" : ""}
                        onClick={() => {
                          setFilter(item.key);
                          setPage(1);
                        }}
                      >
                        {item.label} (
                        {item.key === "all"
                          ? records.length
                          : records.filter(
                              (record) => record.category === item.key,
                            ).length}
                        )
                      </button>
                    ))}
                  </div>
                  <div
                    className="exception-table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Discrepancies table; scroll horizontally for quick actions"
                  >
                    <table className="exception-table">
                      <thead>
                        <tr>
                          <th>
                            <Checkbox
                              aria-label="Select all visible records"
                              checked={
                                allSelected
                                  ? true
                                  : hasSomeSelected
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={(checked) =>
                                setSelection((value) =>
                                  checked
                                    ? [
                                        ...new Set([
                                          ...value,
                                          ...visible.map((row) => row.id),
                                        ]),
                                      ]
                                    : value.filter(
                                        (id) =>
                                          !visible.some((row) => row.id === id),
                                      ),
                                )
                              }
                            />
                          </th>
                          <th>Student Name & Guardian</th>
                          <th>
                            Grade
                            <br />/ Sec
                          </th>
                          <th>GRN No.</th>
                          <th>DigiLocker Status</th>
                          <th>Flagged Discrepancy</th>
                          <th className="action-column">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <Checkbox
                                aria-label={`Select ${row.name}`}
                                checked={selection.includes(row.id)}
                                onCheckedChange={(checked) =>
                                  toggleRow(row.id, checked === true)
                                }
                              />
                            </td>
                            <td>
                              <div className="student-cell">
                                {row.image ? (
                                  <img
                                    src={row.image}
                                    alt=""
                                    width={29}
                                    height={29}
                                  />
                                ) : (
                                  <span className="student-initial">S</span>
                                )}
                                <strong>{row.name}</strong>
                                <small>(G: {row.guardian})</small>
                              </div>
                            </td>
                            <td>
                              <strong>{row.grade}</strong>
                            </td>
                            <td>{row.id}</td>
                            <td>
                              <span className={`record-badge ${row.tone}`}>
                                <i />
                                {row.status}
                              </span>
                            </td>
                            <td
                              className={
                                row.tone === "danger"
                                  ? "discrepancy-danger"
                                  : ""
                              }
                            >
                              {row.discrepancy}
                            </td>
                            <td className="action-column">
                              <Button
                                variant={
                                  row.action === "Resolve UID"
                                    ? "secondary"
                                    : "outline"
                                }
                                onClick={() => {
                                  setReviewError("");
                                  setModal({ title: row.action, record: row });
                                }}
                              >
                                {row.action}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visible.length && (
                      <div className="empty-exceptions">
                        <h3>No matching exceptions</h3>
                        <p>Try another student, GRN, guardian, or category.</p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSearch("");
                            setFilter("all");
                            setPage(1);
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    )}
                  </div>
                  <footer className="table-pagination">
                    <p>
                      Showing{" "}
                      {filtered.length
                        ? `${(currentPage - 1) * 6 + 1}–${Math.min(currentPage * 6, filtered.length)}`
                        : "0"}{" "}
                      of {filtered.length} discrepancies <b>•</b>
                      <small>Batch ID: {wizardPreview.batchId}</small>
                    </p>
                    <div>
                      <button
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <FigmaAsset group="workspace" name="imgContainer2" />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          className={currentPage === i + 1 ? "active" : ""}
                          aria-label={`Page ${i + 1}`}
                          aria-current={
                            currentPage === i + 1 ? "page" : undefined
                          }
                          onClick={() => setPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <FigmaAsset group="workspace" name="imgContainer3" />
                      </button>
                    </div>
                  </footer>
                </section>
                <section className="setup-panel roster-summary">
                  <div className="roster-icon">
                    <FigmaAsset group="workspace" name="imgContainer4" />
                  </div>
                  <div>
                    <h2>Class Roster Capacity Integrity Passed</h2>
                    <p>
                      {config.classes.length} sections checked against saved
                      capacities.
                      <br />
                      {config.students.length} students assigned; no external
                      compliance verified.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => inspect("Class roster map")}
                  >
                    Inspect Roster Map
                  </Button>
                </section>
              </div>
              <SetupGovernance
                inspect={inspect}
                checks={wizardPreview.compliance.map((check) => ({
                  ...check,
                  status: "unverified",
                  value: "Not connected",
                  supportingText: "No external verification",
                }))}
                authority={{
                  ...wizardPreview.authority,
                  staff: principal,
                  tokenStatus: "unavailable",
                  tokenSerial: "Not configured",
                  fingerprintDisplay: "Not configured",
                  ledgerCount: config.students.length,
                  rosterCount: config.classes.length,
                }}
              />
            </div>
            <section className="setup-panel snapshot-panel">
              <div className="snapshot-icon">
                <FigmaAsset group="workspace" name="imgContainer8" />
              </div>
              <div>
                <h2>Backups & Recovery</h2>
                <p>
                  {cloud
                    ? "Data is saved to the connected school database after successful changes."
                    : "Data is saved in this browser after successful changes."}
                  <br className="desktop-break" /> Export a backup before
                  resetting, or restore a previously exported file.
                </p>
              </div>
              <div className="snapshot-actions">
                <Button
                  variant="outline"
                  onClick={() => inspect("Browse Snapshots")}
                >
                  Browse Snapshots
                </Button>
                <Button
                  variant="secondary"
                  disabled={validationRunning || year.locked}
                  onClick={runValidation}
                >
                  {validationRunning
                    ? "Validating…"
                    : "Run Next Validation Loop"}
                </Button>
              </div>
            </section>
            <footer className="setup-preview-label">School workspace</footer>
          </>
        )}
      </main>
      {notice && (
        <div className="setup-toast" role="status">
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {modal && (
        <Dialog title={modal.title} onClose={() => setModal(null)}>
          {"record" in modal ? (
            <form
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                const result = reviewException(
                  records,
                  {
                    ...previewContext,
                    exceptionId: modal.record.id,
                    note: new FormData(event.currentTarget).get("note"),
                  },
                  previewContext,
                );
                if (!result.success) {
                  setReviewError(
                    result.issues[0]?.message ??
                      "Review could not be validated",
                  );
                  return;
                }
                setReviewError("");
                try {
                  await commit((current) => {
                    const checked = reviewException(
                      current.exceptions,
                      result.review,
                      previewContext,
                    );
                    if (!checked.success)
                      throw new Error(
                        checked.issues[0]?.message ?? "Review failed",
                      );
                    return {
                      ...current,
                      exceptions: checked.records,
                      reviews: [...current.reviews, checked.review],
                    };
                  }, `Reviewed exception ${modal.record.id}`);
                } catch (e) {
                  setReviewError(readableError(e));
                  return;
                }
                setSelection((value) =>
                  value.filter((id) => id !== modal.record.id),
                );
                setNotice(`${modal.record.name} review saved to this browser.`);
                setModal(null);
              }}
            >
              <p>
                <strong>{modal.record.name}</strong> · {modal.record.id}
              </p>
              <p className="review-discrepancy">{modal.record.discrepancy}</p>
              <label htmlFor="review-note">Review note</label>
              <textarea
                id="review-note"
                name="note"
                required
                minLength={8}
                maxLength={500}
                placeholder="Describe the correction or evidence reviewed"
                aria-invalid={!!reviewError}
                aria-describedby={
                  reviewError
                    ? "review-note-error review-note-hint"
                    : "review-note-hint"
                }
                onChange={() => setReviewError("")}
              />
              {reviewError && (
                <p
                  id="review-note-error"
                  role="alert"
                  className="text-destructive"
                >
                  {reviewError}
                </p>
              )}
              <p id="review-note-hint" className="dialog-hint">
                This saves a administrative review in this browser. It does not
                verify identity.
              </p>
              <Button type="submit" disabled={busy}>
                Save review
              </Button>
            </form>
          ) : (
            modal.content
          )}
        </Dialog>
      )}
    </SchoolShell>
  );
}
