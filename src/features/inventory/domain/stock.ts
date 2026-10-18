import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { OperationRecord } from "../../operations/models/index.ts";
import { unchangedDetails } from "../../operations/domain/workflow-context.ts";
export function stockBalance(
  rows: OperationRecord[],
  itemId: string,
  department?: string,
) {
  return rows
    .filter(
      (r) =>
        r.kind === "stock-movements" &&
        r.status === "posted" &&
        r.values.itemId === itemId &&
        (!department || r.values.department === department),
    )
    .reduce(
      (sum, r) =>
        sum +
        (r.values.direction === "Issue" ? -1 : 1) * Number(r.values.quantity),
      0,
    );
}
export function guardStock(
  y: SchoolYearWorkspace,
  row: OperationRecord,
  old?: OperationRecord,
) {
  if (row.kind === "purchase-receipts" && row.status === "posted") {
    if (old) unchangedDetails(old, row);
    const po = y.extensions.find(
      (r) =>
        r.kind === "purchase-orders" &&
        r.id === row.values.purchaseOrderId &&
        r.status === "approved",
    );
    if (!po)
      throw new Error(
        "Receive against an approved order with an outstanding delivery.",
      );
    if (row.date < po.date)
      throw new Error("Delivery date cannot precede its purchase order.");
    const prior = y.extensions.filter(
      (r) =>
        r.kind === "purchase-receipts" &&
        r.id !== row.id &&
        r.status === "posted" &&
        r.values.purchaseOrderId === po.id,
    );
    if (
      prior.some(
        (r) =>
          String(r.values.deliveryReference).toLowerCase() ===
          String(row.values.deliveryReference).toLowerCase(),
      )
    )
      throw new Error("This delivery note was already received for the order.");
    if (
      prior.reduce((s, r) => s + Number(r.values.quantity), 0) +
        Number(row.values.quantity) >
      Number(po.values.quantity)
    )
      throw new Error("Deliveries cannot exceed the ordered quantity.");
    if (
      !y.extensions.some(
        (r) =>
          r.kind === "items" &&
          r.id === po.values.itemId &&
          r.status === "active",
      )
    )
      throw new Error("The purchased item is no longer active.");
  }
  if (
    row.kind === "purchase-orders" &&
    row.status === "received" &&
    y.extensions.some(
      (r) =>
        r.kind === "purchase-receipts" &&
        r.status === "posted" &&
        r.values.purchaseOrderId === row.id,
    )
  )
    throw new Error(
      "Post the outstanding delivery through Purchase receipts to finish a partially received order.",
    );
  if (
    row.kind === "purchase-orders" &&
    row.status === "cancelled" &&
    y.extensions.some(
      (r) =>
        r.kind === "purchase-receipts" &&
        r.status === "posted" &&
        r.values.purchaseOrderId === row.id,
    )
  )
    throw new Error(
      "A partially received order cannot be cancelled. Preserve its received stock and payable history.",
    );
  if (
    row.kind === "purchase-orders" &&
    ["submitted", "approved", "received"].includes(row.status)
  ) {
    if (
      !y.extensions.some(
        (r) =>
          r.kind === "vendors" &&
          r.id === row.values.vendorId &&
          r.status === "active",
      ) ||
      !y.extensions.some(
        (r) =>
          r.kind === "items" &&
          r.id === row.values.itemId &&
          r.status === "active",
      )
    )
      throw new Error("Procurement requires an active vendor and item.");
  }
  if (row.kind === "stock-movements" && row.status === "posted") {
    if (old) unchangedDetails(old, row);
    if (
      !y.extensions.some(
        (r) =>
          r.kind === "items" &&
          r.id === row.values.itemId &&
          r.status === "active",
      )
    )
      throw new Error("Choose an active stock item.");
    const rows = y.extensions.filter((r) => r.id !== row.id),
      quantity = Number(row.values.quantity);
    if (
      row.values.direction === "Issue" &&
      stockBalance(rows, String(row.values.itemId)) < quantity
    )
      throw new Error("Cannot issue more stock than is available.");
    const dated = new Map<string, number>();
    for (const movement of [
      ...rows.filter(
        (r) =>
          r.kind === "stock-movements" &&
          r.status === "posted" &&
          r.values.itemId === row.values.itemId,
      ),
      row,
    ])
      dated.set(
        movement.date,
        (dated.get(movement.date) ?? 0) +
          (movement.values.direction === "Issue" ? -1 : 1) *
            Number(movement.values.quantity),
      );
    let running = 0;
    for (const [, net] of [...dated].sort(([a], [b]) => a.localeCompare(b))) {
      running += net;
      if (running < 0)
        throw new Error(
          "A backdated movement would make historical stock negative.",
        );
    }
    if (row.values.direction === "Return") {
      const department = String(row.values.department),
        issued = rows
          .filter(
            (r) =>
              r.kind === "stock-movements" &&
              r.status === "posted" &&
              r.values.itemId === row.values.itemId &&
              r.values.department === department,
          )
          .reduce(
            (sum, r) =>
              sum +
              (r.values.direction === "Issue"
                ? 1
                : r.values.direction === "Return"
                  ? -1
                  : 0) *
                Number(r.values.quantity),
            0,
          );
      if (quantity > issued)
        throw new Error(
          "A department cannot return more than its outstanding issued stock.",
        );
    }
  }
}
