"use client";
import { Button } from "@/components/ui/button";
import {
  useWorkflowActions,
  workflowText as text,
} from "../../workspace/hooks/workflow-actions";
export function ApprovalQueuePanel() {
  const { year: y, actor, unavailable, submit } = useWorkflowActions();
  return (
    <section className="op-card">
      <h2>Assigned review steps</h2>
      {!y.workflows.approvals.length && <p>No workflow approval requests.</p>}
      {y.workflows.approvals.map((r) => (
        <form
          className="conversation-form mb-5"
          key={r.id}
          onSubmit={submit("approval", (f) => ({
            id: r.id,
            decision: text(f, "decision"),
            note: text(f, "note"),
          }))}
        >
          <h3>
            {r.kind} · {r.status}
          </h3>
          <p>
            Step {r.decisions.length + 1} of {r.roles.length} ·{" "}
            {r.roles[r.decisions.length] ?? "review complete"}
          </p>
          {r.decisions.map((d) => (
            <p key={d.at}>
              {d.role}: {d.decision} · {d.note}
            </p>
          ))}
          {r.status === "pending" &&
            r.roles[r.decisions.length] === actor.role &&
            r.requestedBy !== actor.id && (
              <>
                <select name="decision">
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
                <textarea
                  name="note"
                  required
                  minLength={8}
                  maxLength={500}
                  aria-label="Review reason"
                />
                <Button type="submit" disabled={unavailable}>
                  Save review decision
                </Button>
              </>
            )}
        </form>
      ))}
    </section>
  );
}
