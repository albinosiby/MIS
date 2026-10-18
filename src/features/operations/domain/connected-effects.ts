import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { postJournal } from "../../fees/domain/ledger.ts";
import { ledgerAccountSchema } from "../../fees/schemas/ledger.schema.ts";
import { scope, balance } from "../../workspace/domain/operations.ts";
/** Derive downstream records from genuine transitions; CAS commits all effects together. */
export function applyOperationalEffects(
  previous: SchoolYearWorkspace,
  next: SchoolYearWorkspace,
  actor: AccountIdentity,
) {
  let y = next;
  for (const row of next.extensions) {
    const old = previous.extensions.find((r) => r.id === row.id);
    if (!old || old.status === row.status) continue;
    if (
      row.kind === "transport-allocations" &&
      ["active", "ended"].includes(row.status)
    ) {
      y = {
        ...y,
        records: {
          ...y.records,
          studentProfiles: y.records.studentProfiles.map((p) =>
            p.studentId === row.studentId
              ? {
                  ...p,
                  routeId:
                    row.status === "active"
                      ? String(row.values.routeId)
                      : ((y.extensions.find(
                          (r) =>
                            r.kind === "transport-allocations" &&
                            r.studentId === row.studentId &&
                            r.status === "active",
                        )?.values.routeId as string | undefined) ?? null),
                }
              : p,
          ),
        },
      };
    }
    if (row.kind === "trips" && row.status === "started") {
      const allocations = y.extensions.filter(
        (r) =>
          r.kind === "transport-allocations" &&
          r.status === "active" &&
          r.values.routeId === row.values.routeId &&
          String(r.values.startDate) <= row.date &&
          String(r.values.endDate) >= row.date,
      );
      for (const allocation of allocations) {
        if (
          y.extensions.some(
            (r) =>
              r.kind === "boarding" &&
              r.values.tripId === row.id &&
              r.studentId === allocation.studentId &&
              r.status !== "cancelled",
          )
        )
          continue;
        y = {
          ...y,
          extensions: [
            ...y.extensions,
            {
              ...scope(y),
              id: crypto.randomUUID(),
              kind: "boarding",
              title: `Passenger: ${allocation.title}`.slice(0, 160),
              date: row.date,
              studentId: allocation.studentId,
              staffId: null,
              status: "waiting",
              values: { tripId: row.id, stopId: allocation.values.stopId },
              createdBy: actor.id,
              history: [
                {
                  at: new Date().toISOString(),
                  actorId: actor.id,
                  action: `Roster generated at dispatch ${row.id}`,
                },
              ],
            },
          ],
        };
      }
    }
    if (row.kind === "purchase-payments" && row.status === "posted")
      y = postJournal(y, actor, {
        sourceKey: `purchase-payment:${row.id}`,
        date: row.date,
        memo: `Vendor payment ${row.values.bankReference}: ${row.title}`.slice(
          0,
          300,
        ),
        reversesId: null,
        lines: [
          {
            account: "Trade payable",
            debitMinor: Number(row.values.amountMinor),
            creditMinor: 0,
          },
          {
            account: "Bank",
            debitMinor: 0,
            creditMinor: Number(row.values.amountMinor),
          },
        ],
      });
    if (row.kind === "purchase-receipts" && row.status === "posted") {
      const key = `received-delivery:${row.id}`;
      if (!y.workflows.counters[key]) {
        const po = y.extensions.find(
          (r) =>
            r.id === row.values.purchaseOrderId && r.kind === "purchase-orders",
        )!;
        const before = previous.extensions
            .filter(
              (r) =>
                r.kind === "purchase-receipts" &&
                r.status === "posted" &&
                r.values.purchaseOrderId === po.id,
            )
            .reduce((sum, r) => sum + Number(r.values.quantity), 0),
          total = before + Number(row.values.quantity),
          quantity = Number(po.values.quantity),
          amount = Number(po.values.amountMinor),
          cost = Number(
            (BigInt(amount) * BigInt(total)) / BigInt(quantity) -
              (BigInt(amount) * BigInt(before)) / BigInt(quantity),
          );
        y = {
          ...y,
          extensions: [
            ...y.extensions.map((r) =>
              r.id === po.id && total === quantity
                ? {
                    ...r,
                    status: "received",
                    history: [
                      ...r.history,
                      {
                        at: new Date().toISOString(),
                        actorId: actor.id,
                        action: `Final delivery received ${row.id}`,
                      },
                    ],
                  }
                : r,
            ),
            {
              ...scope(y),
              id: crypto.randomUUID(),
              kind: "stock-movements",
              title: `Delivery: ${row.title}`.slice(0, 160),
              date: row.date,
              studentId: null,
              staffId: null,
              status: "posted",
              values: {
                itemId: po.values.itemId,
                direction: "Receipt",
                quantity: row.values.quantity,
                department: "School stores",
              },
              createdBy: actor.id,
              history: [
                {
                  at: new Date().toISOString(),
                  actorId: actor.id,
                  action: `Purchase receipt ${row.id}; order ${po.id}`,
                },
              ],
            },
          ],
          workflows: {
            ...y.workflows,
            counters: {
              ...y.workflows.counters,
              [key]: 1,
              ...(total === quantity ? { [`received-po:${po.id}`]: 1 } : {}),
            },
          },
        };
        if (cost > 0)
          y = postJournal(y, actor, {
            sourceKey: `purchase-receipt:${row.id}`,
            date: row.date,
            memo: `Received delivery: ${row.title}`.slice(0, 300),
            reversesId: null,
            lines: [
              {
                account: "Inventory expense",
                debitMinor: cost,
                creditMinor: 0,
              },
              { account: "Trade payable", debitMinor: 0, creditMinor: cost },
            ],
          });
      }
    }
    if (row.kind === "purchase-orders" && row.status === "received") {
      const key = `received-po:${row.id}`;
      if (!y.workflows.counters[key]) {
        y = {
          ...y,
          extensions: [
            ...y.extensions,
            {
              ...scope(y),
              id: crypto.randomUUID(),
              kind: "stock-movements",
              title: `Receipt: ${row.title}`.slice(0, 160),
              date: row.date,
              studentId: null,
              staffId: null,
              status: "posted",
              values: {
                itemId: row.values.itemId,
                direction: "Receipt",
                quantity: row.values.quantity,
                department: "School stores",
              },
              createdBy: actor.id,
              history: [
                {
                  at: new Date().toISOString(),
                  actorId: actor.id,
                  action: `Received purchase ${row.id}`,
                },
              ],
            },
          ],
          workflows: {
            ...y.workflows,
            counters: { ...y.workflows.counters, [key]: 1 },
          },
        };
        y = postJournal(y, actor, {
          sourceKey: `purchase:${row.id}`,
          date: row.date,
          memo: `Received purchase: ${row.title}`.slice(0, 300),
          reversesId: null,
          lines: [
            {
              account: "Inventory expense",
              debitMinor: Number(row.values.amountMinor),
              creditMinor: 0,
            },
            {
              account: "Trade payable",
              debitMinor: 0,
              creditMinor: Number(row.values.amountMinor),
            },
          ],
        });
      }
    }
    if (row.kind === "refunds" && row.status === "completed") {
      const payment = y.records.payments.find(
          (p) => p.id === row.values.paymentId && p.status === "completed",
        ),
        amount = Number(row.values.amountMinor);
      if (
        !payment ||
        old.status !== "approved" ||
        payment.amountMinor - payment.refundedMinor < amount
      )
        throw new Error("Approved refund exceeds the remaining collection.");
      y = {
        ...y,
        records: {
          ...y.records,
          payments: y.records.payments.map((p) =>
            p.id === payment.id
              ? { ...p, refundedMinor: p.refundedMinor + amount }
              : p,
          ),
        },
      };
    }
    if (row.kind === "journals" && row.status === "posted") {
      const debit = ledgerAccountSchema.parse(row.values.debitAccount),
        credit = ledgerAccountSchema.parse(row.values.creditAccount);
      if (debit === credit)
        throw new Error("Choose different debit and credit accounts.");
      y = postJournal(y, actor, {
        sourceKey: `journal:${row.id}`,
        date: row.date,
        memo: String(row.values.memo).slice(0, 300),
        reversesId: null,
        lines: [
          {
            account: debit,
            debitMinor: Number(row.values.amountMinor),
            creditMinor: 0,
          },
          {
            account: credit,
            debitMinor: 0,
            creditMinor: Number(row.values.amountMinor),
          },
        ],
      });
    }
    if (row.kind === "expenses" && row.status === "approved")
      y = postJournal(y, actor, {
        sourceKey: `expense:${row.id}`,
        date: row.date,
        memo: `Approved expense ${row.title}`.slice(0, 300),
        reversesId: null,
        lines: [
          {
            account: "Operating expense",
            debitMinor: Number(row.values.amountMinor),
            creditMinor: 0,
          },
          {
            account: "Trade payable",
            debitMinor: 0,
            creditMinor: Number(row.values.amountMinor),
          },
        ],
      });
    if (row.kind === "expenses" && row.status === "completed")
      y = postJournal(y, actor, {
        sourceKey: `expense-payment:${row.id}`,
        date: row.date,
        memo: `Recorded expense payment ${row.title}`.slice(0, 300),
        reversesId: null,
        lines: [
          {
            account: "Trade payable",
            debitMinor: Number(row.values.amountMinor),
            creditMinor: 0,
          },
          {
            account: "Bank",
            debitMinor: 0,
            creditMinor: Number(row.values.amountMinor),
          },
        ],
      });
    if (row.kind === "payment-plans" && row.status === "approved") {
      const count = Number(row.values.instalments),
        amount = Number(row.values.amountMinor);
      if (amount < count)
        throw new Error("Plan amount is too small for these instalments.");
      const start = new Date(`${row.values.dueDate}T00:00:00Z`),
        dates = Array.from({ length: count }, (_, i) => {
          const date = new Date(start);
          date.setUTCDate(1);
          date.setUTCMonth(start.getUTCMonth() + i);
          const last = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
          ).getUTCDate();
          date.setUTCDate(Math.min(start.getUTCDate(), last));
          return date.toISOString().slice(0, 10);
        });
      if (dates[0] < row.date)
        throw new Error(
          "The first instalment cannot be due before the plan date.",
        );
      if (
        dates.some(
          (d) =>
            d < y.setup.calendar.year.startDate ||
            d > y.setup.calendar.year.endDate,
        )
      )
        throw new Error("Every instalment must be inside this academic year.");
      const instalments = dates.map((dueDate, i) => ({
        dueDate,
        amountMinor: Math.floor(amount / count) + (i < amount % count ? 1 : 0),
      }));
      y = {
        ...y,
        workflows: {
          ...y.workflows,
          feePlans: [
            ...y.workflows.feePlans,
            {
              id: row.id,
              studentId: row.studentId!,
              name: row.title.slice(0, 80),
              instalments,
              lateFeeMinorPerDay: 0,
              lateFeeCapMinor: 0,
            },
          ],
        },
      };
      for (const [i, instalment] of instalments.entries())
        y = {
          ...y,
          records: {
            ...y.records,
            invoices: [
              ...y.records.invoices,
              {
                ...scope(y),
                id: crypto.randomUUID(),
                studentId: row.studentId!,
                reference: `PLAN-${row.id.slice(0, 80)}-${i + 1}`,
                period: `${row.title} (${i + 1}/${count})`.slice(0, 80),
                issuedOn: row.date,
                dueDate: instalment.dueDate,
                lines: [
                  {
                    id: crypto.randomUUID(),
                    name: row.title,
                    amountMinor: instalment.amountMinor,
                  },
                ],
                concessionMinor: 0,
                status: "issued",
              },
            ],
          },
        };
    }
    if (row.kind === "library-fines" && row.status === "settled") {
      const invoice = y.records.invoices.find(
        (i) => i.period === `Library fine ${row.id}`,
      );
      if (!invoice || balance(y, invoice.id) > 0)
        throw new Error(
          "Collect or approve a concession for the linked fine invoice before settlement.",
        );
    }
  }
  for (const row of next.extensions.filter(
    (r) =>
      r.kind === "library-fines" &&
      r.status === "outstanding" &&
      !previous.extensions.some((o) => o.id === r.id),
  )) {
    y = {
      ...y,
      records: {
        ...y.records,
        invoices: [
          ...y.records.invoices,
          {
            ...scope(y),
            id: crypto.randomUUID(),
            studentId: row.studentId!,
            reference: `LIB-${row.id.slice(0, 100)}`,
            period: `Library fine ${row.id}`,
            issuedOn: row.date,
            dueDate: row.date,
            lines: [
              {
                id: crypto.randomUUID(),
                name: row.title,
                amountMinor: Number(row.values.amountMinor),
              },
            ],
            concessionMinor: 0,
            status: "issued",
          },
        ],
      },
    };
  }
  return y;
}
