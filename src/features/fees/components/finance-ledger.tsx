"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "../../workspace/hooks/workspace-provider";
import { applyWorkflowCommand } from "../../workspace/domain/workflow-commands";
import { ledgerBalances } from "../domain/ledger";
import { previewLateCharge } from "../domain/finance-workflows";
import type { AccountIdentity } from "../../identity/models";
const amount = (minor: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    minor / 100,
  );
export function FinanceLedger({ actor }: { actor: AccountIdentity }) {
  const { year: y, mutate, busy } = useWorkspace(),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState("");
  async function run(action: string, input: unknown) {
    setError("");
    setStatus("");
    try {
      await mutate(
        (year) => applyWorkflowCommand(year, actor, { action, input }),
        `Finance: ${action}`,
        { type: "workflow", input: { action, input } },
      );
      setStatus("Finance changes saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }
  const plan = y.workflows.feePlans.find((p) => p.id === selected),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: y.workflows.advanced.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  return (
    <>
      {error && (
        <p className="op-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="op-notice">
          {status}
        </p>
      )}
      <div className="op-metrics">
        {Object.entries(ledgerBalances(y)).map(([account, value]) => (
          <section className="op-card" key={account}>
            <h3>{account}</h3>
            <strong>
              {amount(Math.abs(value))} {value >= 0 ? "Dr" : "Cr"}
            </strong>
          </section>
        ))}
      </div>
      <form
        className="op-card conversation-form mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run("ledger-statement", {
            from: String(f.get("from")),
            to: String(f.get("to")),
          });
        }}
      >
        <h2>Publish a ledger statement</h2>
        <label>
          From
          <input
            name="from"
            type="date"
            required
            min={y.setup.calendar.year.startDate}
            max={y.setup.calendar.year.endDate}
            defaultValue={y.setup.calendar.year.startDate}
          />
        </label>
        <label>
          Until
          <input
            name="to"
            type="date"
            required
            min={y.setup.calendar.year.startDate}
            max={y.setup.calendar.year.endDate}
            defaultValue={
              today > y.setup.calendar.year.endDate
                ? y.setup.calendar.year.endDate
                : today
            }
          />
        </label>
        <Button type="submit" disabled={busy || y.locked}>
          Create statement snapshot
        </Button>
        <Link href="/documents/publications">
          Download issued PDF or Excel statements →
        </Link>
      </form>
      <section className="op-card mt-6">
        <h2>Instalment late-charge rules</h2>
        <p>
          Daily charges apply to each currently overdue instalment, capped
          across the plan. Finance explicitly assesses each charge. Issued
          charges remain recorded when a later instalment is paid.
        </p>
        <label>
          Payment plan
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose approved plan</option>
            {y.workflows.feePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ·{" "}
                {
                  y.setup.students.find((s) => s.id === p.studentId)
                    ?.displayName
                }
              </option>
            ))}
          </select>
        </label>
        {plan && (
          <form
            key={plan.id}
            className="conversation-form mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("late-fee-rules", {
                planId: plan.id,
                dailyMinor: Math.round(Number(f.get("daily")) * 100),
                capMinor: Math.round(Number(f.get("cap")) * 100),
              });
            }}
          >
            <label>
              Daily charge per overdue instalment (INR)
              <input
                name="daily"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={plan.lateFeeMinorPerDay / 100}
              />
            </label>
            <label>
              Total plan cap (INR)
              <input
                name="cap"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={plan.lateFeeCapMinor / 100}
              />
            </label>
            <Button type="submit" disabled={busy || y.locked}>
              Save late-charge rules
            </Button>
            <p>
              Additional charge currently due:{" "}
              {amount(previewLateCharge(y, plan.id, today))}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={
                busy || y.locked || !previewLateCharge(y, plan.id, today)
              }
              onClick={() => void run("late-fee-assess", { planId: plan.id })}
            >
              Issue current late-charge invoice
            </Button>
          </form>
        )}
      </section>
      <section className="op-card mt-6">
        <h2>Posted day book</h2>
        {!y.workflows.ledger.length && (
          <p>
            No posted journals yet. Financial changes initialize recorded
            opening balances and append balanced entries.
          </p>
        )}
        {[...y.workflows.ledger].reverse().map((j) => (
          <article className="mb-5" key={j.id}>
            <h3>
              {j.date} · {j.memo}
            </h3>
            <table className="op-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {j.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.account}</td>
                    <td>{l.debitMinor ? amount(l.debitMinor) : "—"}</td>
                    <td>{l.creditMinor ? amount(l.creditMinor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </section>
    </>
  );
}
