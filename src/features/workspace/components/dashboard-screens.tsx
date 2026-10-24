"use client";
import { academicReferenceDate } from "../domain/form-values";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useWorkspace } from "../hooks/workspace-provider";
import type { WorkspaceScreenProps } from "./workspace-screen";
import {
  Panel,
  Metrics,
  Badge,
  Table,
  RecordDialog,
  LinkButton,
  classOptions,
  enumOptions,
  type FormField,
} from "./workspace-ui";
import { OperationsDashboard } from "./operations-dashboard";
import { AuditLog, ApprovalsInbox } from "./administration-first-row";
import { AcademicEventComposer } from "../../communication/components/academic-event-composer";
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
          : academicReferenceDate(y.setup.calendar.year, "10-01")) +
          "T00:00:00Z",
      ),
    ),
    [view, setView] = useState("Month"),
    [category, setCategory] = useState("all");
  const file = useRef<HTMLInputElement>(null),
    date = academicReferenceDate(y.setup.calendar.year);
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
  if (route === "/dashboard/calendar/new")
    return <AcademicEventComposer initialDate={query.date} />;
  if (route === "/audit") return <AuditLog search={search} />;
  if (route === "/dashboard/approvals")
    return <ApprovalsInbox search={search} />;
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
    const events = y.records.events.filter(
      (e) =>
        (category === "all" || e.category === category) &&
        `${e.title} ${e.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    const monthEnd = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    )
      .toISOString()
      .slice(0, 10);
    const monthEvents = events.filter(
      (e) =>
        e.dates.startDate <= monthEnd &&
        e.dates.endDate >= first.toISOString().slice(0, 10),
    );
    const upcoming = events
      .filter((e) => e.status === "published" && e.dates.endDate >= date)
      .sort((a, b) => a.dates.startDate.localeCompare(b.dates.startDate));
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
        <div className="fr-toolbar">
          <p>Plan your school year with published and draft events.</p>
          <div className="ws-actions">
            <LinkButton href="/dashboard/calendar/new" variant="default">
              + Add Academic Event
            </LinkButton>
            <Button
              variant="outline"
              disabled={busy || y.locked}
              onClick={() => file.current?.click()}
            >
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
        </div>
        <Metrics
          items={[
            {
              label: "Published events",
              value: y.records.events.filter((e) => e.status === "published")
                .length,
              detail: "Visible in the school calendar",
            },
            {
              label: "Draft events",
              value: y.records.events.filter((e) => e.status === "draft")
                .length,
              detail: "Awaiting publication",
            },
            {
              label: "Planned working days",
              value: working,
              detail: "Configured week less published holidays",
            },
          ]}
        />
        <div className="ws-filter-bar">
          <label className="fr-filter">
            Event category
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {["Academic", "Exam", "Holiday", "PTM", "Sports", "Deadline"].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </Select>
          </label>
          <p className="ws-hint">
            {monthEvents.length} matching events in{" "}
            {month.toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setMonth(new Date(date + "T00:00:00Z"));
              setCategory("all");
            }}
          >
            Reference month
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
        <div className="fr-columns">
          <Panel
            title="Master institutional calendar"
            action={
              <div className="ws-actions">
                {["Month", "Week", "Agenda"].map((v) => (
                  <Button
                    key={v}
                    aria-pressed={v === view}
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
                rows={monthEvents.map((e) => [
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
            <div className="fr-calendar-legend">
              <span>Draft · review pending</span>
              <span>Published · school calendar</span>
            </div>
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
                {!upcoming.length && (
                  <p className="fr-empty">
                    No upcoming published events match your search and category.
                  </p>
                )}
                {upcoming.slice(0, 6).map((e) => (
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
  return <OperationsDashboard year={y} search={search} />;
}
