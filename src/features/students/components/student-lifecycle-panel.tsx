"use client";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
  StudentOptions,
} from "../../workspace/hooks/workflow-actions";
export function StudentLifecyclePanel() {
  const { year: y, unavailable, submit } = useWorkflowActions();
  const studentOptions = <StudentOptions />;
  return (
    <form
      className="op-card conversation-form"
      onSubmit={submit("student-lifecycle", (f) => ({
        studentId: text(f, "student"),
        kind: text(f, "kind"),
        classSectionId: text(f, "class") || null,
        date: text(f, "date"),
        note: text(f, "note"),
      }))}
    >
      <h2>Student movement</h2>
      <Field label="Student">
        <select name="student">{studentOptions}</select>
      </Field>
      <Field label="Action">
        <select name="kind">
          <option value="class-changed">Change class</option>
          <option value="transferred">Transfer out</option>
          <option value="withdrawn">Withdraw</option>
        </select>
      </Field>
      <Field label="Destination class (class change only)">
        <select name="class">
          <option value="">Not applicable</option>
          {y.setup.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.grade} {c.section}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Effective date">
        <input
          name="date"
          type="date"
          required
          min={y.setup.calendar.year.startDate}
          max={y.setup.calendar.year.endDate}
        />
      </Field>
      <Field label="Reason">
        <textarea name="note" required minLength={8} maxLength={500} />
      </Field>
      <Button type="submit" disabled={unavailable}>
        Record student movement
      </Button>
      <h3>Movement history</h3>
      {y.workflows.studentEvents.map((e) => (
        <p key={e.id}>
          {y.setup.students.find((s) => s.id === e.studentId)?.displayName} ·{" "}
          {e.date} · {e.kind} · {e.note}
        </p>
      ))}
    </form>
  );
}
