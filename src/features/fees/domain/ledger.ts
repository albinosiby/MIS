import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { ledgerEntrySchema } from "../schemas/ledger.schema.ts";
import type { LedgerEntry } from "../models/index.ts";
export function postJournal(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  input: Omit<LedgerEntry, "id" | "postedBy" | "postedAt">,
) {
  if (y.locked || actor.schoolId !== y.setup.school.id)
    throw new Error("Journal school/year inaccessible.");
  const existing = y.workflows.ledger.find(
    (j) => j.sourceKey === input.sourceKey,
  );
  if (existing) {
    const { id: _id, postedAt: _at, postedBy: _by, ...stable } = existing;
    if (JSON.stringify(stable) !== JSON.stringify(input))
      throw new Error(
        "Journal source was already used for different amounts or details.",
      );
    return y;
  }
  const journal = ledgerEntrySchema.parse({
    ...input,
    id: crypto.randomUUID(),
    postedBy: actor.id,
    postedAt: new Date().toISOString(),
  });
  return {
    ...y,
    workflows: { ...y.workflows, ledger: [...y.workflows.ledger, journal] },
  };
}
function twoLines(
  debit: LedgerEntry["lines"][number]["account"],
  credit: LedgerEntry["lines"][number]["account"],
  amount: number,
) {
  return [
    { account: debit, debitMinor: amount, creditMinor: 0 },
    { account: credit, debitMinor: 0, creditMinor: amount },
  ];
}
function netInvoice(i: SchoolYearWorkspace["records"]["invoices"][number]) {
  return i.lines.reduce((s, l) => s + l.amountMinor, 0) - i.concessionMinor;
}
/** Derive accounting from authenticated, validated before/after records. Client journals are never accepted. */
export function postFinancialChanges(
  previous: SchoolYearWorkspace,
  next: SchoolYearWorkspace,
  actor: AccountIdentity,
  derived = false,
) {
  let y = next;
  const changed =
    JSON.stringify(previous.records.invoices) !==
      JSON.stringify(next.records.invoices) ||
    JSON.stringify(previous.records.payments) !==
      JSON.stringify(next.records.payments);
  if (!changed) return y;
  if (!derived && !["admin", "principal", "accountant"].includes(actor.role))
    throw new Error("Billing permission required.");
  if (!previous.workflows.counters["ledger-initialised"]) {
    for (const invoice of previous.records.invoices.filter(
      (i) => i.status === "issued",
    )) {
      const received = previous.records.payments
          .filter((p) => p.invoiceId === invoice.id && p.status === "completed")
          .reduce((s, p) => s + p.amountMinor - (p.refundedMinor ?? 0), 0),
        outstanding = netInvoice(invoice) - received;
      if (outstanding > 0)
        y = postJournal(y, actor, {
          sourceKey: `opening-receivable:${invoice.id}`,
          date: y.setup.calendar.year.startDate,
          memo: `Opening balance ${invoice.reference}`,
          reversesId: null,
          lines: twoLines("Fee receivable", "Opening balance", outstanding),
        });
    }
    for (const payment of previous.records.payments.filter(
      (p) => p.status === "completed",
    )) {
      const amount = payment.amountMinor - (payment.refundedMinor ?? 0);
      if (amount > 0)
        y = postJournal(y, actor, {
          sourceKey: `opening-collection:${payment.id}`,
          date: y.setup.calendar.year.startDate,
          memo: `Opening recorded collection ${payment.reference}`,
          reversesId: null,
          lines: twoLines(
            payment.method === "Cash" ? "Cash" : "Bank",
            "Opening balance",
            amount,
          ),
        });
    }
    y = {
      ...y,
      workflows: {
        ...y.workflows,
        counters: { ...y.workflows.counters, "ledger-initialised": 1 },
      },
    };
  }
  for (const invoice of y.records.invoices) {
    const old = previous.records.invoices.find((i) => i.id === invoice.id);
    if (!old && invoice.status === "issued" && netInvoice(invoice) > 0)
      y = postJournal(y, actor, {
        sourceKey: `invoice:${invoice.id}`,
        date: invoice.issuedOn,
        memo: `Issued ${invoice.reference}`,
        reversesId: null,
        lines: twoLines("Fee receivable", "Fee income", netInvoice(invoice)),
      });
    if (old && invoice.concessionMinor > old.concessionMinor)
      y = postJournal(y, actor, {
        sourceKey: `concession:${invoice.id}:${invoice.concessionMinor}`,
        date: new Date().toISOString().slice(0, 10),
        memo: `Concession ${invoice.reference}`,
        reversesId: null,
        lines: twoLines(
          "Concessions",
          "Fee receivable",
          invoice.concessionMinor - old.concessionMinor,
        ),
      });
    if (
      old?.status === "issued" &&
      invoice.status === "void" &&
      netInvoice(old) > 0
    )
      y = postJournal(y, actor, {
        sourceKey: `void:${invoice.id}`,
        date: new Date().toISOString().slice(0, 10),
        memo: `Void ${invoice.reference}`,
        reversesId: null,
        lines: twoLines("Fee income", "Fee receivable", netInvoice(old)),
      });
  }
  let sequence = y.workflows.counters["receipt"] ?? 0;
  const numbered = new Map<string, string>();
  for (const payment of y.records.payments) {
    const old = previous.records.payments.find((p) => p.id === payment.id),
      cash = payment.method === "Cash" ? "Cash" : "Bank";
    if (!old) {
      if (payment.status !== "completed" || payment.refundedMinor)
        throw new Error("New collections cannot be reversed or refunded.");
      const reference = `RCPT-${y.setup.calendar.year.id.slice(0, 80)}-${String(++sequence).padStart(6, "0")}`;
      numbered.set(payment.id, reference);
      y = postJournal(y, actor, {
        sourceKey: `collection:${payment.id}`,
        date: payment.paidOn,
        memo: `Collection ${reference}`,
        reversesId: null,
        lines: twoLines(cash, "Fee receivable", payment.amountMinor),
      });
    }
    if (old?.status === "completed" && payment.status === "reversed") {
      if (old.refundedMinor)
        throw new Error("A refunded collection cannot be reversed.");
      y = postJournal(y, actor, {
        sourceKey: `reversal:${payment.id}`,
        date: new Date().toISOString().slice(0, 10),
        memo: `Reversal ${payment.reference}: ${payment.note}`,
        reversesId:
          y.workflows.ledger.find(
            (j) =>
              j.sourceKey === `collection:${payment.id}` ||
              j.sourceKey === `opening-collection:${payment.id}`,
          )?.id ?? null,
        lines: twoLines("Fee receivable", cash, payment.amountMinor),
      });
    }
    const refund = (payment.refundedMinor ?? 0) - (old?.refundedMinor ?? 0);
    if (refund > 0)
      y = postJournal(y, actor, {
        sourceKey: `refund:${payment.id}:${payment.refundedMinor}`,
        date: new Date().toISOString().slice(0, 10),
        memo: `Refund ${payment.reference}`,
        reversesId: null,
        lines: twoLines("Fee receivable", cash, refund),
      });
  }
  return {
    ...y,
    records: {
      ...y.records,
      payments: y.records.payments.map((p) =>
        numbered.has(p.id) ? { ...p, reference: numbered.get(p.id)! } : p,
      ),
    },
    workflows: {
      ...y.workflows,
      counters: { ...y.workflows.counters, receipt: sequence },
    },
  };
}
export function ledgerBalances(y: SchoolYearWorkspace) {
  const balances: Record<string, number> = {};
  for (const j of y.workflows.ledger)
    for (const l of j.lines)
      balances[l.account] =
        (balances[l.account] ?? 0) + l.debitMinor - l.creditMinor;
  return balances;
}
