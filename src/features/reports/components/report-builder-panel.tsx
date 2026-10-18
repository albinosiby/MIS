"use client";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
} from "../../workspace/hooks/workflow-actions";
import { useState } from "react";
import { reportColumns } from "../data/report-columns";
export function ReportBuilderPanel() {
  const { year: y, actor, unavailable, submit, run } = useWorkflowActions();
  const [source, setSource] = useState<keyof typeof reportColumns>("students");
  return (
    <>
      <form
        className="op-card conversation-form"
        onSubmit={submit("report-builder", (f) => ({
          id: crypto.randomUUID(),
          name: text(f, "name"),
          source,
          columns: f.getAll("columns"),
          filters: text(f, "filter-field")
            ? [
                {
                  field: text(f, "filter-field"),
                  operator: text(f, "operator"),
                  value: text(f, "filter-value"),
                },
              ]
            : [],
        }))}
      >
        <h2>Create a report</h2>
        <Field label="Report name">
          <input name="name" required minLength={2} maxLength={100} />
        </Field>
        <Field label="Data source">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
          >
            {Object.keys(reportColumns).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <fieldset key={source}>
          <legend>Columns</legend>
          {reportColumns[source].map((c) => (
            <label className="mr-4" key={c}>
              <input type="checkbox" name="columns" value={c} defaultChecked />{" "}
              {c}
            </label>
          ))}
        </fieldset>
        <Field label="Optional filter">
          <select name="filter-field">
            <option value="">All records</option>
            {reportColumns[source].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <select name="operator" aria-label="Filter comparison">
          {["equals", "contains", "gte", "lte"].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <input name="filter-value" aria-label="Filter value" maxLength={200} />
        <Button type="submit" disabled={unavailable}>
          Save report definition
        </Button>
      </form>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={submit("report-schedule", (f) => ({
          id: crypto.randomUUID(),
          reportId: text(f, "report"),
          frequency: text(f, "frequency"),
          nextRun: text(f, "date"),
          enabled: true,
          recipientIds: [actor.id],
        }))}
      >
        <h2>Schedule a report</h2>
        <p>
          The school worker generates a saved snapshot and sends an in-app
          notification to you. External delivery remains disconnected.
        </p>
        <Field label="Saved report">
          <select name="report" required>
            <option value="">Choose report</option>
            {y.workflows.reportBuilders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Frequency">
          <select name="frequency">
            {["daily", "weekly", "monthly"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </Field>
        <Field label="First run date">
          <input type="date" name="date" required />
        </Field>
        <Button type="submit" disabled={unavailable}>
          Schedule report for me
        </Button>
        {y.workflows.reportSchedules.map((r) => (
          <div key={r.id}>
            <p>
              {
                y.workflows.reportBuilders.find((b) => b.id === r.reportId)
                  ?.name
              }{" "}
              · {r.frequency} · next {r.nextRun} ·{" "}
              {r.enabled ? "enabled" : "paused"}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={unavailable}
              onClick={() =>
                void run("report-schedule", {
                  id: r.id,
                  reportId: r.reportId,
                  frequency: r.frequency,
                  nextRun: r.nextRun,
                  enabled: !r.enabled,
                  recipientIds: r.recipientIds,
                })
              }
            >
              {r.enabled ? "Pause" : "Resume"} schedule
            </Button>
          </div>
        ))}
      </form>
      <section className="op-card mt-6">
        <h2>Saved reports</h2>
        {y.workflows.reportBuilders.map((r) => (
          <div key={r.id} className="mb-5">
            <h3>{r.name}</h3>
            <p>
              {r.source} · {r.columns.join(", ")}
            </p>
            <Button
              disabled={unavailable}
              onClick={() => void run("report-publish", { id: r.id })}
            >
              Generate published snapshot
            </Button>
          </div>
        ))}
      </section>
    </>
  );
}
