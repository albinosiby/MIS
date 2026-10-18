"use client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
  StudentOptions,
} from "../../workspace/hooks/workflow-actions";
export function CertificateIssuePanel() {
  const { year: y, unavailable, submit, run } = useWorkflowActions();
  const studentOptions = <StudentOptions />;
  return (
    <form
      className="op-card conversation-form"
      onSubmit={submit("certificate-bulk", (f) => ({
        studentIds: f.getAll("students"),
        templateId: text(f, "template"),
        type: text(f, "type"),
        issuedOn: text(f, "date"),
      }))}
    >
      <h2>Issue certificates in a batch</h2>
      <p>
        Each student receives a serial-numbered, immutable document snapshot.
        Transfer certificates also mark the student as transferred.
        Signing-provider integration remains disconnected.
      </p>
      <Field label="Students">
        <select name="students" multiple required size={8}>
          {studentOptions}
        </select>
      </Field>
      <Field label="Published template">
        <select name="template" required>
          <option value="">Choose a template</option>
          {y.extensions
            .filter(
              (t) =>
                t.kind === "certificate-templates" && t.status === "published",
            )
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Certificate type">
        <select name="type">
          {[
            "Bonafide",
            "Transfer Certificate",
            "Study Certificate",
            "ID Card",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Issue date">
        <input
          name="date"
          type="date"
          min={y.setup.calendar.year.startDate}
          max={y.setup.calendar.year.endDate}
          required
        />
      </Field>
      <p>
        Template placeholders: school, student, admissionNumber, year, issuedOn
        and classSection, each inside double braces.
      </p>
      <Link href="/documents/certificate-templates">Manage templates →</Link>
      <Button type="submit" disabled={unavailable}>
        Issue selected certificates
      </Button>
      <h3>Existing issued certificates</h3>
      {y.records.certificates
        .filter(
          (c) =>
            c.status === "issued" &&
            !y.workflows.publications.some(
              (p) => p.sourceId === c.id && p.kind === "certificate",
            ),
        )
        .map((c) => (
          <div key={c.id}>
            <p>
              {c.reference} · {c.type}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={unavailable}
              onClick={() => void run("certificate-publish", { id: c.id })}
            >
              Create downloadable snapshot
            </Button>
          </div>
        ))}
    </form>
  );
}
