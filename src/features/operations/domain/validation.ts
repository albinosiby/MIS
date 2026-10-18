import type { OperationRecord } from "../models/index.ts";
import { definition } from "../data/module-definitions.ts";
/** Context projection only. Canonical records remain owned by existing feature/shared schemas. */
export type OperationScope = {
  schoolId: string;
  academicYearId: string;
  ids: Record<string, string[]>;
  studentClasses:Record<string,string[]>;
  invoices: {
    id: string;
    studentId: string;
    amountMinor: number;
    status: string;
  }[];
  payments: {
    id: string;
    studentId: string;
    amountMinor: number;
    status: string;
  }[];
};
export function validateOperationalRecords(
  rows: OperationRecord[],
  scope: OperationScope,
) {
  const ids = new Set<string>();
  for (const [kind, field] of [
    ["copies", "barcode"],
    ["vehicles", "registration"],
    ["items", "sku"],
    ["assets", "assetTag"],
    ["cms-pages", "slug"],
  ]) {
    const values = rows
      .filter((r) => r.kind === kind && r.status !== "cancelled")
      .map((r) => String(r.values[field]).toLowerCase());
    if (new Set(values).size !== values.length)
      throw new Error(`Duplicate ${field} in ${kind}.`);
  }
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error("Duplicate operational record ID.");
    ids.add(row.id);
    if (
      row.schoolId !== scope.schoolId ||
      row.academicYearId !== scope.academicYearId
    )
      throw new Error(
        "Operational record belongs to another school or academic year.",
      );
    if (row.studentId && !scope.ids.students?.includes(row.studentId))
      throw new Error("Student is outside the selected school/year.");
    if (row.staffId && !scope.ids.staff?.includes(row.staffId))
      throw new Error("Staff member is outside the selected school/year.");
    for (const field of definition(row.kind).fields) {
      if (!field.relation) continue;
      const id = String(row.values[field.name]);
      const allowed =
        scope.ids[field.relation] ??
        rows
          .filter((x) => x.kind === field.relation && x.status !== "cancelled")
          .map((x) => x.id);
      if (!allowed.includes(id))
        throw new Error(`${field.label} does not exist in this school/year.`);
    }
    if (row.status === "cancelled") continue;
    if(row.kind==="quiz-attempts"){const quiz=rows.find(q=>q.id===row.values.quizId&&q.kind==="quizzes");if(!quiz||!row.studentId||!scope.studentClasses[row.studentId]?.includes(String(quiz.values.classSectionId))||Number(row.values.score)>Number(quiz.values.maxScore))throw new Error("Quiz attempt must match this student’s class history and score maximum.");}
    if (row.kind === "payment-attempts") {
      const invoice = scope.invoices.find(
        (i) => i.id === row.values.invoiceId && i.studentId === row.studentId,
      );
      if (!invoice || Number(row.values.amountMinor) > invoice.amountMinor)
        throw new Error(
          "Payment attempt must reference this student’s invoice and cannot exceed its total.",
        );
    }
    if (
      row.kind === "outpasses" &&
      ["approved", "out", "returned"].includes(row.status) &&
      row.values.guardianApproval !== "Granted"
    )
      throw new Error("Guardian approval is required for this outpass.");
    if (row.kind === "reconciliation") {
      const payment = scope.payments.find((p) => p.id === row.values.paymentId);
      if (!payment || payment.amountMinor !== row.values.amountMinor)
        throw new Error("Statement amount must match a completed payment.");
    }
    if (row.kind === "refunds") {
      const payment = scope.payments.find(
        (p) =>
          p.id === row.values.paymentId &&
          p.studentId === row.studentId &&
          p.status === "completed",
      );
      if (!payment)
        throw new Error(
          "Refund needs a completed payment belonging to this student.",
        );
      const total = rows
        .filter(
          (x) =>
            x.kind === "refunds" &&
            x.status !== "cancelled" &&
            x.values.paymentId === payment.id,
        )
        .reduce((s, x) => s + Number(x.values.amountMinor), 0);
      if (total > payment.amountMinor)
        throw new Error("Refund requests exceed the payment amount.");
    }
    if (row.kind === "loans" && row.status === "issued") {
      const copy = rows.find(
        (x) => x.kind === "copies" && x.id === row.values.copyId,
      );
      if (copy?.status !== "available")
        throw new Error("This copy is not available for issue.");
      if (
        rows.filter(
          (x) =>
            x.kind === "loans" &&
            x.status === "issued" &&
            x.values.copyId === row.values.copyId,
        ).length > 1
      )
        throw new Error("This physical copy is already on loan.");
    }
    if (row.kind === "hostel-allocations" && row.status === "active") {
      const bed = rows.find(
        (x) => x.kind === "beds" && x.id === row.values.bedId,
      );
      if (bed?.status !== "available")
        throw new Error("This bed is unavailable.");
      if (
        rows.some(
          (x) =>
            x.id !== row.id &&
            x.kind === row.kind &&
            x.status === "active" &&
            x.values.bedId === row.values.bedId &&
            x.values.startDate <= row.values.endDate &&
            row.values.startDate <= x.values.endDate,
        )
      )
        throw new Error("The bed is allocated for overlapping dates.");
    }
    if (row.kind === "activity-enrolments" && row.status === "approved") {
      const club = rows.find(
        (x) => x.kind === "clubs" && x.id === row.values.clubId,
      );
      if (club?.status !== "open")
        throw new Error("Activity enrolment is closed.");
      const enrolled = rows.filter(
        (x) =>
          x.kind === row.kind &&
          x.status === "approved" &&
          x.values.clubId === row.values.clubId,
      );
      if (enrolled.length > Number(club.values.capacity))
        throw new Error("Activity capacity reached.");
      if (enrolled.filter((x) => x.studentId === row.studentId).length > 1)
        throw new Error("Student is already enrolled in this activity.");
    }
    if (
      row.kind === "seating" &&
      rows.some(
        (x) =>
          x.id !== row.id &&
          x.kind === row.kind &&
          x.status !== "cancelled" &&
          x.values.examId === row.values.examId &&
          x.values.room === row.values.room &&
          x.values.seat === row.values.seat,
      )
    )
      throw new Error("This examination seat is already allocated.");
    if (
      row.kind === "ptm" &&
      row.status === "booked" &&
      rows.some(
        (x) =>
          x.id !== row.id &&
          x.kind === "ptm" &&
          x.status === "booked" &&
          x.staffId === row.staffId &&
          x.values.meetingDate === row.values.meetingDate &&
          x.values.time === row.values.time,
      )
    )
      throw new Error("This teacher meeting slot is already booked.");
  }
  for (const item of rows.filter((x) => x.kind === "items")) {
    const balance = rows
      .filter(
        (x) =>
          x.kind === "stock-movements" &&
          x.status === "posted" &&
          x.values.itemId === item.id,
      )
      .reduce(
        (s, x) =>
          s +
          (x.values.direction === "Issue" ? -1 : 1) * Number(x.values.quantity),
        0,
      );
    if (balance < 0)
      throw new Error("Cannot issue more stock than is available.");
  }
}
