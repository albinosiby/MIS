import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import {
  workspaceSchema,
  schoolYearWorkspaceSchema,
} from "../src/features/workspace/schemas/workspace.schema.ts";
import {
  academicReferenceDate,
  academicWeekdayDate,
  numberFromForm,
} from "../src/features/workspace/domain/form-values.ts";
import {
  scope,
  putRecord,
  takePayment,
  decideLeave,
  publishNotice,
} from "../src/features/workspace/domain/operations.ts";
import { publishExam } from "../src/features/exams/domain/exam-workflow.ts";
import { rolloverYear } from "../src/features/settings/domain/rollover.ts";
import { saveGuardianLink } from "../src/features/students/domain/guardian-links.ts";
import { connectSetupUpdate } from "../src/features/workspace/domain/setup-bridge.ts";
import { importStudents } from "../src/features/school-setup/domain/import-students.ts";
import { invoiceSchema } from "../src/features/fees/schemas/fees.schema.ts";
const year = () => createWorkspace().years[0];
test("valid decimal currency input survives binary rounding while sub-minor fractions remain invalid", () => {
  assert.equal(numberFromForm("1.15", 100), 115);
  assert.equal(numberFromForm("100.05", 100), 10005);
  assert.ok(Number.isNaN(numberFromForm("", 100)));
  const invoice = year().records.invoices[0];
  assert.equal(
    invoiceSchema.safeParse({
      ...invoice,
      lines: [
        { ...invoice.lines[0], amountMinor: numberFromForm("1.151", 100) },
      ],
    }).success,
    false,
  );
});
test("form defaults stay inside shifted or shortened academic years and proxy dates match weekdays", () => {
  const range = { startDate: "2026-11-01", endDate: "2027-02-28" };
  assert.equal(academicReferenceDate(range), range.startDate);
  const full = { startDate: "2027-04-01", endDate: "2028-03-31" };
  assert.equal(academicReferenceDate(full), "2027-10-14");
  const proxy = academicWeekdayDate(full, "Monday");
  assert.equal(new Date(proxy + "T00:00:00Z").getUTCDay(), 1);
  assert.ok(proxy >= full.startDate && proxy <= full.endDate);
});
test("approved leave reconciles existing daily and period attendance without altering other people", () => {
  let y = year();
  const person = y.setup.students[0],
    date = y.setup.calendar.year.startDate,
    periodId = y.setup.bells.find((p) => p.kind === "period")!.id;
  y = putRecord(y, "attendance", {
    ...scope(y),
    id: "period-before-leave",
    personType: "student",
    personId: person.id,
    date,
    periodId,
    status: "present",
    note: "",
  });
  y = putRecord(y, "leaves", {
    ...scope(y),
    id: "student-leave-test",
    personType: "student",
    personId: person.id,
    dates: { startDate: date, endDate: date },
    reason: "Family appointment.",
    status: "pending",
    decisionNote: "",
  });
  const before = y.records.attendance.find(
    (a) => a.personId === y.setup.students[1].id,
  )!;
  const next = decideLeave(
    y,
    "student-leave-test",
    "approved",
    "Reviewed family appointment.",
  );
  assert.equal(
    next.records.attendance.find((a) => a.id === "period-before-leave")!.status,
    "excused",
  );
  assert.ok(
    next.records.attendance.some(
      (a) =>
        a.personId === person.id &&
        a.date === date &&
        a.periodId === null &&
        a.status === "excused",
    ),
  );
  assert.deepEqual(
    next.records.attendance.find((a) => a.id === before.id),
    before,
  );
});
test("foreign-scope payment replays are rejected even with a previously successful idempotency key", () => {
  const y = year(),
    invoice = y.records.invoices[0],
    payment = {
      ...scope(y),
      id: "payment-scope",
      invoiceId: invoice.id,
      amountMinor: 115,
      paidOn: invoice.issuedOn,
      method: "Cash",
      reference: "SCOPE-RECEIPT",
      idempotencyKey: "scope-key",
      status: "completed",
      note: "",
    };
  const next = takePayment(y, payment);
  assert.throws(() => takePayment(next, { ...payment, schoolId: "foreign" }));
  assert.throws(() =>
    takePayment(next, { ...payment, academicYearId: "foreign" }),
  );
});
test("publish cannot bypass the lock on completed examination results", () => {
  const y = year();
  y.records.exams[0].status = "completed";
  assert.throws(() => publishExam(y, y.records.exams[0].id), /locked/);
});
test("guardian links update rather than duplicate, enforce scope and control notice recipients", () => {
  let y = year();
  const link = y.setup.relationships[0],
    notice = y.records.notices[0];
  const count = y.setup.relationships.length;
  y = saveGuardianLink(y, {
    ...link,
    academicYearId: y.setup.calendar.year.id,
    canReceiveNotices: false,
  });
  assert.equal(y.setup.relationships.length, count);
  assert.equal(y.setup.portal.invitationsPrepared, false);
  y = putRecord(y, "notices", {
    ...notice,
    status: "draft",
    audience: "guardians",
    recipientIds: [],
    acknowledgedIds: [],
  });
  y = publishNotice(y, notice.id);
  assert.ok(
    !y.records.notices
      .find((n) => n.id === notice.id)!
      .recipientIds.includes(link.guardianId),
  );
  assert.throws(() =>
    saveGuardianLink(y, { ...link, academicYearId: "foreign" }),
  );
  assert.throws(() =>
    saveGuardianLink(y, {
      ...link,
      studentId: "missing",
      academicYearId: y.setup.calendar.year.id,
    }),
  );
});
test("CSV imported students without demographic profiles still receive permitted guardian notices", () => {
  const y = year(),
    csv = `admissionNumber,displayName,classSectionId,guardianName,guardianEmail,guardianPhone\nAUDIT-CSV,Imported Student,${y.setup.classes[0].id},Imported Guardian,imported@example.com,+919999999999`;
  const setup = importStudents(y.setup, csv),
    next = connectSetupUpdate(y, setup, "Imported student CSV");
  const added = next.setup.students.find(
      (s) => s.admissionNumber === "AUDIT-CSV",
    )!,
    link = next.setup.relationships.find((l) => l.studentId === added.id)!;
  const notice = next.records.notices[0];
  const draft = putRecord(next, "notices", {
    ...notice,
    status: "draft",
    audience: "guardians",
    recipientIds: [],
    acknowledgedIds: [],
  });
  const sent = publishNotice(draft, notice.id);
  assert.ok(
    sent.records.notices
      .find((n) => n.id === notice.id)!
      .recipientIds.includes(link.guardianId),
  );
});
test("setup notification preparation connects to noticeboard and notification center once", () => {
  const y = year(),
    setup = structuredClone(y.setup);
  setup.notifications.push({
    id: "setup-message-test",
    at: new Date().toISOString(),
    recipients: [setup.guardians[0].id],
    status: "simulated",
  });
  const next = connectSetupUpdate(y, setup, "Prepared setup preview");
  schoolYearWorkspaceSchema.parse(next);
  assert.equal(next.records.notices.length, y.records.notices.length + 1);
  assert.equal(
    next.records.notifications.length,
    y.records.notifications.length + 1,
  );
  assert.equal(
    connectSetupUpdate(next, setup, "Retry").records.notices.length,
    next.records.notices.length,
  );
});
test("editing published notices invalidates old acknowledgments and approved lesson edits require review", () => {
  let y = year(),
    notice = y.records.notices[0];
  y = putRecord(y, "notices", {
    ...notice,
    status: "published",
    recipientIds: [y.setup.guardians[0].id],
    acknowledgedIds: [y.setup.guardians[0].id],
  });
  notice = y.records.notices.find((n) => n.id === notice.id)!;
  y = putRecord(y, "notices", {
    ...notice,
    body: "Revised communication content.",
  });
  const edited = y.records.notices.find((n) => n.id === notice.id)!;
  assert.equal(edited.status, "draft");
  assert.deepEqual(edited.acknowledgedIds, []);
  const lesson = y.records.lessons[0];
  y = putRecord(y, "lessons", { ...lesson, status: "approved" });
  y = putRecord(y, "lessons", {
    ...y.records.lessons.find((l) => l.id === lesson.id)!,
    title: "Revised lesson objectives",
  });
  assert.equal(
    y.records.lessons.find((l) => l.id === lesson.id)!.status,
    "draft",
  );
});
test("renaming a canonical subject keeps legacy teaching allocations connected", () => {
  const y = year(),
    subject = y.records.subjects.find((s) =>
      y.setup.allocations.some((a) => a.subject === s.name),
    )!;
  assert.ok(subject);
  const next = putRecord(y, "subjects", {
    ...subject,
    name: "Renamed subject",
  });
  assert.ok(!next.setup.allocations.some((a) => a.subject === subject.name));
  assert.ok(
    next.setup.allocations.some((a) => a.subject === "Renamed subject"),
  );
});
test("rollover retains custom transport assignments and keeps repeated carry-forward references bounded", () => {
  const root = createWorkspace(),
    y = root.years[0];
  y.setup.completed = [
    "school-profile",
    "academic-terms",
    "classes-sections",
    "bell-schedule",
    "fee-structure",
    "staff-allocations",
    "data-ingestion",
    "portal-gateway",
  ];
  y.extensions = [];
  y.setup.exceptions = [];
  y.setup.portal.invitationsPrepared = true;
  y.setup.portal.acknowledgeSimulation = true;
  y.records.approvals = [];
  y.records.leaves = [];
  y.records.exams = y.records.exams.map((e) => ({ ...e, status: "completed" }));
  y.records.promotions = y.setup.students.map((s) => ({
    ...scope(y),
    id: "directive-" + s.id,
    studentId: s.id,
    targetClassId: s.classSectionId,
    decision: "retain",
    note: "Reviewed",
  }));
  const route = {
    ...y.records.routes[0],
    id: "custom-route",
    name: "Custom campus bus",
  };
  y.records.routes.push(route);
  y.records.studentProfiles[0].routeId = route.id;
  y.records.invoices[0].reference = "I".repeat(128);
  workspaceSchema.parse(root);
  const next = rolloverYear(root, {
    name: "2027-28",
    startDate: "2027-04-01",
    endDate: "2028-03-31",
    acknowledged: true,
  });
  const target = next.years[1];
  assert.ok(target.records.routes.some((r) => r.id === route.id));
  assert.equal(target.records.studentProfiles[0].routeId, route.id);
  assert.ok(
    target.records.invoices.every(
      (i) => i.reference.length <= 128 && i.period.length <= 80,
    ),
  );
  assert.equal(next.years[0].records.invoices[0].reference, "I".repeat(128));
});

test("public admission core contact fields do not require duplicate answers", async () => {
  const { submitInquiry } = await import(
    "../src/features/admissions/domain/admission-workflow.ts"
  );
  const y = year();
  y.records.admissionForms[0].requireDocuments = false;
  const base = {
    ...y.records.inquiries[0],
    id: "public-core-fields",
    answers: {},
    documents: [],
    stage: "new",
    studentId: null,
  };
  assert.ok(
    submitInquiry(y, base, true).records.inquiries.some(
      (r) => r.id === base.id,
    ),
  );
});

test("editing a record preserves its table position and does not move it to another page", () => {
  const y = year(),
    before = y.records.inquiries.map((r) => r.id),
    record = y.records.inquiries[0];
  const next = putRecord(y, "inquiries", {
    ...record,
    notes: "Edited without changing list order.",
  });
  assert.deepEqual(
    next.records.inquiries.map((r) => r.id),
    before,
  );
  assert.equal(
    next.records.inquiries[0].notes,
    "Edited without changing list order.",
  );
});

test("scheduler rejects impossible calendar dates rather than normalizing them", async () => {
  const { runScheduledJobs } = await import(
    "../src/features/communication/domain/reports.ts"
  );
  assert.throws(() => runScheduledJobs(year(), "2026-02-31"));
});

test("marks CSV accepts school-wide batches exceeding the student-import 500-row cap", async () => {
  const { importMarksCsv, marksTemplate } = await import(
    "../src/features/exams/domain/import-marks.ts"
  );
  const { enrolStudent } = await import(
    "../src/features/workspace/domain/operations.ts"
  );
  const { parseCsv } = await import("../src/shared/data/csv.ts");
  let y = year();
  y.records.admissionForms[0].requireDocuments = false;
  const g = y.setup.guardians[0],
    p = y.records.studentProfiles[0];
  y = enrolStudent(y, {
    studentName: "Bulk Marks Student",
    admissionNumber: "BULK-NEW",
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    classSectionId: y.setup.classes[0].id,
    address: p.address,
    guardianName: g.displayName,
    email: g.email,
    phone: g.phone,
    existingGuardianId: g.id,
    emergencyName: p.emergencyName,
    emergencyPhone: p.emergencyPhone,
    routeId: null,
    documents: [],
    generateInvoice: false,
    inquiryId: null,
  });
  const exam = y.records.exams[0];
  exam.subjectIds = y.records.subjects.map((s) => s.id);
  const rows = parseCsv(marksTemplate(y, exam.id), 20000);
  const text = [
    rows[0].join(","),
    ...rows.slice(1).map((row) => [row[0], row[1], 77].join(",")),
  ].join("\n");
  assert.ok(rows.length > 501);
  assert.throws(() => parseCsv(text));
  const next = importMarksCsv(y, exam.id, text);
  assert.equal(
    next.records.marks.filter((m) => m.examId === exam.id).length,
    505,
  );
});

test("optional custom admission dates accept blank answers and reject impossible dates", async () => {
  const { submitInquiry } = await import(
    "../src/features/admissions/domain/admission-workflow.ts"
  );
  const y = year();
  y.records.admissionForms[0].requireDocuments = false;
  y.records.admissionForms[0].fields.push({
    id: "extra-date",
    label: "Preferred date",
    type: "date",
    required: false,
    options: "",
  });
  const value = {
    ...y.records.inquiries[0],
    id: "optional-date-test",
    answers: { "extra-date": "" },
    stage: "new",
    studentId: null,
  };
  assert.ok(submitInquiry(y, value, true));
  assert.throws(() =>
    submitInquiry(
      y,
      { ...value, answers: { "extra-date": "2026-02-31" } },
      true,
    ),
  );
});

test("exam papers and facility bookings use the same room occupancy ledger", async () => {
  const { autoScheduleExam } = await import(
    "../src/features/exams/domain/exam-workflow.ts"
  );
  const { roomOccupied } = await import(
    "../src/features/workspace/domain/room-occupancy.ts"
  );
  let y = year();
  const exam = y.records.exams[0],
    periodId = y.setup.bells.find((b) => b.kind === "period")!.id,
    room = y.records.rooms[0].name;
  y = putRecord(y, "reservations", {
    ...scope(y),
    id: "reserved-before-exam",
    date: exam.dates.startDate,
    periodId,
    room,
    title: "Reserved facility event",
  });
  y = autoScheduleExam(y, exam.id);
  assert.ok(
    !y.records.papers.some(
      (p) =>
        p.date === exam.dates.startDate &&
        p.periodId === periodId &&
        p.room === room,
    ),
  );
  const paper = y.records.papers[0];
  assert.equal(
    roomOccupied(y.records, paper.date, paper.periodId, paper.room),
    true,
  );
  assert.throws(() =>
    putRecord(y, "reservations", {
      ...scope(y),
      id: "conflicting-booking",
      date: paper.date,
      periodId: paper.periodId,
      room: paper.room,
      title: "Conflicting facility booking",
    }),
  );
  const scheduled = year();
  const reservation = {
    ...scope(scheduled),
    id: "fixed-reservation",
    date: exam.dates.startDate,
    periodId,
    room,
    title: "Existing room booking",
  };
  const reserved = putRecord(scheduled, "reservations", reservation);
  assert.throws(() =>
    putRecord(reserved, "papers", {
      ...scope(reserved),
      id: "manual-conflict",
      examId: exam.id,
      classSectionId: exam.classSectionIds[0],
      subjectId: exam.subjectIds[0],
      date: exam.dates.startDate,
      periodId,
      room,
      invigilatorId: y.setup.staff[0].id,
    }),
  );
});
