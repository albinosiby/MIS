"use client";
import { useState, type ReactNode } from "react";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
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
  studentOptions,
  labelFor,
  newRecord,
  enumOptions,
} from "../../workspace/components/workspace-ui";
import { scope, decideLeave } from "../../workspace/domain/operations";
import { saveRegister } from "../domain/save-register";
import type { AttendanceRecord } from "../models";
import { readableError } from "../../school-setup/components/form-errors";
const tabs = [
  ["/attendance", "Daily Attendance"],
  ["/attendance/periods", "Period-wise"],
  ["/attendance/staff", "Staff Attendance"],
  ["/attendance/leave", "Leave Requests"],
] as const;
export default function AttendanceScreens({
  route,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const [classId, setClassId] = useState(y.setup.classes[0]?.id ?? ""),
    [date, setDate] = useState(
      academicReferenceDate(y.setup.calendar.year, "10-14"),
    ),
    [period, setPeriod] = useState(
      y.setup.bells.find((b) => b.kind === "period")?.id ?? "",
    ),
    [draft, setDraft] = useState<Record<string, AttendanceRecord["status"]>>(
      {},
    ),
    [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const staff = route === "/attendance/staff",
    periodId = route === "/attendance/periods" ? period : null;
  const people = (
    staff
      ? y.setup.staff
      : y.setup.students.filter(
          (s) =>
            s.classSectionId === classId &&
            !y.records.studentProfiles.some(
              (p) => p.studentId === s.id && p.status !== "active",
            ),
        )
  ).filter((s) =>
    `${s.displayName} ${s.id}`.toLowerCase().includes(search.toLowerCase()),
  );
  const status = (id: string): AttendanceRecord["status"] =>
    draft[id] ??
    y.records.attendance.find(
      (r) =>
        r.personId === id &&
        r.personType === (staff ? "staff" : "student") &&
        r.date === date &&
        r.periodId === periodId,
    )?.status ??
    (y.records.leaves.some(
      (l) =>
        l.personId === id &&
        l.personType === (staff ? "staff" : "student") &&
        l.status === "approved" &&
        l.dates.startDate <= date &&
        l.dates.endDate >= date,
    )
      ? "excused"
      : "present");
  const names = [...studentOptions(y), ...staffOptions(y)];
  return (
    <>
      <Tabs items={tabs} route={route} />
      {route === "/attendance/leave" ? (
        <>
          <div className="ws-actions">
            <Button
              onClick={() =>
                setEditor(
                  <RecordDialog
                    title="Request leave"
                    collection="leaves"
                    initial={{
                      ...newRecord(y),
                      personType: "staff",
                      personId: y.setup.staff[0].id,
                      dates: { startDate: date, endDate: date },
                      reason: "",
                      status: "pending",
                      decisionNote: "",
                    }}
                    fields={[
                      {
                        name: "personType",
                        label: "Person type",
                        type: "select",
                        options: enumOptions(["student", "staff"]),
                      },
                      {
                        name: "personId",
                        label: "Requester",
                        type: "select",
                        options: names,
                      },
                      { name: "dates.startDate", label: "From", type: "date" },
                      { name: "dates.endDate", label: "Through", type: "date" },
                      {
                        name: "reason",
                        label: "Reason (8+ characters)",
                        type: "textarea",
                      },
                    ]}
                    onClose={() => setEditor(null)}
                  />,
                )
              }
            >
              + Request leave
            </Button>
            <LinkButton href="/timetable/substitutions">
              Faculty substitution desk
            </LinkButton>
          </div>
          <Metrics
            items={[
              {
                label: "Awaiting decision",
                value: y.records.leaves.filter((l) => l.status === "pending")
                  .length,
              },
              {
                label: "Approved",
                value: y.records.leaves.filter((l) => l.status === "approved")
                  .length,
              },
              {
                label: "Rejected",
                value: y.records.leaves.filter((l) => l.status === "rejected")
                  .length,
              },
            ]}
          />
          <Panel title="Leave requests & approval ledger">
            <Table
              headers={["Requester", "Dates", "Reason", "Status", "Decision"]}
              rows={y.records.leaves
                .filter((l) =>
                  `${labelFor(names, l.personId)} ${l.reason}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((l) => [
                  <>
                    {labelFor(names, l.personId)}
                    <br />
                    <small>{l.personType}</small>
                  </>,
                  `${l.dates.startDate} → ${l.dates.endDate}`,
                  l.reason,
                  <Badge
                    tone={
                      l.status === "approved"
                        ? "green"
                        : l.status === "pending"
                          ? "amber"
                          : "red"
                    }
                  >
                    {l.status}
                  </Badge>,
                  l.status === "pending" ? (
                    <div className="ws-actions">
                      {(["approved", "rejected"] as const).map((decision) => (
                        <Button
                          key={decision}
                          variant={
                            decision === "approved" ? "default" : "outline"
                          }
                          onClick={() =>
                            setEditor(
                              <Dialog
                                title={`${decision === "approved" ? "Approve" : "Reject"} leave`}
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
                                        decideLeave(
                                          current,
                                          l.id,
                                          decision,
                                          note,
                                        ),
                                      `${decision} leave request ${l.id}`,
                                      { type: "hr-leave", id: l.id, decision, note },
                                    );
                                    setEditor(null);
                                  }}
                                />
                              </Dialog>,
                            )
                          }
                        >
                          {decision === "approved" ? "Approve" : "Reject"}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    l.decisionNote
                  ),
                ])}
            />
          </Panel>
        </>
      ) : (
        <>
          <div className="ws-filter-bar">
            {!staff && (
              <Select
                aria-label="Attendance class"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setDraft({});
                }}
              >
                {classOptions(y).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
            <Input
              aria-label="Register date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDraft({});
              }}
              min={y.setup.calendar.year.startDate}
              max={y.setup.calendar.year.endDate}
            />
            {route === "/attendance/periods" && (
              <Select
                aria-label="Attendance period"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setDraft({});
                }}
              >
                {y.setup.bells
                  .filter((b) => b.kind === "period")
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.start}–{b.end}
                    </option>
                  ))}
              </Select>
            )}
            <Button
              variant="outline"
              onClick={() =>
                setDraft(
                  Object.fromEntries(
                    people.map((p) => [
                      p.id,
                      y.records.leaves.some(
                        (l) =>
                          l.personId === p.id &&
                          l.personType === (staff ? "staff" : "student") &&
                          l.status === "approved" &&
                          l.dates.startDate <= date &&
                          l.dates.endDate >= date,
                      )
                        ? "excused"
                        : "present",
                    ]),
                  ),
                )
              }
            >
              Mark all visible present
            </Button>
            <ExportButton
              report="attendance"
              name={`attendance-${date}`}
              rows={y.records.attendance.filter(
                (r) =>
                  r.date === date &&
                  r.personType === (staff ? "staff" : "student") &&
                  r.periodId === periodId,
              )}
            />
          </div>
          <Metrics
            items={[
              { label: "Register strength", value: people.length },
              {
                label: "Present",
                value: people.filter((p) => status(p.id) === "present").length,
              },
              {
                label: "Absent",
                value: people.filter((p) => status(p.id) === "absent").length,
              },
              {
                label: "Late / excused",
                value: people.filter((p) =>
                  ["late", "excused"].includes(status(p.id)),
                ).length,
              },
            ]}
          />
          <Panel
            title={
              staff ? "Staff daily attendance" : "Student attendance register"
            }
          >
            <Table
              headers={[
                "Person / ID",
                "Status",
                "Last saved note",
                "Quick marks",
              ]}
              rows={people.map((p) => [
                <>
                  <strong>{p.displayName}</strong>
                  <br />
                  <small>
                    {"admissionNumber" in p ? p.admissionNumber : p.id}
                  </small>
                </>,
                <Badge
                  tone={
                    status(p.id) === "present"
                      ? "green"
                      : status(p.id) === "absent"
                        ? "red"
                        : "amber"
                  }
                >
                  {status(p.id)}
                </Badge>,
                y.records.attendance.find(
                  (r) =>
                    r.personId === p.id &&
                    r.date === date &&
                    r.periodId === periodId,
                )?.note || "—",
                <Select
                  aria-label={`Attendance for ${p.displayName}`}
                  value={status(p.id)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [p.id]: e.target.value as AttendanceRecord["status"],
                    }))
                  }
                >
                  {enumOptions(["present", "absent", "late", "excused"]).map(
                    (o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ),
                  )}
                </Select>,
              ])}
            />
          </Panel>
          {error && (
            <p role="alert" className="config-errors">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="config-success">
              {message}
            </p>
          )}
          <div className="ws-sticky-bar">
            <p>
              Save before changing the date or cohort. Only the visible filtered
              register is submitted.
            </p>
            <Button
              disabled={busy || !people.length}
              onClick={async () => {
                try {
                  await mutate(
                    (current) =>
                      saveRegister(current, {
                        ...scope(current),
                        classSectionId: staff ? null : classId,
                        personType: staff ? "staff" : "student",
                        date,
                        periodId,
                        entries: people.map((p) => ({
                          personId: p.id,
                          status: status(p.id),
                          note: "",
                        })),
                      }),
                    "Saved attendance register",
                    staff ? { type: "hr-register", input: { ...scope(y), classSectionId: null, personType: "staff", date, periodId, entries: people.map(p => ({ personId: p.id, status: status(p.id), note: "" })) } } : undefined,
                  );
                  setDraft({});
                  setError("");
                  setMessage(
                    `Saved ${people.length} attendance records for ${date}.`,
                  );
                } catch (e) {
                  setError(readableError(e));
                }
              }}
            >
              Save attendance register
            </Button>
          </div>
        </>
      )}
      {editor}
    </>
  );
}
