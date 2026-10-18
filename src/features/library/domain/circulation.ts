import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { OperationRecord } from "../../operations/models/index.ts";
import {
  activeStudent,
  operationalDate,
  unchangedDetails,
} from "../../operations/domain/workflow-context.ts";
export function guardCirculation(
  y: SchoolYearWorkspace,
  row: OperationRecord,
  old?: OperationRecord,
) {
  const rows = y.extensions.filter(
    (r) => r.id !== row.id && r.status !== "cancelled",
  );
  if (row.kind === "loans") {
    if (old) unchangedDetails(old, row);
    if (row.status === "cancelled")
      throw new Error(
        "Record the physical return instead of cancelling an issued loan.",
      );
    if (!old) {
      activeStudent(y, row.studentId);
      operationalDate(y, String(row.values.dueDate));
      if (String(row.values.dueDate) < row.date)
        throw new Error("The due date cannot precede issue.");
      const copy = rows.find(
        (r) =>
          r.id === row.values.copyId &&
          r.kind === "copies" &&
          r.status === "available",
      );
      if (
        !copy ||
        !rows.some(
          (r) =>
            r.id === copy.values.bookId &&
            r.kind === "books" &&
            r.status === "active",
        )
      )
        throw new Error("Choose an available copy of an active title.");
      if (
        rows.some(
          (r) =>
            r.kind === "loans" &&
            r.status === "issued" &&
            r.values.copyId === copy.id,
        )
      )
        throw new Error("This copy is already on loan.");
      const first = rows.filter(
        (r) =>
          r.kind === "reservations" &&
          ["requested", "ready"].includes(r.status) &&
          r.values.bookId === copy.values.bookId,
      )[0]; // Canonical append order is server controlled; client dates cannot jump the queue.
      if (first && first.studentId !== row.studentId)
        throw new Error(
          "The first student in the reservation queue has priority.",
        );
    }
  }
  if (row.kind === "reservations" && row.status !== "cancelled") {
    if (!old) activeStudent(y, row.studentId);
    if (old) unchangedDetails(old, row);
    if (
      !rows.some(
        (r) =>
          r.kind === "books" &&
          r.id === row.values.bookId &&
          r.status === "active",
      )
    )
      throw new Error("This catalogue title is not active.");
    if (
      ["requested", "ready"].includes(row.status) &&
      rows.some(
        (r) =>
          r.kind === "reservations" &&
          ["requested", "ready"].includes(r.status) &&
          r.studentId === row.studentId &&
          r.values.bookId === row.values.bookId,
      )
    )
      throw new Error(
        "This student already has an open reservation for this title.",
      );
    const copies = rows.filter(
      (r) =>
        r.kind === "copies" &&
        r.values.bookId === row.values.bookId &&
        r.status === "available",
    );
    if (
      row.status === "ready" &&
      !copies.some(
        (c) =>
          !rows.some(
            (r) =>
              r.kind === "loans" &&
              r.status === "issued" &&
              r.values.copyId === c.id,
          ),
      )
    )
      throw new Error(
        "A free physical copy is required before marking a reservation ready.",
      );
    if (
      row.status === "collected" &&
      !rows.some(
        (r) =>
          r.kind === "loans" &&
          r.status === "issued" &&
          r.studentId === row.studentId &&
          r.date >= row.date &&
          copies.some((c) => c.id === r.values.copyId),
      )
    )
      throw new Error(
        "Issue a matching copy to this student before marking the reservation collected.",
      );
  }
  if (row.kind === "library-fines") {
    const loan = rows.find(
      (r) =>
        r.kind === "loans" &&
        r.id === row.values.loanId &&
        r.studentId === row.studentId,
    );
    if (!loan) throw new Error("Fine must belong to this student's loan.");
    if (old) unchangedDetails(old, row);
    if (row.status === "cancelled")
      throw new Error(
        "Use an approved invoice concession to waive a linked fine.",
      );
  }
  if (
    ["copies", "books"].includes(row.kind) &&
    row.status !== (row.kind === "copies" ? "available" : "active")
  ) {
    const copies =
      row.kind === "copies"
        ? [row.id]
        : rows
            .filter((r) => r.kind === "copies" && r.values.bookId === row.id)
            .map((r) => r.id);
    if (
      rows.some(
        (r) =>
          r.kind === "loans" &&
          r.status === "issued" &&
          copies.includes(String(r.values.copyId)),
      )
    )
      throw new Error(
        "Return active loans before removing a copy or title from circulation.",
      );
  }
}
