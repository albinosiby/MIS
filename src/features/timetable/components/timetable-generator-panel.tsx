"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
  StaffOptions,
} from "../../workspace/hooks/workflow-actions";
export function TimetableGeneratorPanel() {
  const { year: y, unavailable, submit, run } = useWorkflowActions();
  const staffOptions = <StaffOptions />;
  return (
    <form
      className="op-card conversation-form"
      onSubmit={submit("timetable-generate", (f) => ({
        maxPeriodsPerTeacherPerDay: Number(f.get("workload")),
        days: f.getAll("days"),
        replaceDrafts: f.has("replace"),
        unavailable: f.getAll("unavailable").flatMap((periodId) =>
          f.getAll("days").map((weekday) => ({
            staffId: text(f, "staff"),
            weekday,
            periodId,
          })),
        ),
        requirements: [
          {
            classSectionId: text(f, "class"),
            subjectId: text(f, "subject"),
            staffId: text(f, "staff"),
            room: text(f, "room"),
            periodsPerWeek: Number(f.get("periods")),
          },
        ],
      }))}
    >
      <h2>Generate a timetable batch</h2>
      <p>
        Existing published slots are kept. A batch is saved only when all
        requested periods fit without teacher, class or room clashes.
      </p>
      <Field label="Class">
        <select name="class">
          {y.setup.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade} {c.section}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Subject">
        <select name="subject">
          {y.records.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Teacher">
        <select name="staff">{staffOptions}</select>
      </Field>
      <Field label="Room">
        <select name="room">
          {y.records.rooms.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name} · {r.capacity} seats
            </option>
          ))}
        </select>
      </Field>
      <Field label="Periods per week">
        <input
          name="periods"
          type="number"
          required
          min={1}
          max={40}
          defaultValue={5}
        />
      </Field>
      <Field label="Teacher daily limit">
        <input
          name="workload"
          type="number"
          required
          min={1}
          max={12}
          defaultValue={6}
        />
      </Field>
      <div className="op-links">
        {[
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].map((d) => (
          <label key={d}>
            <input
              type="checkbox"
              name="days"
              value={d}
              defaultChecked={d !== "Saturday"}
            />
            {d}
          </label>
        ))}
      </div>
      <fieldset>
        <legend>Teacher unavailable periods on selected days</legend>
        {y.setup.bells
          .filter((b) => b.kind === "period")
          .map((b) => (
            <label className="mr-4" key={b.id}>
              <input type="checkbox" name="unavailable" value={b.id} /> {b.name}
            </label>
          ))}
      </fieldset>
      <label>
        <input type="checkbox" name="replace" /> Replace unpublished draft slots
      </label>
      <Button type="submit" disabled={unavailable}>
        Generate complete draft
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={unavailable || !y.records.slots.length}
        onClick={() => void run("timetable-publish", {})}
      >
        Publish timetable version
      </Button>
      <Link href="/timetable">Review timetable →</Link>
      <Link href="/timetable/versions">Publication history & substitution reviews →</Link>
    </form>
  );
}
