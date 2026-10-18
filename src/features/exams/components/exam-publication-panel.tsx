"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
  StudentOptions,
} from "../../workspace/hooks/workflow-actions";
export function ExamPublicationPanel() {
  const { year: y, unavailable, submit } = useWorkflowActions();
  const studentOptions = <StudentOptions />;
  return (
    <>
      <form
        className="op-card conversation-form"
        onSubmit={submit("results-publish", (f) => ({
          examId: text(f, "exam"),
          publishedScaleIds: f.getAll("scale"),
          templateId: text(f,"template") || null,
          gradeBands: [
            { label: "A1", minimum: 91 },
            { label: "A2", minimum: 81 },
            { label: "B1", minimum: 71 },
            { label: "B2", minimum: 61 },
            { label: "C1", minimum: 51 },
            { label: "C2", minimum: 41 },
            { label: "D", minimum: 33 },
            { label: "E", minimum: 0 },
          ],
        }))}
      >
        <h2>Issue assessment report cards</h2>
        <p>
          Every active student's subject marks must be complete. Issued
          snapshots lock the assessment and remain unchanged when other records
          change.
        </p>
        <Field label="Published assessment">
          <select required name="exam">
            <option value="">Select assessment</option>
            {y.records.exams
              .filter((e) => e.status === "published")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </Field>
        <p>
          Default school grade bands: A1 91+, A2 81+, B1 71+, B2 61+, C1 51+, C2
          41+, D 33+, E below 33.
        </p>
        <fieldset><legend>Published grade rows (leave empty for default bands)</legend>{y.extensions.filter(r=>r.kind==="grading-scales"&&r.status==="published").map(r=><label key={r.id}><input type="checkbox" name="scale" value={r.id}/> {String(r.values.grade)} · {String(r.values.minimum)}+</label>)}</fieldset>
        <Field label="Published report template"><select name="template"><option value="">Standard report card</option>{y.extensions.filter(r=>r.kind==="report-templates"&&r.status==="published").map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></Field>
        <Button type="submit" disabled={unavailable}>
          Publish & lock results
        </Button>
        <Link href="/exams/reviews">Review and correct locked results →</Link>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("transcript-publish", (f) => ({
          studentId: text(f, "student"),
          title: text(f, "title"),
          weights: y.records.exams
            .filter((e) => Number(f.get(e.id)) > 0)
            .map((e) => ({
              examId: e.id,
              weightBps: Math.round(Number(f.get(e.id)) * 100),
            })),
        }))}
      >
        <h2>Weighted transcript</h2>
        <Field label="Student">
          <select name="student">{studentOptions}</select>
        </Field>
        <Field label="Transcript title">
          <input name="title" defaultValue="Academic transcript" required />
        </Field>
        {y.records.exams
          .filter((e) => e.status === "completed")
          .map((e) => (
            <Field key={e.id} label={`${e.name} weight (%)`}>
              <input
                name={e.id}
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={0}
              />
            </Field>
          ))}
        <p>
          Weights must total 100%. Publish report cards for every selected
          assessment first.
        </p>
        <Button type="submit" disabled={unavailable}>
          Issue transcript
        </Button>
      </form>
    </>
  );
}
