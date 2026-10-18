import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { OperationRecord } from "../../operations/models/index.ts";
import {
  activeStudent,
  operationalDate,
  overlaps,
  unchangedDetails,
} from "../../operations/domain/workflow-context.ts";
export function guardResidence(
  y: SchoolYearWorkspace,
  row: OperationRecord,
  old?: OperationRecord,
) {
  if (
    row.kind === "outpasses" &&
    old?.status === "out" &&
    row.status === "cancelled"
  )
    throw new Error("Record the student return before closing an outpass.");
  const rows = y.extensions.filter(
    (r) => r.id !== row.id && r.status !== "cancelled",
  );
  if (row.kind === "hostel-allocations") {
    if (old?.status === "active") unchangedDetails(old, row);
    if (old?.status === "active" && row.status === "cancelled")
      throw new Error("End an active allocation using checkout.");
    if (["draft", "active"].includes(row.status)) {
      activeStudent(y, row.studentId);
      operationalDate(y, String(row.values.startDate));
      operationalDate(y, String(row.values.endDate));
      if (row.values.startDate > row.values.endDate)
        throw new Error("Allocation dates are reversed.");
      if (
        row.status === "active" &&
        rows.some(
          (r) =>
            r.kind === row.kind &&
            r.status === "active" &&
            (r.studentId === row.studentId ||
              r.values.bedId === row.values.bedId) &&
            overlaps(r, row),
        )
      )
        throw new Error(
          "Student or bed already has an overlapping allocation.",
        );
    }
    if (
      row.status === "ended" &&
      rows.some(
        (r) =>
          r.kind === "outpasses" &&
          r.studentId === row.studentId &&
          ["approved", "out"].includes(r.status),
      )
    )
      throw new Error(
        "Close the student's outstanding outpasses before checkout.",
      );
  }
  if (
    ["outpasses", "roll-call", "hostel-visitors"].includes(row.kind) &&
    row.status !== "cancelled"
  ) {
    const start = String(row.values.startDate ?? row.date),
      end = String(row.values.endDate ?? row.date);
    if (
      !rows.some(
        (r) =>
          r.kind === "hostel-allocations" &&
          r.status === "active" &&
          r.studentId === row.studentId &&
          String(r.values.startDate) <= start &&
          String(r.values.endDate) >= end,
      )
    )
      throw new Error("An active hostel allocation must cover these dates.");
    if (row.kind === "outpasses") {
      if (start > end) throw new Error("Return must follow departure.");
      if (old && old.status !== "requested") unchangedDetails(old, row);
      if (
        ["approved", "out"].includes(row.status) &&
        rows.some(
          (r) =>
            r.kind === "outpasses" &&
            r.studentId === row.studentId &&
            ["approved", "out"].includes(r.status) &&
            overlaps(r, row),
        )
      )
        throw new Error("An approved outpass already overlaps these dates.");
      if (old?.status === "out" && row.status === "cancelled")
        throw new Error(
          "Record the student's return before closing an outpass.",
        );
    }
    if (row.kind === "roll-call") {
      if (
        rows.some(
          (r) =>
            r.kind === "roll-call" &&
            r.studentId === row.studentId &&
            r.date === row.date,
        )
      )
        throw new Error(
          "Roll call is already recorded for this student and date.",
        );
      const out = rows.some(
        (r) =>
          r.kind === "outpasses" &&
          r.studentId === row.studentId &&
          r.status === "out" &&
          String(r.values.startDate) <= row.date &&
          String(r.values.endDate) >= row.date,
      );
      if ((row.values.status === "On approved outpass") !== out)
        throw new Error(
          "Roll call must agree with the recorded outpass departure and return.",
        );
    }
  }
  if (
    row.kind === "beds" &&
    row.status !== "available" &&
    rows.some(
      (r) =>
        r.kind === "hostel-allocations" &&
        r.status === "active" &&
        r.values.bedId === row.id,
    )
  )
    throw new Error(
      "Check out the active bed allocation before making the bed unavailable.",
    );
}
