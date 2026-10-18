"use client";
import { academicReferenceDate } from "../domain/form-values";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../hooks/workspace-provider";
import type { WorkspaceScreenProps } from "./workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  DataForm,
  RecordDialog,
  LinkButton,
  ExportButton,
  classOptions,
  staffOptions,
  studentOptions,
  labelFor,
  newRecord,
  money,
  enumOptions,
  type FormField,
} from "./workspace-ui";
import { SetupOverview } from "../../school-setup";
import { wizardPreview } from "../../school-setup/data/setup-preview";
import { titleRoutes } from "../data/screen-catalog";
import {
  putRecord,
  decideApproval,
  decideLeave,
  balance,
} from "../domain/operations";
import { academicEventSchema } from "../../communication/schemas/communication.schema";
import {
  importCalendar,
  calendarIcs,
} from "../../communication/domain/calendar";
import { downloadFile } from "../../school-setup/components/setup-ingestion";
import { readableError } from "../../school-setup/components/form-errors";
export default function DashboardScreens({
  route,
  query,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const router = useRouter();
  const [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [month, setMonth] = useState(
      new Date(
        (query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)
          ? query.month + "-01"
          : academicReferenceDate(y.setup.calendar.year, "10-01")) + "T00:00:00Z",
      ),
    ),
    [view, setView] = useState("Month"),
    [category, setCategory] = useState("all");
  const file = useRef<HTMLInputElement>(null),
    date = academicReferenceDate(y.setup.calendar.year);
  const pending =
    y.records.approvals.filter((a) => a.status === "pending").length +
    y.records.leaves.filter((l) => l.status === "pending").length;
  const fields: FormField[] = [
    { name: "title", label: "Official event title", required: true },
    {
      name: "category",
      label: "Event classification",
      type: "select",
      options: enumOptions([
        "Academic",
        "Exam",
        "Holiday",
        "PTM",
        "Sports",
        "Deadline",
      ]),
    },
    { name: "dates.startDate", label: "Start date", type: "date" },
    { name: "dates.endDate", label: "End date", type: "date" },
    { name: "startTime", label: "Start time (optional)", type: "time" },
    { name: "endTime", label: "End time (optional)", type: "time" },
    { name: "venue", label: "Venue / room" },
    {
      name: "classSectionIds",
      label: "Target cohorts (empty means whole school)",
      type: "multi",
      options: classOptions(y),
    },
    {
      name: "description",
      label: "Description / instructions",
      type: "textarea",
    },
    {
      name: "status",
      label: "Publication state",
      type: "select",
      options: enumOptions(["draft", "published"]),
    },
  ];
  async function act(work: () => Promise<void>) {
    try {
      await work();
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  if (route === "/dashboard/calendar/new")
    return (
      <Panel title="Add academic milestone / statutory event">
        <DataForm
          initial={{
            ...newRecord(y),
            title: "",
            category: "Academic",
            dates: {
              startDate: query.date ?? date,
              endDate: query.date ?? date,
            },
            description: "",
            classSectionIds: [],
            startTime: null,
            endTime: null,
            venue: "",
            sourceUid: null,
            status: "draft",
          }}
          fields={fields}
          submitLabel="Save academic event"
          onSave={async (value) => {
            const parsed = academicEventSchema.parse(value);
            await mutate(
              (current) => putRecord(current, "events", parsed),
              "Created academic calendar event",
            );
            router.push(
              `/dashboard/calendar?month=${parsed.dates.startDate.slice(0, 7)}`,
            );
          }}
        />
      </Panel>
    );
  if (route === "/audit")
    return (
      <>
        <div className="ws-actions">
          <ExportButton
            name="school-audit"
            report="audit"
            rows={y.setup.audit}
          />
          <LinkButton href="/dashboard">← Dashboard</LinkButton>
        </div>
        <Metrics
          items={[
            { label: "Recorded local actions", value: y.setup.audit.length },
            { label: "Current school", value: y.setup.school.shortName },
            { label: "Academic year", value: y.setup.calendar.year.name },
          ]}
        />
        <Panel title="General audit trail">
          <div className="ws-panel-body">
            <p className="ws-hint">
              A bounded local workspace audit trail. It is not a
              cryptographic, immutable or externally certified compliance log.
            </p>
          </div>
          <Table
            headers={["Time", "Actor", "Action", "Event ID"]}
            rows={y.setup.audit
              .slice()
              .reverse()
              .filter((a) =>
                `${a.action} ${a.id}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((a) => [
                new Date(a.at).toLocaleString(),
                a.actor?.displayName ?? "Legacy actor",
                a.action,
                a.id,
              ])}
          />
        </Panel>
      </>
    );
  if (route === "/dashboard/approvals")
    return (
      <>
        <div className="ws-actions">
          <Button
            onClick={() =>
              setEditor(
                <RecordDialog
                  title="Create administrative request"
                  collection="approvals"
                  initial={{
                    ...newRecord(y),
                    title: "",
                    category: "purchase",
                    requesterId: y.setup.staff[0].id,
                    targetId: null,
                    reason: "",
                    amountMinor: 0,
                    status: "pending",
                    decisionNote: "",
                  }}
                  fields={[
                    { name: "title", label: "Request title" },
                    {
                      name: "category",
                      label: "Category",
                      type: "select",
                      options: enumOptions(["gate_pass", "purchase"]),
                    },
                    {
                      name: "requesterId",
                      label: "Requester",
                      type: "select",
                      options: [...staffOptions(y), ...studentOptions(y)],
                    },
                    {
                      name: "reason",
                      label: "Reason / impact (8+ characters)",
                      type: "textarea",
                    },
                    {
                      name: "amountMinor",
                      label: "Amount, if applicable",
                      type: "number",
                      factor: 100,
                    },
                  ]}
                  onClose={() => setEditor(null)}
                />,
              )
            }
          >
            + New request
          </Button>
          <LinkButton href="/attendance/leave">Staff leave requests</LinkButton>
        </div>
        <Metrics
          items={[
            { label: "Pending approvals", value: pending },
            {
              label: "Approved requests",
              value:
                y.records.approvals.filter((a) => a.status === "approved")
                  .length +
                y.records.leaves.filter((l) => l.status === "approved").length,
            },
            {
              label: "Lesson plans to review",
              value: y.records.lessons.filter((l) => l.status === "submitted")
                .length,
            },
          ]}
        />
        <div className="ws-filter-bar">
          <Select
            aria-label="Approval category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {enumOptions([
              "all",
              "concession",
              "exam_unlock",
              "gate_pass",
              "purchase",
            ]).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Panel title="Administrative approvals inbox">
          <Table
            headers={[
              "Requester / request",
              "Category",
              "Scope & impact",
              "Status",
              "Actions",
            ]}
            rows={y.records.approvals
              .filter(
                (a) =>
                  (category === "all" || a.category === category) &&
                  `${a.title} ${a.reason}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((a) => [
                <>
                  {labelFor(
                    [...staffOptions(y), ...studentOptions(y)],
                    a.requesterId,
                  )}
                  <br />
                  <strong>{a.title}</strong>
                </>,
                a.category,
                <>
                  {a.reason}
                  {a.amountMinor > 0 && <p>{money(y, a.amountMinor)}</p>}
                </>,
                <Badge
                  tone={
                    a.status === "pending"
                      ? "amber"
                      : a.status === "approved"
                        ? "green"
                        : "gray"
                  }
                >
                  {a.status}
                </Badge>,
                a.status === "pending" ? (
                  <div className="ws-actions">
                    {(["approved", "rejected"] as const).map((status) => (
                      <Button
                        key={status}
                        variant={status === "approved" ? "default" : "outline"}
                        onClick={() =>
                          setEditor(
                            <Dialog
                              title={`${status === "approved" ? "Authorize" : "Reject"} request`}
                              onClose={() => setEditor(null)}
                            >
                              <DataForm
                                initial={{ note: "" }}
                                fields={[
                                  {
                                    name: "note",
                                    label: "Decision note (8+ characters)",
                                    type: "textarea",
                                  },
                                ]}
                                onSave={async (value) => {
                                  const note = (value as { note: unknown })
                                    .note;
                                  if (typeof note !== "string")
                                    throw new Error("Add a decision note.");
                                  await mutate(
                                    (current) =>
                                      decideApproval(
                                        current,
                                        a.id,
                                        status,
                                        note,
                                      ),
                                    `${status} administrative request ${a.id}`,
                                  );
                                  setEditor(null);
                                }}
                              />
                            </Dialog>,
                          )
                        }
                      >
                        {status === "approved" ? "Authorize" : "Reject"}
                      </Button>
                    ))}
                  </div>
                ) : (
                  a.decisionNote
                ),
              ])}
          />
        </Panel>
        <Panel title="Pending leave & substitution requests">
          <Table
            headers={["Staff / student", "Dates", "Reason", "Action"]}
            rows={y.records.leaves
              .filter((l) => l.status === "pending")
              .map((l) => [
                labelFor(
                  [...staffOptions(y), ...studentOptions(y)],
                  l.personId,
                ),
                `${l.dates.startDate} → ${l.dates.endDate}`,
                l.reason,
                <LinkButton href="/attendance/leave">Review leave</LinkButton>,
              ])}
          />
        </Panel>
        {editor}
      </>
    );
  if (route === "/dashboard/calendar") {
    const first = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1),
    );
    const gridStart = new Date(first);
    gridStart.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    const weekStart = new Date(month);
    weekStart.setUTCDate(month.getUTCDate() - ((month.getUTCDay() + 6) % 7));
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const days = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setUTCDate(d.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const events = y.records.events.filter((e) =>
      `${e.title} ${e.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
    let working = 0;
    for (
      let d = new Date(y.setup.calendar.year.startDate + "T00:00:00Z");
      d.toISOString().slice(0, 10) <= y.setup.calendar.year.endDate;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const iso = d.toISOString().slice(0, 10),
        weekday = d.toLocaleDateString("en-US", {
          weekday: "long",
          timeZone: "UTC",
        });
      if (
        y.records.preferences.workingDays.includes(
          weekday as (typeof y.records.preferences.workingDays)[number],
        ) &&
        !y.records.events.some(
          (e) =>
            e.status === "published" &&
            e.category === "Holiday" &&
            e.dates.startDate <= iso &&
            e.dates.endDate >= iso,
        )
      )
        working++;
    }
    return (
      <>
        <div className="ws-actions">
          <LinkButton href="/dashboard/calendar/new" variant="default">
            + Add Academic Event
          </LinkButton>
          <Button variant="outline" onClick={() => file.current?.click()}>
            Import .ics calendar
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadFile(
                "academic-calendar.ics",
                calendarIcs(y),
                "text/calendar",
              )
            }
          >
            Export .ics
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".ics,text/calendar"
          className="sr-only"
          aria-label="Import iCalendar file"
          onChange={async (e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (!selected) return;
            if (selected.size > 1_000_000) {
              setError("Calendar must be smaller than 1 MB.");
              return;
            }
            try {
              const text = await selected.text();
              await mutate(
                (current) => importCalendar(current, text),
                "Imported iCalendar events",
              );
              setError("");
            } catch (e) {
              setError(readableError(e));
            }
          }}
        />
        <div className="ws-two-column">
          <Panel
            title="Master institutional calendar"
            action={
              <div className="ws-actions">
                {["Month", "Week", "Agenda"].map((v) => (
                  <Button
                    key={v}
                    variant={v === view ? "default" : "outline"}
                    onClick={() => setView(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            }
          >
            <div className="ws-panel-body">
              <div className="ws-actions">
                <Button
                  variant="outline"
                  onClick={() =>
                    setMonth(
                      new Date(
                        Date.UTC(
                          month.getUTCFullYear(),
                          month.getUTCMonth() - (view === "Week" ? 0 : 1),
                          view === "Week" ? month.getUTCDate() - 7 : 1,
                        ),
                      ),
                    )
                  }
                >
                  ← Previous
                </Button>
                <h3>
                  {month.toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </h3>
                <Button
                  variant="outline"
                  onClick={() =>
                    setMonth(
                      new Date(
                        Date.UTC(
                          month.getUTCFullYear(),
                          month.getUTCMonth() + (view === "Week" ? 0 : 1),
                          view === "Week" ? month.getUTCDate() + 7 : 1,
                        ),
                      ),
                    )
                  }
                >
                  Next →
                </Button>
              </div>
            </div>
            {view === "Agenda" ? (
              <Table
                headers={[
                  "Event",
                  "Category",
                  "Date range",
                  "Status",
                  "Actions",
                ]}
                rows={events.map((e) => [
                  e.title,
                  e.category,
                  `${e.dates.startDate} → ${e.dates.endDate}`,
                  <Badge>{e.status}</Badge>,
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor(
                        <RecordDialog
                          title="Edit academic event"
                          collection="events"
                          initial={e}
                          fields={fields}
                          onClose={() => setEditor(null)}
                        />,
                      )
                    }
                  >
                    Edit event
                  </Button>,
                ])}
              />
            ) : (
              <div className="ws-calendar-scroll">
                <div className="ws-calendar-grid">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (d) => (
                      <div key={d} className="ws-day-header">
                        {d}
                      </div>
                    ),
                  )}
                  {(view === "Week" ? weekDays : days).map((iso) => (
                    <div
                      key={iso}
                      style={{
                        opacity:
                          iso.slice(5, 7) ===
                          String(month.getUTCMonth() + 1).padStart(2, "0")
                            ? 1
                            : 0.5,
                      }}
                    >
                      <strong>{Number(iso.slice(-2))}</strong>
                      {events
                        .filter(
                          (e) =>
                            e.dates.startDate <= iso && e.dates.endDate >= iso,
                        )
                        .map((e) => (
                          <button
                            key={e.id}
                            onClick={() =>
                              setEditor(
                                <RecordDialog
                                  title="Academic event details"
                                  collection="events"
                                  initial={e}
                                  fields={fields}
                                  onClose={() => setEditor(null)}
                                />,
                              )
                            }
                          >
                            {e.title} {e.startTime ?? ""}
                            <br />
                            <small>{e.status}</small>
                          </button>
                        ))}
                      {iso >= y.setup.calendar.year.startDate &&
                        iso <= y.setup.calendar.year.endDate && (
                          <button
                            aria-label={`Add event on ${iso}`}
                            onClick={() =>
                              router.push("/dashboard/calendar/new?date=" + iso)
                            }
                          >
                            + Event
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <aside>
            <Panel title="Instructional days tracker">
              <div className="ws-panel-body">
                <h3>{working} planned working days</h3>
                <p>
                  Calculated from the working week and published holiday
                  records.
                </p>
                <LinkButton href="/settings">Configure working week</LinkButton>
              </div>
            </Panel>
            <Panel title="Upcoming milestones">
              <div className="ws-panel-body">
                {events
                  .filter(
                    (e) => e.status === "published" && e.dates.endDate >= date,
                  )
                  .sort((a, b) =>
                    a.dates.startDate.localeCompare(b.dates.startDate),
                  )
                  .slice(0, 6)
                  .map((e) => (
                    <div key={e.id}>
                      <h3>{e.title}</h3>
                      <p>
                        {e.dates.startDate} · {e.category}
                      </p>
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
  }
  const today = y.records.attendance.filter(
      (a) =>
        a.date === date && a.personType === "student" && a.periodId === null,
    ),
    present = today.filter((a) =>
      ["present", "late"].includes(a.status),
    ).length,
    collected = y.records.payments
      .filter((p) => p.status === "completed")
      .reduce((s, p) => s + p.amountMinor - p.refundedMinor, 0),
    unpaid = y.records.invoices.filter(
      (i) => i.status === "issued" && balance(y, i.id) > 0,
    ).length;
  return (
    <>
      <SetupOverview
        referenceDate={academicReferenceDate(y.setup.calendar.year, "10-17")}
        variant="operations"
        inspect={(title) => router.push(titleRoutes[title] ?? "/dashboard")}
        school={y.setup.school}
        principal={y.setup.staff[0]}
        summary={{
          ...wizardPreview.summary,
          completionPercent: Math.round((y.setup.completed.length / 8) * 100),
          pendingApprovals: pending,
          upcomingEvents: y.records.events.filter(
            (e) => e.status === "published" && e.dates.endDate >= date,
          ).length,
        }}
        metrics={
          <Metrics
            items={[
              {
                label: "Campus attendance",
                value: `${today.length ? Math.round((present / today.length) * 100) : 0}%`,
                detail: `${today.length} saved daily marks`,
              },
              {
                label: "Fee collections",
                value: money(y, collected),
                detail: "Recorded entries",
              },
              {
                label: "Admissions",
                value: y.records.inquiries.length,
                detail: "Active intake records",
              },
              {
                label: "Staff leave requests",
                value: y.records.leaves.filter(
                  (l) => l.personType === "staff" && l.status === "pending",
                ).length,
              },
              {
                label: "Health & documents",
                value: y.records.studentProfiles.filter((p) =>
                  p.documents.some((d) => d.status === "pending"),
                ).length,
                detail: "Document reviews pending",
              },
              { label: "Pending approvals", value: pending },
            ]}
          />
        }
      />
      <div className="ws-two-column">
        <div>
          <Panel
            title="Admissions pipeline & conversion velocity"
            action={
              <LinkButton href="/admissions/analytics">
                Export / view funnel
              </LinkButton>
            }
          >
            <div className="ws-panel-body">
              {["new", "application", "assessment", "offered", "enrolled"].map(
                (stage) => {
                  const n = y.records.inquiries.filter(
                    (i) => i.stage === stage,
                  ).length;
                  return (
                    <div key={stage}>
                      <h3>
                        {stage.replaceAll("_", " ")} · {n}
                      </h3>
                      <div className="ws-progress">
                        <span
                          style={{
                            width:
                              (n / Math.max(1, y.records.inquiries.length)) *
                                100 +
                              "%",
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
              <LinkButton href="/admissions/inquiries">
                Manage inquiries
              </LinkButton>
            </div>
          </Panel>
          <Panel title="Academic year onboarding setup">
            <div className="ws-panel-body">
              <h3>{y.setup.completed.length}/8 phases signed off</h3>
              <div className="ws-progress">
                <span
                  style={{ width: (y.setup.completed.length / 8) * 100 + "%" }}
                />
              </div>
              <LinkButton href="/school-setup">Resume setup →</LinkButton>
            </div>
          </Panel>
          <Panel title="Grade intake capacity">
            <Table
              headers={["Cohort", "Enrolled", "Capacity", "Utilization"]}
              rows={y.setup.classes.map((c) => {
                const n = y.setup.students.filter(
                  (s) => s.classSectionId === c.id,
                ).length;
                return [
                  `${c.grade}-${c.section}`,
                  n,
                  c.capacity,
                  <Badge tone={n / c.capacity > 0.9 ? "amber" : "green"}>
                    {Math.round((n / c.capacity) * 100)}%
                  </Badge>,
                ];
              })}
            />
          </Panel>
        </div>
        <aside>
          <Panel title="Urgent operational alerts">
            <div className="ws-panel-body">
              <h3>{pending} approvals awaiting review</h3>
              <LinkButton href="/dashboard/approvals">
                Open approvals inbox
              </LinkButton>
              <h3>{unpaid} outstanding fee invoices</h3>
              <LinkButton href="/fees">Review balances</LinkButton>
              <h3>
                {
                  y.records.lessons.filter((l) => l.status === "submitted")
                    .length
                }{" "}
                lesson plans to review
              </h3>
              <LinkButton href="/academics/lessons">
                Review lesson plans
              </LinkButton>
            </div>
          </Panel>
          <Panel title="Exam readiness">
            <div className="ws-panel-body">
              {y.records.exams.map((e) => (
                <p key={e.id}>
                  {e.name} <Badge>{e.status}</Badge>
                </p>
              ))}
              <LinkButton href="/exams">Exams & results</LinkButton>
            </div>
          </Panel>
          <Panel title="Recent notifications">
            <div className="ws-panel-body">
              {y.records.notifications.slice(0, 4).map((n) => (
                <p key={n.id}>{n.title}</p>
              ))}
              <LinkButton href="/notifications">All notifications →</LinkButton>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
