"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WorkflowField as Field } from "@/components/forms/workflow-field";
import {
  useWorkflowActions,
  workflowText as text,
} from "../../workspace/hooks/workflow-actions";
import { bankCsvImport, bankMinor } from "../domain/bank-import";
export function BankReconciliationPanel() {
  const { year: y, actor, run, submit, unavailable } = useWorkflowActions(),
    [error, setError] = useState("");
  const money = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: y.setup.school.currency,
    }).format(n / 100);
  return (
    <div className="grid gap-5">
      <nav className="op-links">
        <Link href="/fees/ledger">Ledger</Link>
        <Link href="/fees/purchase-payments">Vendor payments</Link>
        <Link href="/fees">Student invoices and collections</Link>
        <Link href="/hostel/hostel-allocations">Hostel allocations</Link>
        <Link href="/transport/transport-allocations">
          Transport allocations
        </Link>
      </nav>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      <section className="op-card">
        <h2>Historical library fine invoices</h2>
        <p>
          Link older outstanding fines to finance before collecting and settling
          them.
        </p>
        {y.extensions
          .filter(
            (r) =>
              r.kind === "library-fines" &&
              r.status === "outstanding" &&
              !y.records.invoices.some(
                (i) => i.period === `Library fine ${r.id}`,
              ),
          )
          .map((r) => (
            <p key={r.id}>
              {r.title} · {money(Number(r.values.amountMinor))}{" "}
              <Button
                variant="outline"
                disabled={unavailable}
                onClick={() => void run("library-fine-bill", { id: r.id })}
              >
                Create linked invoice
              </Button>
            </p>
          ))}
      </section>
      <section className="op-card">
        <h2>Monthly service invoice</h2>
        <p>
          Issue an explicit hostel or transport charge. Collect it through the
          student's finance account.
        </p>
        <form
          className="conversation-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            const f = new FormData(event.currentTarget);
            try {
              void run("service-charge", {
                allocationId: text(f, "allocationId"),
                month: text(f, "month"),
                amountMinor: bankMinor(text(f, "amount")),
                issuedOn: text(f, "issuedOn"),
                dueDate: text(f, "dueDate"),
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invalid amount.");
            }
          }}
        >
          <Field label="Active allocation">
            <select name="allocationId" required>
              {y.extensions
                .filter(
                  (r) =>
                    ["hostel-allocations", "transport-allocations"].includes(
                      r.kind,
                    ) && r.status === "active",
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ·{" "}
                    {
                      y.setup.students.find((s) => s.id === r.studentId)
                        ?.displayName
                    }
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Charge month">
            <input name="month" type="month" required />
          </Field>
          <Field label="Amount (INR)">
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </Field>
          <Field label="Issued on">
            <input name="issuedOn" type="date" required />
          </Field>
          <Field label="Due date">
            <input name="dueDate" type="date" required />
          </Field>
          <Button type="submit" disabled={unavailable}>
            Issue service invoice
          </Button>
        </form>
      </section>
      <section className="op-card">
        <h2>Import bank statement</h2>
        <p>
          Credits are positive and debits negative. Import validates balances
          and dates; it never records a payment. Every bank ledger movement in
          the period must match. A separate finance reviewer closes the
          statement, locking that bank period. This workspace uses one school
          Bank ledger.
        </p>
        <form
          className="conversation-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              void run(
                "bank-import",
                bankCsvImport({
                  account: text(f, "account"),
                  from: text(f, "from"),
                  to: text(f, "to"),
                  opening: text(f, "opening"),
                  closing: text(f, "closing"),
                  csv: text(f, "csv"),
                }),
              );
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Invalid statement.",
              );
            }
          }}
        >
          <Field label="Bank account label">
            <input name="account" required maxLength={80} />
          </Field>
          <Field label="From">
            <input type="date" name="from" required />
          </Field>
          <Field label="Until">
            <input type="date" name="to" required />
          </Field>
          <Field label="Opening balance (INR)">
            <input name="opening" type="number" step="0.01" required />
          </Field>
          <Field label="Closing balance (INR)">
            <input name="closing" type="number" step="0.01" required />
          </Field>
          <Field label="Statement CSV">
            <textarea
              name="csv"
              required
              rows={6}
              placeholder={
                "date,reference,amount\n2026-10-18,BANK-REFERENCE,1500.00"
              }
            />
          </Field>
          <Button type="submit" disabled={unavailable}>
            Import statement
          </Button>
        </form>
      </section>
      {y.workflows.bankStatements.map((s) => (
        <section key={s.id} className="op-card">
          <h2>
            {s.account} · {s.from} to {s.to}
          </h2>
          <p>
            {money(s.openingMinor)} → {money(s.closingMinor)} ·{" "}
            {s.matches.filter((m) => !m.voidedAt).length}/{s.lines.length}{" "}
            matched ·{" "}
            {s.voidedAt ? "Voided" : s.closedAt ? "Reconciled" : "Open"}
          </p>
          {s.lines.map((l) => {
            const match = s.matches.find(
              (m) => !m.voidedAt && m.lineId === l.id,
            );
            return (
              <div key={l.id}>
                <h3>
                  {l.date} · {l.reference} · {money(l.amountMinor)}
                </h3>
                {match ? (
                  <>
                    <p>
                      Matched to{" "}
                      {
                        y.workflows.ledger.find((j) => j.id === match.journalId)
                          ?.memo
                      }{" "}
                      · {match.matchedBy}
                    </p>
                    {!s.closedAt && (
                      <form
                        className="conversation-form"
                        onSubmit={submit("bank-unmatch", (f) => ({
                          statementId: s.id,
                          lineId: l.id,
                          reason: text(f, "reason"),
                        }))}
                      >
                        <Field label={`Correction reason for ${l.reference}`}>
                          <input
                            name="reason"
                            minLength={8}
                            maxLength={300}
                            required
                          />
                        </Field>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={unavailable}
                        >
                          Correct match
                        </Button>
                      </form>
                    )}
                  </>
                ) : s.voidedAt ? (
                  <p>Statement voided: {s.voidReason}</p>
                ) : (
                  <form
                    className="conversation-form"
                    onSubmit={submit("bank-match", (f) => ({
                      statementId: s.id,
                      lineId: l.id,
                      journalId: text(f, "journalId"),
                    }))}
                  >
                    <Field label={`Journal for ${l.reference}`}>
                      <select name="journalId" required>
                        <option value="">
                          Choose a matching posted journal
                        </option>
                        {y.workflows.ledger
                          .filter(
                            (j) =>
                              j.date === l.date &&
                              j.lines
                                .filter((v) => v.account === "Bank")
                                .reduce(
                                  (sum, v) =>
                                    sum + v.debitMinor - v.creditMinor,
                                  0,
                                ) === l.amountMinor &&
                              !y.workflows.bankStatements.some((v) =>
                                v.matches.some(
                                  (m) => !m.voidedAt && m.journalId === j.id,
                                ),
                              ),
                          )
                          .map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.memo} · {j.sourceKey}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Button type="submit" disabled={unavailable}>
                      Match line
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
          {!s.closedAt && !s.voidedAt && (
            <Button
              disabled={
                unavailable ||
                s.matches.filter((m) => !m.voidedAt).length !==
                  s.lines.length ||
                s.importedBy === actor.id ||
                s.matches.some((m) => !m.voidedAt && m.matchedBy === actor.id)
              }
              onClick={() => void run("bank-close", { statementId: s.id })}
            >
              Reconcile statement
            </Button>
          )}
          {!s.closedAt && !s.voidedAt && s.importedBy === actor.id && (
            <p>
              Ready for a separate finance reviewer after every line is matched.
            </p>
          )}
          {s.matches
            .filter((m) => m.voidedAt)
            .map((m, i) => (
              <p key={i}>
                Corrected match: {m.voidReason} · {m.voidedBy} · {m.voidedAt}
              </p>
            ))}
          {!s.closedAt && !s.voidedAt && s.matches.every((m) => m.voidedAt) && (
            <form
              className="conversation-form"
              onSubmit={submit("bank-void", (f) => ({
                statementId: s.id,
                reason: text(f, "reason"),
              }))}
            >
              <Field label="Statement void reason">
                <input name="reason" minLength={8} maxLength={300} required />
              </Field>
              <Button type="submit" variant="outline" disabled={unavailable}>
                Void incorrect statement
              </Button>
            </form>
          )}
          {s.closedAt && (
            <p>
              Closed by {s.closedBy} · {new Date(s.closedAt).toLocaleString()}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
