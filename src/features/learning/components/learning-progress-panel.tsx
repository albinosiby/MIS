"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  scopedStudentIds,
  visibleOperations,
} from "../../operations/domain/operations";
import { recordLearningProgress } from "../domain/progress";
import type { AccountIdentity } from "../../identity/models";
export function LearningProgressPanel({ actor }: { actor: AccountIdentity }) {
  const { year: y, mutate, busy } = useWorkspace(),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const ids = scopedStudentIds(y, actor),
    resources = visibleOperations(y, actor, "resources").filter(
      (r) => r.status === "published",
    ),
    progress = y.workflows.learningProgress.filter((p) =>
      ids.includes(p.studentId),
    );
  async function mark(resourceId: string, state: "started" | "completed") {
    setError("");
    try {
      const input = { resourceId, state };
      await mutate(
        (year) => recordLearningProgress(year, actor, input),
        "Updated student-reported learning progress",
        { type: "workflow", input: { action: "learning-progress", input } },
      );
      setStatus("Your progress has been saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save progress.");
    }
  }
  return (
    <section className="op-card">
      <h2>Learning progress</h2>
      <p>
        Students report when they start or complete assigned resources. This
        records reported progress rather than verifying time spent on external
        services.
      </p>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {!resources.length && (
        <p>No published resources are currently assigned.</p>
      )}
      {actor.role === "student" ? (
        resources.map((r) => {
          const entry = progress.find(
            (p) => p.resourceId === r.id && p.studentId === actor.personId,
          );
          return (
            <article className="conversation-notice" key={r.id}>
              <div>
                <strong>{r.title}</strong>
                <p>
                  {entry?.state ?? "Not started"}
                  {entry ? ` · ${entry.updatedAt.slice(0, 10)}` : ""}
                </p>
                <a
                  href={String(r.values.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open resource →
                </a>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    y.locked ||
                    entry?.state === "completed" ||
                    entry?.state === "started"
                  }
                  onClick={() => void mark(r.id, "started")}
                >
                  Mark started
                </Button>
                <Button
                  disabled={busy || y.locked || entry?.state === "completed"}
                  onClick={() => void mark(r.id, "completed")}
                >
                  Mark completed
                </Button>
              </div>
            </article>
          );
        })
      ) : (
        <div className="op-table-wrap">
          <table className="op-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Resource</th>
                <th>Reported progress</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((p) => (
                <tr key={p.id}>
                  <td>
                    {
                      y.setup.students.find((s) => s.id === p.studentId)
                        ?.displayName
                    }
                  </td>
                  <td>
                    {y.extensions.find((r) => r.id === p.resourceId)?.title ??
                      "Previously assigned resource"}
                  </td>
                  <td>{p.state}</td>
                  <td>{p.updatedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!progress.length && <p>No reported progress yet.</p>}
        </div>
      )}
    </section>
  );
}
