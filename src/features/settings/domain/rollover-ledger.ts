import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { LedgerEntry } from "../../fees/models/index.ts";
import { ledgerEntrySchema } from "../../fees/schemas/ledger.schema.ts";
import { ledgerBalances } from "../../fees/domain/ledger.ts";
import { balance } from "../../workspace/domain/operations.ts";
/** Carry balance sheet accounts without recognizing prior-year income again. */
export function carryOpeningLedger(
  source: SchoolYearWorkspace,
  startDate: string,
): LedgerEntry[] {
  const outstanding = source.records.invoices.reduce(
    (sum, invoice) => sum + balance(source, invoice.id),
    0,
  );
  const balances = ledgerBalances(source);
  if (
    source.workflows.counters["ledger-initialised"] &&
    (balances["Fee receivable"] ?? 0) !== outstanding
  )
    throw new Error(
      "Reconcile fee receivables with the ledger before rollover.",
    );
  balances["Fee receivable"] = outstanding;
  if (!source.workflows.counters["ledger-initialised"]) {
    for (const payment of source.records.payments.filter(
      (p) => p.status === "completed",
    )) {
      const account = payment.method === "Cash" ? "Cash" : "Bank";
      balances[account] =
        (balances[account] ?? 0) + payment.amountMinor - payment.refundedMinor;
    }
  }
  const accounts: LedgerEntry["lines"][number]["account"][] = [
    "Cash",
    "Bank",
    "Fee receivable",
    "Payroll payable",
    "Deductions payable",
    "Trade payable",
  ];
  return accounts
    .filter((account) => balances[account])
    .map((account) => {
      const amount = balances[account],
        value = Math.abs(amount);
      return ledgerEntrySchema.parse({
        id: crypto.randomUUID(),
        sourceKey: `year-opening:${account}`,
        date: startDate,
        memo: `Opening ${account} from ${source.setup.calendar.year.name}`.slice(
          0,
          300,
        ),
        postedBy: "year-rollover",
        postedAt: new Date().toISOString(),
        reversesId: null,
        lines: [
          {
            account,
            debitMinor: amount > 0 ? value : 0,
            creditMinor: amount < 0 ? value : 0,
          },
          {
            account: "Opening balance",
            debitMinor: amount < 0 ? value : 0,
            creditMinor: amount > 0 ? value : 0,
          },
        ],
      });
    });
}
