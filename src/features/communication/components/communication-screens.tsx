"use client";
import { useState, type ReactNode } from "react";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  Tabs,
  DataForm,
  RecordDialog,
  LinkButton,
  ExportButton,
  classOptions,
  staffOptions,
  newRecord,
  enumOptions,
  type FormField,
  printSection,
} from "../../workspace/components/workspace-ui";
import { putRecord, publishNotice } from "../../workspace/domain/operations";
import { QuickNoticeComposer } from "./quick-notice-composer";
import { noticeSchema, reportKeys } from "../schemas/communication.schema";
import {
  reportTitles,
  reportRows,
  buildExport,
  runScheduledJobs,
  type ReportKey,
} from "../domain/reports";
import { downloadFile } from "../../school-setup/components/setup-ingestion";
import { readableError } from "../../school-setup/components/form-errors";
const tabs = [
  ["/communication", "Noticeboard"],
  ["/communication/new", "Quick Notice"],
  ["/reports", "Standard Reports"],
] as const;
export default function CommunicationScreens({
  route,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const router = useRouter();
  const [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [category, setCategory] = useState("all"),
    [schedulerDate, setSchedulerDate] = useState(
      academicReferenceDate(y.setup.calendar.year, "10-14"),
    );
  const fields: FormField[] = [
    { name: "title", label: "Notice title", required: true },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: enumOptions(["normal", "urgent"]),
    },
    {
      name: "audience",
      label: "Target audience",
      type: "select",
      options: enumOptions(["all", "guardians", "staff"]),
    },
    {
      name: "classSectionIds",
      label: "Cohort filters (empty means all)",
      type: "multi",
      options: classOptions(y),
    },
    {
      name: "channels",
      label: "Simulated delivery channels",
      type: "multi",
      options: enumOptions(["App", "SMS", "WhatsApp", "Email"]),
    },
    { name: "body", label: "Message body", type: "textarea", required: true },
    { name: "scheduledFor", label: "Schedule date (optional)", type: "date" },
  ];
  async function act(work: () => Promise<void>) {
    try {
      await work();
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  if (route === "/communication/new") return <QuickNoticeComposer />;
  if (route === "/reports")
    return (
      <>
        <Tabs items={tabs} route={route} />
        <div className="ws-two-column">
          <div>
            <Panel title="Standard report library · 32 working data projections">
              <Table
                headers={["Report", "Current rows", "Format", "Actions"]}
                rows={reportKeys
                  .filter((k) =>
                    reportTitles[k]
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((key) => [
                    <strong>{reportTitles[key]}</strong>,
                    reportRows(y, key).length,
                    "CSV / print PDF",
                    <div className="ws-actions">
                      <Button
                        variant="outline"
                        onClick={() =>
                          void act(async () => {
                            const job = buildExport(y, key);
                            if (!y.locked)
                              await mutate(
                                (current) => ({
                                  ...current,
                                  records: {
                                    ...current.records,
                                    exports: [
                                      ...current.records.exports,
                                      job,
                                    ].slice(-200),
                                  },
                                }),
                                `Generated ${reportTitles[key]}`,
                              );
                            downloadFile(
                              job.filename,
                              job.content,
                              "text/csv;charset=utf-8",
                            );
                          })
                        }
                      >
                        Run & download CSV
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setEditor(
                            <ReportPreview
                              report={key}
                              onClose={() => setEditor(null)}
                            />,
                          )
                        }
                      >
                        Preview / PDF
                      </Button>
                    </div>,
                  ])}
              />
            </Panel>
          </div>
          <aside>
            <Panel
              title="Automated report schedules"
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditor(
                      <RecordDialog
                        title="Add automated report schedule"
                        collection="reportSchedules"
                        initial={{
                          ...newRecord(y),
                          report: "attendance",
                          frequency: "daily",
                          nextRun: schedulerDate,
                          enabled: true,
                          recipientIds: [y.setup.staff[0].id],
                          lastRun: null,
                        }}
                        fields={[
                          {
                            name: "report",
                            label: "Report",
                            type: "select",
                            options: reportKeys.map((value) => ({
                              value,
                              label: reportTitles[value],
                            })),
                          },
                          {
                            name: "frequency",
                            label: "Frequency",
                            type: "select",
                            options: enumOptions([
                              "daily",
                              "weekly",
                              "monthly",
                            ]),
                          },
                          {
                            name: "nextRun",
                            label: "Next run date",
                            type: "date",
                          },
                          {
                            name: "recipientIds",
                            label: "staff recipients",
                            type: "multi",
                            options: staffOptions(y),
                          },
                          {
                            name: "enabled",
                            label: "Enabled",
                            type: "checkbox",
                          },
                        ]}
                        onClose={() => setEditor(null)}
                      />,
                    )
                  }
                >
                  + Schedule
                </Button>
              }
            >
              <div className="ws-panel-body">
                {y.records.reportSchedules.length ? (
                  y.records.reportSchedules.map((s) => (
                    <article key={s.id}>
                      <h3>{reportTitles[s.report]}</h3>
                      <p>
                        {s.frequency} · Next: {s.nextRun}
                      </p>
                      <Badge tone={s.enabled ? "green" : "gray"}>
                        {s.enabled ? "Enabled" : "Paused"}
                      </Badge>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          void act(() =>
                            mutate(
                              (current) =>
                                putRecord(current, "reportSchedules", {
                                  ...s,
                                  enabled: !s.enabled,
                                }),
                              "Updated report schedule",
                            ),
                          )
                        }
                      >
                        {s.enabled ? "Pause" : "Resume"}
                      </Button>
                    </article>
                  ))
                ) : (
                  <p>No schedules configured.</p>
                )}
                <label htmlFor="report-scheduler-date">
                  Run scheduler through
                </label>
                <Input
                  id="report-scheduler-date"
                  type="date"
                  value={schedulerDate}
                  onChange={(e) => setSchedulerDate(e.target.value)}
                />
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      mutate(
                        (current) => runScheduledJobs(current, schedulerDate),
                        "Processed scheduled notices",
                      ),
                    )
                  }
                >
                  Run scheduler
                </Button>
                <p className="ws-hint">
                  Schedules persist locally. The scheduler runs on this button;
                  no background server or real emails.
                </p>
              </div>
            </Panel>
            <Panel title="Recent export queue">
              <div className="ws-panel-body">
                {y.records.exports
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((job) => (
                    <div key={job.id}>
                      <h3>{reportTitles[job.report]}</h3>
                      <p>
                        {job.rowCount} rows ·{" "}
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                      <Button
                        variant="outline"
                        disabled={!job.content}
                        onClick={() =>
                          downloadFile(
                            job.filename,
                            job.content,
                            "text/csv;charset=utf-8",
                          )
                        }
                      >
                        Download saved CSV
                      </Button>
                    </div>
                  ))}
              </div>
            </Panel>
          </aside>
        </div>
        {error && (
          <p role="alert" className="config-errors">
            {error}
          </p>
        )}
        {editor}
      </>
    );
  return (
    <>
      <Tabs items={tabs} route={route} />
      <div className="ws-actions">
        <LinkButton href="/communication/new" variant="default">
          + Quick Notice
        </LinkButton>
        <ExportButton
          name="school-notices"
          report="notices"
          rows={y.records.notices}
        />
      </div>
      <Metrics
        items={[
          { label: "Total notices", value: y.records.notices.length },
          {
            label: "Published",
            value: y.records.notices.filter((n) => n.status === "published")
              .length,
          },
          {
            label: "Scheduled",
            value: y.records.notices.filter((n) => n.status === "scheduled")
              .length,
          },
          {
            label: "Acknowledgments",
            value: y.records.notices.reduce(
              (s, n) => s + n.acknowledgedIds.length,
              0,
            ),
          },
        ]}
      />
      <div className="ws-filter-bar">
        <Select
          aria-label="Notice status"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {enumOptions(["all", "draft", "scheduled", "published"]).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Notice scheduler date"
          type="date"
          value={schedulerDate}
          onChange={(e) => setSchedulerDate(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void act(() =>
              mutate(
                (current) => runScheduledJobs(current, schedulerDate),
                "Ran scheduled local notices",
              ),
            )
          }
        >
          Process scheduled notices
        </Button>
      </div>
      {error && (
        <p className="config-errors" role="alert">
          {error}
        </p>
      )}
      <p className="ws-hint">
        Editing a published notice returns it to draft and clears its previous
        delivery acknowledgments.
      </p>
      {y.records.notices
        .filter(
          (n) =>
            (category === "all" || n.status === category) &&
            `${n.title} ${n.body}`.toLowerCase().includes(search.toLowerCase()),
        )
        .map((n) => (
          <Panel
            key={n.id}
            title={n.title}
            action={
              <Badge
                tone={
                  n.priority === "urgent"
                    ? "red"
                    : n.status === "published"
                      ? "green"
                      : "amber"
                }
              >
                {n.priority} · {n.status}
              </Badge>
            }
          >
            <div className="ws-panel-body">
              <p>{n.body}</p>
              <p>
                {n.channels.join(" · ")} · Audience: {n.audience}
                {n.scheduledFor ? ` · Scheduled: ${n.scheduledFor}` : ""}
              </p>
              <p>
                {n.recipientIds.length} prepared recipients ·{" "}
                {n.acknowledgedIds.length} acknowledgments
              </p>
              <div className="ws-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    setEditor(
                      <RecordDialog
                        title="Edit notice"
                        collection="notices"
                        initial={n}
                        fields={fields}
                        onClose={() => setEditor(null)}
                      />,
                    )
                  }
                >
                  Edit notice
                </Button>
                {n.status === "draft" && (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(() =>
                          mutate(
                            (current) => publishNotice(current, n.id),
                            "Published notice",
                          ),
                        )
                      }
                    >
                      Publish notice
                    </Button>
                    {n.scheduledFor && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          void act(() =>
                            mutate(
                              (current) =>
                                putRecord(current, "notices", {
                                  ...n,
                                  status: "scheduled",
                                }),
                              "Scheduled notice",
                            ),
                          )
                        }
                      >
                        Schedule notice
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </Panel>
        ))}
      {editor}
    </>
  );
}
function ReportPreview({
  report,
  onClose,
}: {
  report: ReportKey;
  onClose: () => void;
}) {
  const { year } = useWorkspace();
  const rows = reportRows(year, report),
    headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].slice(0, 8);
  return (
    <Dialog title={reportTitles[report]} onClose={onClose}>
      <div className="ws-panel" id="report-preview">
        <header className="ws-print-hide">
          <h2>{reportTitles[report]}</h2>
          <Button variant="outline" onClick={onClose}>
            Close preview
          </Button>
          <Button onClick={() => printSection("report-preview")}>
            Print / Save PDF
          </Button>
        </header>
        <Table
          pageSize={Math.max(1, rows.length)}
          headers={headers}
          rows={rows.map((row) =>
            headers.map((h) =>
              row[h] === null
                ? "—"
                : typeof row[h] === "object"
                  ? JSON.stringify(row[h])
                  : String(row[h] ?? ""),
            ),
          )}
        />
      </div>
    </Dialog>
  );
}
