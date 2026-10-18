import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import {
  workspaceSchema,
  schoolYearWorkspaceSchema,
} from "../src/features/workspace/schemas/workspace.schema.ts";
import {
  scope,
  putRecord,
  balance,
  takePayment,
  enrolStudent,
  progressInquiry,
  decideLeave,
  decideApproval,
  publishNotice,
  csvExport,
} from "../src/features/workspace/domain/operations.ts";
import { saveRegister } from "../src/features/attendance/domain/save-register.ts";
import {
  saveMarks,
  autoScheduleExam,
  publishExam,
  completeExam,
} from "../src/features/exams/domain/exam-workflow.ts";
import { generateInvoices } from "../src/features/fees/domain/generate-invoices.ts";
import {
  importCalendar,
  calendarIcs,
} from "../src/features/communication/domain/calendar.ts";
import {
  reportRows,
  runScheduledJobs,
} from "../src/features/communication/domain/reports.ts";
import { reportKeys } from "../src/features/communication/schemas/communication.schema.ts";
import {
  rolloverYear,
  rolloverBlockers,
} from "../src/features/settings/domain/rollover.ts";
import { submitInquiry } from "../src/features/admissions/domain/admission-workflow.ts";
const year = () => createWorkspace().years[0];
test("workspace seed and backup round trip preserve every module and reject foreign references", () => {
  const root = createWorkspace();
  assert.deepEqual(
    workspaceSchema.parse(JSON.parse(JSON.stringify(root))),
    root,
  );
  const y = root.years[0];
  assert.equal(y.setup.students.length, 100);
  assert.equal(y.records.inquiries.length, 18);
  assert.throws(() =>
    putRecord(y, "studentProfiles", {
      ...y.records.studentProfiles[0],
      studentId: "foreign",
    }),
  );
  const bad = structuredClone(root);
  bad.years[0].records.inquiries[0].schoolId = "foreign";
  assert.equal(workspaceSchema.safeParse(bad).success, false);
});
test("admission transitions enforce predecessors and enrolment atomically creates owned records", () => {
  let y = year();
  y.records.admissionForms[0].requireDocuments = false;
  const q = y.records.inquiries[0];
  assert.throws(() => progressInquiry(y, q.id, "offered"));
  const s = y.setup.students[0],
    p = y.records.studentProfiles[0],
    g = y.setup.guardians[0];
  const request = {
    studentName: "New Student",
    admissionNumber: "DEMO-NEW-1001",
    dateOfBirth: p.dateOfBirth,
    gender: p.gender,
    classSectionId: s.classSectionId,
    address: p.address,
    guardianName: g.displayName,
    email: g.email,
    phone: g.phone,
    existingGuardianId: null,
    emergencyName: p.emergencyName,
    emergencyPhone: p.emergencyPhone,
    routeId: null,
    documents: [],
    generateInvoice: true,
    inquiryId: null,
  };
  const next = enrolStudent(y, request);
  assert.equal(next.setup.students.length, 101);
  assert.equal(next.setup.guardians.length, 101);
  assert.equal(next.records.invoices.length, y.records.invoices.length + 1);
  assert.throws(() => enrolStudent(next, request));
  assert.equal(y.setup.students.length, 100);
  assert.throws(() =>
    enrolStudent(y, { ...request, classSectionId: "other-school" }),
  );
});
test("public form uses configured fields, pause switch and required documents", () => {
  const y = year();
  const record = {
    ...y.records.inquiries[0],
    id: "public-test",
    stage: "new",
    studentId: null,
  };
  assert.throws(() => submitInquiry(y, record, true));
  y.records.admissionForms[0].requireDocuments = false;
  record.answers = Object.fromEntries(
    y.records.admissionForms[0].fields.map((f) => [
      f.id,
      f.type === "email"
        ? "demo@example.com"
        : f.type === "phone"
          ? "+919999999999"
          : "Test Student",
    ]),
  );
  assert.ok(
    submitInquiry(y, record, true).records.inquiries.some(
      (q) => q.id === "public-test" && q.source === "Website",
    ),
  );
  y.records.admissionForms[0].accepting = false;
  assert.throws(() => submitInquiry(y, record, true));
});
test("payments are idempotent and prevent overpayment or reuse for changed amounts", () => {
  const y = year(),
    invoice = y.records.invoices[0];
  const payment = {
    ...scope(y),
    id: "payment-test",
    invoiceId: invoice.id,
    amountMinor: 10000,
    paidOn: invoice.issuedOn,
    method: "Cash",
    reference: "RCPT-TEST",
    idempotencyKey: "key-test",
    status: "completed",
    note: "",
  };
  const next = takePayment(y, payment);
  assert.equal(balance(next, invoice.id), balance(y, invoice.id) - 10000);
  assert.equal(takePayment(next, payment).records.payments.length, 1);
  assert.throws(() => takePayment(next, { ...payment, amountMinor: 20000 }));
  assert.throws(() =>
    takePayment(y, { ...payment, amountMinor: balance(y, invoice.id) + 1 }),
  );
  assert.throws(() => takePayment(y, { ...payment, schoolId: "foreign" }));
});
test("batch invoice generation is repeat-safe and concessions use approval decisions", () => {
  let y = year();
  const request = {
    ...scope(y),
    studentIds: [y.setup.students[0].id],
    feeHeadIds: [y.setup.fees[0].id],
    period: "Demo unique term",
    issuedOn: y.setup.calendar.year.startDate,
    dueDate: y.setup.calendar.year.endDate,
    concessionPercent: 0,
  };
  y = generateInvoices(y, request);
  const count = y.records.invoices.length;
  assert.equal(generateInvoices(y, request).records.invoices.length, count);
  const approval = y.records.approvals.find(
    (a) => a.category === "concession",
  )!;
  const before = balance(y, approval.targetId!);
  y = decideApproval(
    y,
    approval.id,
    "approved",
    "Reviewed eligible concession.",
  );
  assert.equal(balance(y, approval.targetId!), before - approval.amountMinor);
  assert.throws(() =>
    decideApproval(y, approval.id, "approved", "Reviewed again."),
  );
});
test("approved leave marks attendance excused and cannot be overwritten by a present register", () => {
  let y = year();
  const leave = y.records.leaves[0];
  y = decideLeave(y, leave.id, "approved", "Approved for family requirements.");
  const request = {
    ...scope(y),
    personType: "staff",
    classSectionId: null,
    date: leave.dates.startDate,
    periodId: null,
    entries: [{ personId: leave.personId, status: "present", note: "" }],
  };
  assert.throws(() => saveRegister(y, request));
  const next = saveRegister(y, {
    ...request,
    entries: [
      { personId: leave.personId, status: "excused", note: "Approved leave" },
    ],
  });
  assert.ok(
    next.records.attendance.some(
      (a) => a.personId === leave.personId && a.status === "excused",
    ),
  );
  assert.throws(() => saveRegister(y, { ...request, schoolId: "foreign" }));
  assert.throws(() =>
    decideLeave(y, leave.id, "rejected", "Changed decision."),
  );
});
test("exam schedule clashes, marks maxima and locked results are checked", () => {
  let y = year();
  const exam = y.records.exams[0];
  y = autoScheduleExam(y, exam.id);
  y = publishExam(y, exam.id);
  const subject = exam.subjectIds[0],
    classId = exam.classSectionIds[0],
    student = y.setup.students.find((s) => s.classSectionId === classId)!;
  const request = {
    ...scope(y),
    examId: exam.id,
    classSectionId: classId,
    subjectId: subject,
    entries: [{ studentId: student.id, marks: exam.maxMarks + 1 }],
  };
  assert.throws(() => saveMarks(y, request));
  y = saveMarks(y, {
    ...request,
    entries: [{ studentId: student.id, marks: exam.maxMarks }],
  });
  assert.throws(() => completeExam(y, exam.id));
  const locked = structuredClone(y);
  locked.records.exams[0].status = "completed";
  assert.throws(() =>
    saveMarks(locked, {
      ...request,
      entries: [{ studentId: student.id, marks: 10 }],
    }),
  );
  const slot = y.records.slots[0];
  assert.throws(() => putRecord(y, "slots", { ...slot, id: "clash-test" }));
});
test("notices target eligible linked guardians and scheduler runs once per interval", () => {
  let y = year();
  const notice = y.records.notices[0];
  y = putRecord(y, "notices", {
    ...notice,
    status: "draft",
    audience: "guardians",
    recipientIds: [],
    acknowledgedIds: [],
  });
  y = publishNotice(y, notice.id);
  assert.equal(
    y.records.notices[0].recipientIds.length,
    y.setup.guardians.length,
  );
  y = putRecord(y, "reportSchedules", {
    ...scope(y),
    id: "schedule-test",
    report: "students",
    frequency: "daily",
    nextRun: y.setup.calendar.year.startDate,
    enabled: true,
    recipientIds: [y.setup.staff[0].id],
    lastRun: null,
  });
  y = runScheduledJobs(y, y.setup.calendar.year.startDate);
  assert.equal(y.records.exports.length, 1);
  assert.equal(
    runScheduledJobs(y, y.setup.calendar.year.startDate).records.exports.length,
    1,
  );
  for (const report of reportKeys)
    assert.ok(Array.isArray(reportRows(y, report)));
  assert.match(csvExport([{ name: "=SUM(A1)", note: 'a,"b"' }]), /'=SUM/);
});
test("calendar imports are atomic, preserve timed events and deduplicate UIDs", () => {
  const y = year(),
    date = y.setup.calendar.year.startDate.replaceAll("-", "");
  const text = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:external-test\r\nDTSTART:${date}T090000\r\nDTEND:${date}T100000\r\nSUMMARY:Demo event\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const next = importCalendar(y, text);
  assert.equal(next.records.events.length, y.records.events.length + 1);
  assert.equal(
    importCalendar(next, text).records.events.length,
    next.records.events.length,
  );
  assert.match(calendarIcs(next), /T090000/);
  assert.throws(() => importCalendar(y, text.replace("090000", "110000")));
  assert.throws(() => importCalendar(y, "not a calendar"));
});
test("year rollover retains history, scopes the new year, carries balances and blocks repeats", () => {
  const root = createWorkspace(),
    y = root.years[0];
  assert.ok(rolloverBlockers(root).length);
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
  y.setup.portal.acknowledgeSimulation = true;
  y.setup.portal.invitationsPrepared = true;
  y.records.leaves = [];
  y.records.approvals = [];
  y.records.exams = y.records.exams.map((e) => ({ ...e, status: "completed" }));
  y.records.promotions = y.setup.students.map((s) => ({
    ...scope(y),
    id: "promotion-" + s.id,
    studentId: s.id,
    targetClassId: s.classSectionId,
    decision: "retain",
    note: "Reviewed retention",
  }));
  assert.equal(rolloverBlockers(root).length, 0);
  schoolYearWorkspaceSchema.parse(y);
  const result = rolloverYear(root, {
    name: "2027–28",
    startDate: "2027-04-01",
    endDate: "2028-03-31",
    acknowledged: true,
  });
  assert.equal(result.years.length, 2);
  assert.equal(result.years[0].locked, true);
  assert.deepEqual(result.years[0].records, y.records);
  assert.equal(result.years[1].records.attendance.length, 0);
  assert.equal(
    result.years[1].records.invoices.length,
    y.records.invoices.length,
  );
  assert.equal(root.years.length, 1);
  result.activeYearId = y.setup.calendar.year.id;
  assert.throws(() =>
    rolloverYear(result, {
      name: "2028–29",
      startDate: "2028-04-01",
      endDate: "2029-03-31",
      acknowledged: true,
    }),
  );
});

test("marks CSV import validates all rows atomically and refuses duplicates or locked exams", async () => {
  const { importMarksCsv } = await import(
    "../src/features/exams/domain/import-marks.ts"
  );
  const y = year(),
    exam = y.records.exams[0],
    student = y.setup.students.find((s) =>
      exam.classSectionIds.includes(s.classSectionId),
    )!,
    subject = y.records.subjects.find((s) => s.id === exam.subjectIds[0])!;
  const csv = `admissionNumber,subjectCode,marks\n${student.admissionNumber},${subject.code},42`;
  const next = importMarksCsv(y, exam.id, csv);
  assert.equal(
    next.records.marks.find(
      (m) =>
        m.examId === exam.id &&
        m.studentId === student.id &&
        m.subjectId === subject.id,
    )?.marks,
    42,
  );
  assert.throws(() =>
    importMarksCsv(y, exam.id, csv + "\n" + csv.split("\n")[1]),
  );
  assert.throws(() => importMarksCsv(y, exam.id, csv + "\nforeign,foreign,20"));
  assert.notDeepEqual(y.records.marks, next.records.marks);
  const locked = structuredClone(y);
  locked.records.exams[0].status = "completed";
  assert.throws(() => importMarksCsv(locked, exam.id, csv));
});
