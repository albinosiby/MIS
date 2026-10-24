"use client";
import { useState, type ReactNode } from "react";
import {
  academicReferenceDate,
  academicWeekdayDate,
} from "../../workspace/domain/form-values";
import { roomOccupied } from "../../workspace/domain/room-occupancy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import type { WorkspaceScreenProps } from "../../workspace/components/workspace-screen";
import {
  Panel,
  Badge,
  Table,
  DataForm,
  RecordDialog,
  ConfirmAction,
  LinkButton,
  ExportButton,
  classOptions,
  staffOptions,
  subjectOptions,
  labelFor,
  newRecord,
  enumOptions,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { DesignIcon } from "../../workspace/components/design-icon";
import {
  putRecord,
  removeRecord,
  scope,
} from "../../workspace/domain/operations";
import { readableError } from "../../school-setup/components/form-errors";
import { SubstituteAssignmentDialog } from "./substitute-assignment-dialog";
import { Metrics } from "../../workspace/components/workspace-ui";
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export default function TimetableScreens({
  route,
  search,
}: WorkspaceScreenProps) {
  const { year: y, mutate, busy } = useWorkspace();
  const [classId, setClassId] = useState(y.setup.classes[0].id),
    [day, setDay] = useState("Monday"),
    [date, setDate] = useState(
      academicWeekdayDate(
        y.setup.calendar.year,
        y.records.slots[0]?.weekday ?? "Monday",
      ),
    ),
    [editor, setEditor] = useState<ReactNode>(null),
    [error, setError] = useState("");
  const classes = classOptions(y),
    staff = staffOptions(y),
    subjects = subjectOptions(y),
    periods = y.setup.bells.filter((b) => b.kind === "period");
  const fields: FormField[] = [
    {
      name: "classSectionId",
      label: "Class & section",
      type: "select",
      options: classes,
    },
    {
      name: "weekday",
      label: "Weekday",
      type: "select",
      options: enumOptions(weekdays),
    },
    {
      name: "periodId",
      label: "Period",
      type: "select",
      options: periods.map((p) => ({
        value: p.id,
        label: `${p.name} · ${p.start}–${p.end}`,
      })),
    },
    { name: "subjectId", label: "Subject", type: "select", options: subjects },
    { name: "staffId", label: "Teacher", type: "select", options: staff },
    {
      name: "room",
      label: "Room / laboratory",
      type: "select",
      options: y.records.rooms.map((r) => ({ value: r.name, label: r.name })),
    },
  ];
  function addSlot() {
    setEditor(
      <RecordDialog
        title="Assign timetable slot"
        collection="slots"
        initial={{
          ...newRecord(y),
          classSectionId: classId,
          weekday: day,
          periodId: periods[0]?.id,
          subjectId: y.records.subjects[0]?.id,
          staffId: y.setup.staff[0].id,
          room: y.records.rooms[0]?.name ?? "Room 204",
          status: "draft",
        }}
        fields={fields}
        onClose={() => setEditor(null)}
      />,
    );
  }
  async function act(fn: () => Promise<void>) {
    try {
      await fn();
      setError("");
    } catch (e) {
      setError(readableError(e));
    }
  }
  const slots = y.records.slots.filter(
    (s) => s.classSectionId === classId && s.weekday === day,
  );
  const slotOptions = y.records.slots.map((s) => ({
    value: s.id,
    label: `${s.weekday} · ${labelFor(classes, s.classSectionId)} · ${y.setup.bells.find((b) => b.id === s.periodId)?.name} · ${labelFor(staff, s.staffId)}`,
  }));
  if (route === "/timetable/substitutions")
    return (
      <>
        <div className="ws-actions">
          <LinkButton href="/timetable">← Master timetable</LinkButton>
          <LinkButton href="/attendance/leave">Leave requests</LinkButton>
          <Button
            disabled={!y.records.slots.length || y.locked}
            onClick={() =>
              setEditor(
                <SubstituteAssignmentDialog onClose={() => setEditor(null)} />,
              )
            }
          >
            Assign Substitute Teacher
          </Button>
        </div>
        <Metrics
          items={[
            {
              label: "Scheduled slots",
              value: y.records.slots.length,
              detail: "Choose a class and period to arrange cover",
            },
            {
              label: "Draft allotments",
              value: y.records.substitutions.filter((s) => s.status === "draft")
                .length,
              detail: "Awaiting publication",
            },
            {
              label: "Published allotments",
              value: y.records.substitutions.filter(
                (s) => s.status === "published",
              ).length,
              detail: "Saved coverage for the academic year",
            },
          ]}
        />
        {!y.records.slots.length && (
          <p className="fr-note">
            Create timetable slots before assigning a substitute.
          </p>
        )}
        <Panel title="Faculty substitution ledger">
          <Table
            headers={[
              "Date / target class",
              "Period & subject",
              "Absent teacher",
              "Proxy teacher",
              "Status",
              "Actions",
            ]}
            rows={y.records.substitutions
              .filter((s) =>
                `${labelFor(staff, s.absentStaffId)} ${labelFor(staff, s.substituteStaffId)}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((s) => {
                const slot = y.records.slots.find((v) => v.id === s.slotId)!;
                return [
                  <>
                    {s.date}
                    <br />
                    {labelFor(classes, slot.classSectionId)}
                  </>,
                  <>
                    {y.setup.bells.find((b) => b.id === slot.periodId)?.name}
                    <br />
                    {labelFor(subjects, slot.subjectId)}
                  </>,
                  labelFor(staff, s.absentStaffId),
                  labelFor(staff, s.substituteStaffId),
                  <Badge tone={s.status === "published" ? "green" : "amber"}>
                    {s.status}
                  </Badge>,
                  <div className="ws-actions">
                    {s.status === "draft" ? (
                      <Button
                        variant="outline"
                        onClick={() =>
                          void act(() =>
                            mutate(
                              (current) =>
                                putRecord(current, "substitutions", {
                                  ...s,
                                  status: "published",
                                }),
                              "Published substitution allotment",
                            ),
                          )
                        }
                      >
                        Publish allotment
                      </Button>
                    ) : (
                      <Badge tone="green">allotment saved</Badge>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEditor(
                          <ConfirmAction
                            title="Cancel substitution allotment?"
                            onClose={() => setEditor(null)}
                            onConfirm={() =>
                              mutate(
                                (current) =>
                                  removeRecord(current, "substitutions", s.id),
                                "Cancelled substitute allotment",
                              )
                            }
                          >
                            This removes the allotment and frees the substitute
                            period.
                          </ConfirmAction>,
                        )
                      }
                    >
                      Cancel allotment
                    </Button>
                  </div>,
                ];
              })}
          />
        </Panel>
        {error && (
          <p className="config-errors" role="alert">
            {error}
          </p>
        )}
        {editor}
      </>
    );
  return (
    <>
      {route === "/timetable" && (
        <header className="ws-page-header">
          <div>
            <h1>Master Timetable & Scheduling Hub</h1>
            <p>
              <Badge>
                AY {y.setup.calendar.year.name} ·{" "}
                {slots.every((s) => s.status === "published") && slots.length
                  ? "Published"
                  : "Draft workspace"}
              </Badge>
            </p>
            <p>
              Class schedules, daily teacher substitutions, and facility room
              allocations.
            </p>
          </div>
          <div className="ws-actions">
            <ExportButton
              report="staff"
              name="timetable-grid"
              rows={y.records.slots}
            />
            <LinkButton href="/timetable/builder" variant="default">
              <DesignIcon group="timetable" name="imgContainer4" />
              Create / Edit Timetable
            </LinkButton>
          </div>
        </header>
      )}
      <nav className="ws-tabs" aria-label="Timetable views">
        <LinkButton href="/timetable">
          <DesignIcon group="timetable" name="imgContainer5" />
          Master View
        </LinkButton>
        <LinkButton href="/timetable/builder">
          <DesignIcon group="timetable" name="imgContainer6" />
          Schedule Builder
        </LinkButton>
        <LinkButton href="/timetable/substitutions">
          Proxy & Substitution Dispatch
        </LinkButton>
      </nav>
      <Panel title="Class timetable controls">
        <div className="ws-panel-body">
          <div className="ws-filter-bar">
            <Select
              aria-label="Timetable class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Badge tone="green">
              {
                y.setup.students.filter((s) => s.classSectionId === classId)
                  .length
              }{" "}
              enrolled
            </Badge>
            <Badge>
              {
                y.records.slots.filter((s) => s.classSectionId === classId)
                  .length
              }{" "}
              slots
            </Badge>
            <Input
              aria-label="Facility booking date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="ws-actions">
            {weekdays.map((d) => (
              <Button
                key={d}
                variant={d === day ? "default" : "outline"}
                onClick={() => setDay(d)}
              >
                {d.slice(0, 3)}
              </Button>
            ))}
          </div>
        </div>
      </Panel>
      <div className="ws-two-column">
        <div>
          {route === "/timetable/builder" ? (
            <Panel
              title="Weekly timetable grid"
              action={<Button onClick={addSlot}>+ Assign slot</Button>}
            >
              <Table
                headers={[
                  "Day",
                  "Period",
                  "Subject",
                  "Teacher",
                  "Room",
                  "Actions",
                ]}
                rows={y.records.slots
                  .filter(
                    (s) =>
                      s.classSectionId === classId &&
                      `${labelFor(subjects, s.subjectId)} ${labelFor(staff, s.staffId)}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((s) => [
                    s.weekday,
                    y.setup.bells.find((b) => b.id === s.periodId)?.name,
                    labelFor(subjects, s.subjectId),
                    labelFor(staff, s.staffId),
                    s.room,
                    <div className="ws-actions">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setEditor(
                            <RecordDialog
                              title="Edit timetable slot"
                              collection="slots"
                              initial={{ ...s, status: "draft" }}
                              fields={fields}
                              onClose={() => setEditor(null)}
                            />,
                          )
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setEditor(
                            <ConfirmAction
                              title="Remove timetable slot?"
                              onClose={() => setEditor(null)}
                              onConfirm={() =>
                                mutate(
                                  (current) =>
                                    removeRecord(current, "slots", s.id),
                                  "Removed timetable slot",
                                )
                              }
                            >
                              This removes the saved slot after relationship
                              checks.
                            </ConfirmAction>,
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>,
                  ])}
              />
            </Panel>
          ) : (
            y.setup.bells.map((b) => {
              const slot = slots.find((s) => s.periodId === b.id);
              return b.kind === "break" ? (
                <article className="ws-ledger-card is-break" key={b.id}>
                  <DesignIcon group="timetable" name="imgContainer15" />
                  <h3>{b.name}</h3>
                  <small>
                    {b.start}–{b.end}
                  </small>
                </article>
              ) : (
                <article className="ws-ledger-card" key={b.id}>
                  <div className="ws-time-block">
                    {b.name}
                    <br />
                    {b.start}
                  </div>
                  <div>
                    <h3>
                      {slot
                        ? labelFor(subjects, slot.subjectId)
                        : "Unassigned period"}
                    </h3>
                    <p>
                      {slot
                        ? `${labelFor(staff, slot.staffId)} · ${slot.room}`
                        : "Assign a subject, teacher and room in Schedule Builder."}
                    </p>
                  </div>
                  <Badge tone={slot?.status === "published" ? "green" : "gray"}>
                    {slot?.status ?? "Empty"}
                  </Badge>
                  {slot ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEditor(
                          <RecordDialog
                            title="Edit timetable slot"
                            collection="slots"
                            initial={{ ...slot, status: "draft" }}
                            fields={fields}
                            onClose={() => setEditor(null)}
                          />,
                        )
                      }
                    >
                      Edit
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={addSlot}>
                      Assign
                    </Button>
                  )}
                </article>
              );
            })
          )}
        </div>
        <aside>
          <Panel
            title={
              <>
                <DesignIcon group="timetable" name="imgContainer17" />
                Teacher substitutions
              </>
            }
          >
            <div className="ws-panel-body">
              <p>
                {
                  y.records.leaves.filter(
                    (l) => l.personType === "staff" && l.status === "approved",
                  ).length
                }{" "}
                approved staff leaves
              </p>
              <p>{y.records.substitutions.length} substitute allotments</p>
              <LinkButton href="/timetable/substitutions">
                Assign & publish
              </LinkButton>
            </div>
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="timetable" name="imgContainer18" />
                Room & lab availability
              </>
            }
          >
            <div className="ws-panel-body">
              {y.records.rooms.map((room) => {
                const used = roomOccupied(
                  y.records,
                  date,
                  periods[0]?.id ?? "",
                  room.name,
                );
                return (
                  <div key={room.id}>
                    <h3>{room.name}</h3>
                    <Badge tone={used ? "red" : "green"}>
                      {used ? "Occupied" : "Available"} · {periods[0]?.name}
                    </Badge>
                    <Button
                      variant="ghost"
                      disabled={used}
                      onClick={() =>
                        setEditor(
                          <RecordDialog
                            title="Reserve room / laboratory"
                            collection="reservations"
                            initial={{
                              ...newRecord(y),
                              room: room.name,
                              date,
                              periodId: periods[0]?.id,
                              title: "",
                            }}
                            fields={[
                              { name: "title", label: "Event / purpose" },
                              { name: "date", label: "Date", type: "date" },
                              {
                                name: "periodId",
                                label: "Period",
                                type: "select",
                                options: periods.map((b) => ({
                                  value: b.id,
                                  label: b.name,
                                })),
                              },
                            ]}
                            onClose={() => setEditor(null)}
                          />,
                        )
                      }
                    >
                      Book now
                    </Button>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel
            title={
              <>
                <DesignIcon group="timetable" name="imgContainer19" />
                Bell schedule rules
              </>
            }
          >
            <div className="ws-panel-body">
              <p>
                {periods.length} teaching periods ·{" "}
                {y.setup.bells.filter((b) => b.kind === "break").length} breaks
              </p>
              <p>Teacher, room and class clashes are checked on every save.</p>
              <LinkButton href="/school-setup/bell-schedule">
                Configure →
              </LinkButton>
            </div>
          </Panel>
        </aside>
      </div>
      <Panel title="Saved room reservations">
        <Table
          headers={["Date", "Room", "Period", "Purpose", "Actions"]}
          rows={y.records.reservations.map((r) => [
            r.date,
            r.room,
            y.setup.bells.find((b) => b.id === r.periodId)?.name,
            r.title,
            <Button
              variant="ghost"
              onClick={() =>
                setEditor(
                  <ConfirmAction
                    title="Cancel room reservation?"
                    onClose={() => setEditor(null)}
                    onConfirm={() =>
                      mutate(
                        (current) =>
                          removeRecord(current, "reservations", r.id),
                        "Cancelled room reservation",
                      )
                    }
                  >
                    This frees the room for this period.
                  </ConfirmAction>,
                )
              }
            >
              Cancel reservation
            </Button>,
          ])}
        />
      </Panel>
      {error && (
        <p role="alert" className="config-errors">
          {error}
        </p>
      )}
      <div className="ws-sticky-bar">
        <div>
          <strong>Active draft workspace · {labelFor(classes, classId)}</strong>
          <p className="ws-hint">
            Saved changes persist in the selected academic year.
          </p>
        </div>
        <div className="ws-actions">
          {route === "/timetable/builder" && (
            <Button
              variant="outline"
              onClick={() =>
                setEditor(
                  <ConfirmAction
                    title="Reset selected class timetable?"
                    onClose={() => setEditor(null)}
                    onConfirm={() =>
                      mutate(
                        (current) => ({
                          ...current,
                          records: {
                            ...current.records,
                            slots: current.records.slots.filter(
                              (s) => s.classSectionId !== classId,
                            ),
                            substitutions: current.records.substitutions.filter(
                              (s) =>
                                !current.records.slots.some(
                                  (slot) =>
                                    slot.classSectionId === classId &&
                                    slot.id === s.slotId,
                                ),
                            ),
                          },
                        }),
                        "Reset class timetable grid",
                      )
                    }
                  >
                    All slots and linked substitute allotments for this class
                    will be removed. Export a backup first if you want to
                    restore them.
                  </ConfirmAction>,
                )
              }
            >
              Reset empty grid
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <DesignIcon group="timetable" name="imgContainer1" />
            Print class PDF
          </Button>
          <LinkButton href="/timetable/versions">
            Review & publish timetable version
          </LinkButton>
        </div>
      </div>
      {editor}
    </>
  );
}
