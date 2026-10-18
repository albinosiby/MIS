"use client";
import { quizGradeRequestSchema } from "../../learning/schemas/progress.schema";
import { gradeQuizAttempt } from "../../learning/domain/grade-quiz";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import {
  DataForm,
  type FormField,
} from "../../workspace/components/workspace-ui";
import { downloadFile } from "../../school-setup/components/setup-ingestion";
import { csvExport } from "../../workspace/domain/operations";
import { academicReferenceDate } from "../../workspace/domain/form-values";
import type { AccountIdentity } from "../../identity/models";
import type { OperationRecord } from "../models";
import { definition } from "../data/module-definitions";
import {
  canUseCollection,
  canEditOperation,
  canTransitionOperation,
  saveOperation,
  respondOperation,
  renewLoan,
  visibleOperations,
  scopedStudentIds,
} from "../domain/operations";
import type { SchoolYearWorkspace } from "../../workspace/models";
function relations(
  y: SchoolYearWorkspace,
  relation: string,
  actor: AccountIdentity,
) {
  const allowed = scopedStudentIds(y, actor);
  if (relation === "classes")
    return y.setup.classes.map((x) => ({
      value: x.id,
      label: `Grade ${x.grade} · ${x.section}`,
    }));
  const canonical = (
    y.records as unknown as Record<string, Record<string, unknown>[]>
  )[relation];
  if (canonical)
    return canonical
      .filter(
        (x) =>
          !["parent", "student"].includes(actor.role) ||
          !x.studentId ||
          allowed.includes(String(x.studentId)),
      )
      .map((x) => ({
        value: String(x.id),
        label: String(x.title ?? x.name ?? x.reference ?? x.id),
      }));
  return y.extensions
    .filter((x) => x.kind === relation && x.status !== "cancelled")
    .map((x) => ({ value: x.id, label: x.title }));
}
export function CollectionScreen({
  actor,
  kind,
  compact = false,
}: {
  actor: AccountIdentity;
  kind: string;
  compact?: boolean;
}) {
  const { year: y, mutate, busy } = useWorkspace();
  const [responding, setResponding] = useState<OperationRecord | null>(null);
  const [grading, setGrading] = useState<OperationRecord | null>(null);
  const [renewing, setRenewing] = useState<OperationRecord | null>(null);
  const def = definition(kind);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [page, setPage] = useState(0),
    [editing, setEditing] = useState<OperationRecord | null>(null),
    [detail, setDetail] = useState<OperationRecord | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  if (!canUseCollection(actor, kind))
    return (
      <div className="op-notice">This account cannot view this collection.</div>
    );
  const rows = visibleOperations(y, actor, kind).filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.title} ${JSON.stringify(r.values)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 8) - 1));
  const canWrite = canUseCollection(actor, kind, true) && !y.locked;
  // New forms intentionally start with blank required values, so defer schema parsing until submit.
  function openNew() {
    const values: Record<string, string | number> = {};
    for (const f of def.fields)
      values[f.name] = f.relation
        ? (relations(y, f.relation, actor)[0]?.value ?? "")
        : f.type === "number"
          ? (f.min ?? 0)
          : f.type === "date"
            ? academicReferenceDate(y.setup.calendar.year)
            : f.type === "select"
              ? f.options![0]
              : "";
    setEditing({
      id: crypto.randomUUID(),
      schoolId: y.setup.school.id,
      academicYearId: y.setup.calendar.year.id,
      kind,
      title: "",
      date: academicReferenceDate(y.setup.calendar.year),
      studentId: def.student ? (scopedStudentIds(y, actor)[0] ?? null) : null,
      staffId: def.staff
        ? actor.personId && y.setup.staff.some((s) => s.id === actor.personId)
          ? actor.personId
          : y.setup.staff[0].id
        : null,
      status: def.states[0],
      values,
      createdBy: actor.id,
      history: [],
    });
  }
  function setEditorRenewal(row: OperationRecord) {
    setRenewing(row);
  }
  async function transition(row: OperationRecord, next: string) {
    setError("");
    if (kind === "quiz-attempts" && next === "graded") {
      setGrading(row);
      return;
    }
    try {
      await mutate(
        (v) => saveOperation(v, actor, { ...row, status: next }),
        `${def.title}: ${next}`,
        { type: "operation-save", input: { ...row, status: next } },
      );
      setMessage(`Saved: ${row.title} → ${next.replaceAll("-", " ")}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }
  const fields: FormField[] = [
    { name: "title", label: "Title / reference", required: true },
    { name: "date", label: "Record date", type: "date", required: true },
    ...(def.student &&
    !(
      kind === "quiz-attempts" &&
      editing &&
      y.extensions.some((r) => r.id === editing.id)
    )
      ? [
          {
            name: "studentId",
            label: "Student",
            type: "select" as const,
            options: y.setup.students
              .filter((s) => scopedStudentIds(y, actor).includes(s.id))
              .map((s) => ({ value: s.id, label: s.displayName })),
          },
        ]
      : []),
    ...(def.staff
      ? [
          {
            name: "staffId",
            label: "Staff member",
            type: "select" as const,
            options: y.setup.staff
              .filter(
                (s) =>
                  !["staff", "driver"].includes(actor.role) ||
                  s.id === actor.personId,
              )
              .map((s) => ({ value: s.id, label: s.displayName })),
          },
        ]
      : []),
    ...def.fields
      .filter(
        (f) =>
          !(
            ["parent", "student"].includes(actor.role) &&
            kind === "quiz-attempts" &&
            f.name === "score"
          ) &&
          !(
            kind === "quiz-attempts" &&
            f.name === "quizId" &&
            editing &&
            y.extensions.some((r) => r.id === editing.id)
          ),
      )
      .map((f) => ({
        name: `values.${f.name}`,
        label:
          f.label.replace(/ in minor units/g, "") +
          (f.name.endsWith("Minor") ? ` (${y.setup.school.currency})` : ""),
        factor: f.name.endsWith("Minor") ? 100 : undefined,
        type: f.relation ? ("select" as const) : f.type,
        options: f.relation
          ? relations(y, f.relation, actor)
          : f.options?.map((v) => ({ value: v, label: v })),
        required: f.required,
      })),
  ];
  return (
    <section>
      {["hostel", "transport", "library", "inventory"].includes(def.area) && (
        <nav className="op-links" aria-label="Connected operations">
          {["admin", "principal", "accountant"].includes(actor.role) && (
            <a href="/fees/bank-statements">
              Service charges & bank reconciliation →
            </a>
          )}
          {def.area === "library" && (
            <>
              <a href="/library/reservations">Reservations</a>
              <a href="/library/loans">Circulation</a>
              <a href="/library/library-fines">Fines</a>
            </>
          )}
          {def.area === "inventory" && (
            <>
              <a href="/inventory/purchase-orders">Purchase orders</a>
              <a href="/inventory/purchase-receipts">Deliveries</a>
              <a href="/inventory/stock-movements">Stock movements</a>
            </>
          )}
          {def.area === "transport" && (
            <>
              <a href="/transport/transport-allocations">Passengers</a>
              <a href="/transport/trips">Trips</a>
              <a href="/transport/boarding">Boarding</a>
            </>
          )}
        </nav>
      )}
      {def.area === "website" && (
        <p className="op-notice">
          CMS edits prepare the next website release.{" "}
          <a href="/website/releases">Publish or restore a saved release →</a>
        </p>
      )}
      {!compact && (
        <div className="op-heading">
          <div>
            <span className="op-eyebrow">{def.area} / operations</span>
            <h1>{def.title}</h1>
            <p>{def.description}</p>
          </div>
          <span className="op-badge">
            {y.locked ? "Archived" : "Persistent"}
          </span>
        </div>
      )}
      {compact && <h2 className="text-lg font-semibold mb-3">{def.title}</h2>}
      {def.restricted && (
        <div className="op-notice">
          Access is limited to authorised school roles. Attachments use the
          private file register.
        </div>
      )}
      {[
        "gateways",
        "integrations",
        "domains",
        "webhooks",
        "billing",
        "payroll",
        "payment-attempts",
        "deliveries",
      ].includes(kind) && (
        <div className="op-notice">
          Provider status: Payment processing, external delivery, certified
          payroll calculations and external integrations are not connected.
        </div>
      )}
      <div className="op-tools">
        <input
          aria-label={`Search ${def.title}`}
          placeholder="Search records…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="Workflow status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="all">All statuses</option>
          {[...def.states, "cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="op-badge">{rows.length} records</span>
        {canWrite &&
          !(actor.role === "driver" && kind === "trips") &&
          !(kind === "quiz-attempts" && actor.role !== "student") && (
            <Button onClick={openNew}>+ Add record</Button>
          )}
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              `${kind}.csv`,
              csvExport(
                rows.map((r) => ({
                  Reference: r.title,
                  Date: r.date,
                  Status: r.status,
                  ...Object.fromEntries(
                    def.fields.map((f) => [f.label, r.values[f.name] ?? ""]),
                  ),
                })),
              ),
            )
          }
        >
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="op-notice" role="status">
          {message}
        </p>
      )}
      <div className="op-table-wrap">
        <table className="op-table">
          <thead>
            <tr>
              <th>REFERENCE</th>
              <th>PERSON</th>
              <th>DATE</th>
              <th>STATUS</th>
              <th>{def.fields[0]?.label.toUpperCase()}</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(current * 8, current * 8 + 8).map((row) => {
              const next = def.states[def.states.indexOf(row.status) + 1];
              const terminal = [
                "ended",
                "collected",
                "settled",
                "checked-out",
                "received",
                "posted",
                "finalised",
                "completed",
                "returned",
                "issued",
                "published",
                "reconciled",
                "simulated-success",
                "cancelled",
              ].includes(row.status);
              return (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>
                    {y.setup.students.find((s) => s.id === row.studentId)
                      ?.displayName ??
                      y.setup.staff.find((s) => s.id === row.staffId)
                        ?.displayName ??
                      "School record"}
                  </td>
                  <td>{row.date}</td>
                  <td>
                    <span className={`op-badge ${terminal ? "success" : ""}`}>
                      {row.status.replaceAll("-", " ")}
                    </span>
                  </td>
                  <td>{String(row.values[def.fields[0]?.name] ?? "—")}</td>
                  <td>
                    <button onClick={() => setDetail(row)}>View</button>
                    {["parent", "student"].includes(actor.role) &&
                      !y.locked &&
                      ((kind === "ptm" && row.status === "available") ||
                        (kind === "consents" && row.status === "requested") ||
                        (kind === "outpasses" &&
                          actor.role === "parent" &&
                          row.status === "requested" &&
                          row.values.guardianApproval === "Pending") ||
                        (kind === "surveys" && row.status === "open")) && (
                        <button onClick={() => setResponding(row)}>
                          {kind === "ptm" ? "Book meeting" : "Respond"}
                        </button>
                      )}
                    {kind === "loans" &&
                      row.status === "issued" &&
                      canWrite && (
                        <button onClick={() => setEditorRenewal(row)}>
                          Renew
                        </button>
                      )}
                    {canWrite &&
                      kind === "quiz-attempts" &&
                      row.status === "graded" &&
                      ["admin", "principal", "teacher"].includes(
                        actor.role,
                      ) && (
                        <button onClick={() => setGrading(row)}>
                          Review score
                        </button>
                      )}
                    {canWrite && (
                      <>
                        {!terminal && canEditOperation(actor, row) && (
                          <button onClick={() => setEditing(row)}>Edit</button>
                        )}
                        {next &&
                          canTransitionOperation(actor, row, next) &&
                          (!terminal || kind === "loans") &&
                          row.status !== "cancelled" &&
                          (!["parent", "student"].includes(actor.role) ||
                            [
                              "messages",
                              "payment-attempts",
                              "consents",
                              "surveys",
                            ].includes(kind)) && (
                            <button
                              disabled={busy || kind === "payment-attempts"}
                              onClick={() => void transition(row, next)}
                            >
                              {kind === "loans"
                                ? "Return copy"
                                : kind === "stock-movements"
                                  ? "Post movement"
                                  : kind === "payment-attempts"
                                    ? "Gateway disconnected"
                                    : next.replaceAll("-", " ") + " →"}
                            </button>
                          )}
                        {kind === "payment-attempts" &&
                          row.status === "pending" &&
                          canTransitionOperation(actor, row, "failed") && (
                            <button
                              disabled={busy}
                              onClick={() => void transition(row, "failed")}
                            >
                              Mark request failed
                            </button>
                          )}
                        {!terminal &&
                          row.status !== "cancelled" &&
                          canTransitionOperation(actor, row, "cancelled") && (
                            <button
                              disabled={busy}
                              onClick={() => void transition(row, "cancelled")}
                            >
                              Cancel
                            </button>
                          )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="op-empty">
            <strong>No matching records</strong>
            <p>
              Add a record or adjust the filters. Changes are saved to the
              selected school workspace.
            </p>
          </div>
        )}
      </div>
      <div className="op-pagination">
        <span>
          {rows.length ? current * 8 + 1 : 0}–
          {Math.min((current + 1) * 8, rows.length)} of {rows.length}
        </span>
        <div className="flex gap-3">
          <button disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <span>
            {current + 1} / {Math.max(1, Math.ceil(rows.length / 8))}
          </span>
          <button
            disabled={(current + 1) * 8 >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      </div>
      {responding && (
        <Dialog
          title={kind === "ptm" ? "Book meeting" : "Respond to school request"}
          onClose={() => setResponding(null)}
        >
          <p>{responding.title}</p>
          <DataForm
            initial={{
              response: ["consents", "outpasses"].includes(kind)
                ? "Granted"
                : "",
            }}
            fields={
              kind === "ptm"
                ? []
                : [
                    {
                      name: "response",
                      label: "Your response",
                      type: ["consents", "outpasses"].includes(kind)
                        ? "select"
                        : "textarea",
                      options: ["consents", "outpasses"].includes(kind)
                        ? [
                            { value: "Granted", label: "Grant consent" },
                            { value: "Declined", label: "Decline consent" },
                          ]
                        : undefined,
                    },
                  ]
            }
            submitLabel={kind === "ptm" ? "Confirm booking" : "Submit response"}
            onSave={async (input) => {
              await mutate(
                (v) => respondOperation(v, actor, responding.id, input),
                "Family: respond to school request",
                { type: "operation-respond", id: responding.id, input },
              );
              setResponding(null);
            }}
          />
        </Dialog>
      )}
      {grading && (
        <Dialog title="Review quiz score" onClose={() => setGrading(null)}>
          <DataForm
            initial={{
              score: Number(grading.values.score),
              feedback: String(grading.values.feedback ?? ""),
            }}
            fields={[
              {
                name: "score",
                label: "Reviewed score",
                type: "number",
                required: true,
                min: 0,
                max: Number(
                  y.extensions.find((q) => q.id === grading.values.quizId)
                    ?.values.maxScore ?? 100,
                ),
              },
              {
                name: "feedback",
                label: "Review feedback",
                type: "textarea",
                required: true,
              },
            ]}
            onSave={async (input) => {
              const request = quizGradeRequestSchema.parse({
                ...quizGradeRequestSchema.omit({ id: true }).parse(input),
                id: grading.id,
              });
              await mutate(
                (year) => gradeQuizAttempt(year, actor, request),
                "Reviewed quiz score",
                {
                  type: "workflow",
                  input: { action: "quiz-grade", input: request },
                },
              );
              setGrading(null);
              setMessage("Quiz score and review saved.");
            }}
          />
        </Dialog>
      )}
      {renewing && (
        <Dialog title="Renew book loan" onClose={() => setRenewing(null)}>
          <DataForm
            initial={{ dueDate: renewing.values.dueDate }}
            fields={[{ name: "dueDate", label: "New due date", type: "date" }]}
            onSave={async (input) => {
              const value = input as { dueDate: string };
              await mutate(
                (v) => renewLoan(v, actor, renewing.id, value.dueDate),
                "Library: renew loan",
                { type: "loan-renew", id: renewing.id, dueDate: value.dueDate },
              );
              setRenewing(null);
            }}
          />
        </Dialog>
      )}
      {editing && (
        <Dialog
          title={`${y.extensions.some((r) => r.id === editing.id) ? "Edit" : "Add"} ${def.title.toLowerCase()}`}
          onClose={() => setEditing(null)}
        >
          <DataForm
            initial={editing}
            fields={fields}
            onSave={async (input) => {
              await mutate(
                (v) => saveOperation(v, actor, input),
                `${def.title}: save`,
                { type: "operation-save", input },
              );
              setEditing(null);
              setMessage("Record saved to the selected school and year.");
            }}
          />
        </Dialog>
      )}
      {detail && (
        <Dialog title={detail.title} onClose={() => setDetail(null)}>
          <div className="op-detail">
            <span className="op-badge">{detail.status}</span>
            <dl className="mt-5">
              {def.fields.map((f) => (
                <div key={f.name}>
                  <dt>{f.label}</dt>
                  <dd>{String(detail.values[f.name])}</dd>
                </div>
              ))}
            </dl>
            {kind === "payroll" && (
              <p>
                Net pay:{" "}
                {(
                  (Number(detail.values.grossMinor) -
                    Number(detail.values.deductionMinor)) /
                  100
                ).toFixed(2)}{" "}
                {y.setup.school.currency}
              </p>
            )}
            {kind === "items" && (
              <p>
                On hand:{" "}
                {y.extensions
                  .filter(
                    (x) =>
                      x.kind === "stock-movements" &&
                      x.status === "posted" &&
                      x.values.itemId === detail.id,
                  )
                  .reduce(
                    (s, x) =>
                      s +
                      (x.values.direction === "Issue" ? -1 : 1) *
                        Number(x.values.quantity),
                    0,
                  )}
              </p>
            )}
            {kind === "cms-pages" && (
              <article>
                <h3>Page preview</h3>
                <h2>{detail.title}</h2>
                <p>{String(detail.values.body)}</p>
              </article>
            )}
            <h3>Record history</h3>
            {detail.history.map((h, i) => (
              <p key={i}>
                {new Date(h.at).toLocaleString()} · {h.action} · {h.actorId}
              </p>
            ))}
          </div>
        </Dialog>
      )}
    </section>
  );
}
