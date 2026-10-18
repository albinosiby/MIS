import { decideLeave } from "../src/features/workspace/domain/operations.ts";
import { appendAudit } from "../src/features/school-setup/domain/setup-workflow.ts";
import { repairFixtureLinks } from "../src/features/operations/data/repair-fixture-links.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { schoolYearWorkspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import { createOperationsSeed } from "../src/features/operations/data/operations-seed.ts";
import {
  saveOperation,
  scopedStudentIds,
  visibleOperations,
  respondOperation,
  renewLoan,
} from "../src/features/operations/domain/operations.ts";
import {
  testAccounts,
  TEST_ACCOUNT_PASSWORD,
} from "../src/features/identity/data/test-accounts.ts";
import {
  canAccess,
  safeReturnPath,
} from "../src/features/identity/domain/access.ts";
import { accountStore } from "../src/features/identity/domain/account-store.ts";
import {
  createTeacherWork,
  submitTeacherLesson,
  requestPortalLeave,
  submitPortalHomework,
  savePortalAttendance,
  gradePortalSubmission,
} from "../src/features/portals/domain/portal-operations.ts";
const actor = (role: string) => testAccounts.find((a) => a.role === role)!;
function fixture() {
  const y = createWorkspace().years[0];
  return schoolYearWorkspaceSchema.parse({
    ...y,
    extensions: createOperationsSeed(y),
  });
}
test("expanded sample collections validate, preserve references and round-trip with the workspace", () => {
  const y = fixture();
  assert.ok(y.extensions.length > 70);
  assert.deepEqual(
    schoolYearWorkspaceSchema.parse(JSON.parse(JSON.stringify(y))),
    y,
  );
  assert.throws(() =>
    schoolYearWorkspaceSchema.parse({
      ...y,
      extensions: y.extensions.map((r, i) =>
        i ? r : { ...r, schoolId: "foreign" },
      ),
    }),
  );
});
test("role entry never grants administrative or unrelated portal access", () => {
  assert.equal(canAccess("parent", "/dashboard"), false);
  assert.equal(canAccess("teacher", "/fees"), false);
  assert.equal(canAccess("student", "/parent/fees"), false);
  assert.equal(canAccess("accountant", "/fees/refunds"), true);
  assert.equal(canAccess("librarian", "/health/clinic"), false);
  assert.equal(canAccess("admin", "/platform"), false);
  assert.equal(safeReturnPath("//evil.example"), "/dashboard");
  assert.equal(safeReturnPath("/\\evil"), "/dashboard");
});
test("guardian view rights and teacher assignments determine linked student scope", () => {
  const y = fixture();
  assert.deepEqual(scopedStudentIds(y, actor("parent")), ["student-1"]);
  assert.equal(scopedStudentIds(y, actor("teacher")).length, 10);
  const copy = structuredClone(y);
  copy.setup.relationships[0].canViewRecords = false;
  assert.deepEqual(scopedStudentIds(copy, actor("parent")), []);
  assert.deepEqual(
    scopedStudentIds(y, { ...actor("parent"), schoolId: "another-school" }),
    [],
  );
});
test("parent cannot approve own school requests, change another child or access restricted records", () => {
  let y = fixture();
  const base = y.extensions.find((r) => r.kind === "document-requests")!;
  const request = {
    ...base,
    id: "parent-request",
    createdBy: actor("parent").id,
    status: "requested",
  };
  y = saveOperation(y, actor("parent"), request);
  assert.throws(() =>
    saveOperation(y, actor("parent"), { ...request, status: "approved" }),
  );
  assert.throws(() =>
    saveOperation(y, actor("parent"), {
      ...request,
      id: "other-child",
      studentId: "student-2",
    }),
  );
  assert.deepEqual(visibleOperations(y, actor("parent"), "clinic"), []);
});
test("library copies cannot be issued twice and returned copies become issuable again", () => {
  let y = fixture();
  const loan = y.extensions.find((r) => r.kind === "loans")!;
  assert.throws(() =>
    schoolYearWorkspaceSchema.parse({
      ...y,
      extensions: [...y.extensions, { ...loan, id: "duplicate-loan" }],
    }),
  );
  y = saveOperation(y, actor("admin"), { ...loan, status: "returned" });
  y = schoolYearWorkspaceSchema.parse({
    ...y,
    extensions: [...y.extensions, { ...loan, id: "next-loan" }],
  });
  assert.equal(
    y.extensions.filter((r) => r.kind === "loans" && r.status === "issued")
      .length,
    1,
  );
});
test("stock cannot become negative and posted records cannot be silently changed", () => {
  let y = fixture();
  const row = y.extensions.find((r) => r.kind === "stock-movements")!;
  assert.throws(() =>
    schoolYearWorkspaceSchema.parse(
      saveOperation(y, actor("admin"), {
        ...row,
        status: "posted",
        values: { ...row.values, direction: "Issue" },
      }),
    ),
  );
  y = schoolYearWorkspaceSchema.parse(
    saveOperation(y, actor("admin"), { ...row, status: "posted" }),
  );
  assert.throws(() =>
    saveOperation(y, actor("admin"), {
      ...y.extensions.find((r) => r.id === row.id)!,
      values: { ...row.values, quantity: 900 },
    }),
  );
});
test("overlapping active hostel bed assignments and duplicate examination seats are rejected", () => {
  let y = fixture();
  const row = y.extensions.find((r) => r.kind === "hostel-allocations")!;
  y = schoolYearWorkspaceSchema.parse(
    saveOperation(y, actor("admin"), { ...row, status: "active" }),
  );
  assert.throws(() =>
    schoolYearWorkspaceSchema.parse({
      ...y,
      extensions: [
        ...y.extensions,
        { ...row, id: "bed-clash", status: "active", studentId: "student-2" },
      ],
    }),
  );
  const seat = y.extensions.find((r) => r.kind === "seating")!;
  assert.throws(() =>
    schoolYearWorkspaceSchema.parse({
      ...y,
      extensions: [
        ...y.extensions,
        { ...seat, id: "seat-clash", studentId: "student-2" },
      ],
    }),
  );
});
test("student submission reaches the assigned teacher and reviewed feedback reaches the same student", () => {
  let y = fixture();
  const source = y.records.homework.find(
    (h) => h.classSectionId === y.setup.students[0].classSectionId,
  )!;
  const h = { ...source, id: "new-submission-homework" };
  y = { ...y, records: { ...y.records, homework: [...y.records.homework, h] } };
  y = submitPortalHomework(y, actor("student"), {
    homeworkId: h.id,
    studentId: "student-1",
    answer: "This is the student answer.",
  });
  const s = y.records.submissions.find(
    (s) => s.homeworkId === h.id && s.studentId === "student-1",
  )!;
  assert.equal(s.status, "submitted");
  assert.throws(() =>
    gradePortalSubmission(
      y,
      { ...actor("teacher"), personId: "staff-14" },
      { submissionId: s.id, score: 5, feedback: "Review" },
    ),
  );
  y = gradePortalSubmission(
    y,
    { ...actor("teacher"), personId: h.staffId },
    { submissionId: s.id, score: 5, feedback: "Good progress." },
  );
  assert.equal(
    y.records.submissions.find((x) => x.id === s.id)?.feedback,
    "Good progress.",
  );
  assert.throws(() =>
    submitPortalHomework(y, actor("student"), {
      homeworkId: h.id,
      studentId: "student-2",
      answer: "An unauthorised submission",
    }),
  );
});
test("portal leave and teacher registers reject unrelated people and preserve approved leave", () => {
  let y = fixture();
  const date = y.setup.calendar.year.startDate;
  assert.throws(() =>
    requestPortalLeave(y, actor("parent"), {
      personId: "student-2",
      startDate: date,
      endDate: date,
      reason: "Family appointment.",
    }),
  );
  assert.throws(() =>
    savePortalAttendance(y, actor("teacher"), {
      classSectionId: "class-2-a",
      date,
      entries: [{ studentId: "student-11", status: "present" }],
    }),
  );
  y = requestPortalLeave(y, actor("parent"), {
    personId: "student-1",
    startDate: date,
    endDate: date,
    reason: "Family appointment.",
  });
  assert.equal(y.records.leaves.at(-1)?.personId, "student-1");
});
test("local identity passwords are hashed; recovery is one-use, sessions are revoked and final admin is protected", () => {
  const folder = mkdtempSync(join(tmpdir(), "mis-identities-"));
  const store = accountStore(join(folder, "identity.sqlite"));
  try {
    assert.ok(store.authenticate("parent@greenfield.test", TEST_ACCOUNT_PASSWORD));
    assert.equal(
      store.authenticate("parent@greenfield.test", "incorrect"),
      null,
    );
    const token = store.recover("parent@greenfield.test")!;
    const changed = store.finish(token, "recovery", "NewDemoPassword123!");
    assert.equal(changed.version, 1);
    assert.equal(
      store.authenticate("parent@greenfield.test", TEST_ACCOUNT_PASSWORD),
      null,
    );
    assert.ok(
      store.authenticate("parent@greenfield.test", "NewDemoPassword123!"),
    );
    assert.throws(() => store.finish(token, "recovery", "AnotherPassword123!"));
    assert.throws(() => store.setActive("demo-admin", false));
    const invite = store.invite({
      id: "invited-teacher",
      email: "invited@school.example",
      name: "Invited Teacher",
      role: "teacher",
      schoolId: "school-greenfield",
      personId: null,
    });
    assert.equal(
      store.authenticate("invited@school.example", "InvitedPassword123!"),
      null,
    );
    store.finish(invite, "invitation", "InvitedPassword123!");
    assert.ok(
      store.authenticate("invited@school.example", "InvitedPassword123!"),
    );
    store.setActive("invited-teacher", false);
    assert.equal(
      store.authenticate("invited@school.example", "InvitedPassword123!"),
      null,
    );
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("family booking and consent preserve school-authored fields and reject unrelated requests", () => {
  let y = fixture();
  const meeting = y.extensions.find((r) => r.kind === "ptm")!;
  y = respondOperation(y, actor("parent"), meeting.id, { response: "" });
  assert.equal(y.extensions.find((r) => r.id === meeting.id)?.status, "booked");
  assert.deepEqual(
    y.extensions.find((r) => r.id === meeting.id)?.values,
    meeting.values,
  );
  assert.throws(() =>
    respondOperation(y, actor("parent"), meeting.id, { response: "" }),
  );
  const consent = y.extensions.find((r) => r.kind === "consents")!;
  y = respondOperation(y, actor("parent"), consent.id, { response: "Granted" });
  assert.equal(
    y.extensions.find((r) => r.id === consent.id)?.values.response,
    "Granted",
  );
  assert.throws(() =>
    respondOperation(
      y,
      { ...actor("parent"), personId: "guardian-2" },
      consent.id,
      { response: "Declined" },
    ),
  );
});
test("quiz projections hide unpublished content and expected answers; students cannot grade themselves", () => {
  let y = fixture();
  const quiz = y.extensions.find((r) => r.kind === "quizzes")!;
  const visible = visibleOperations(y, actor("student"), "quizzes");
  assert.equal(visible.length, 1);
  assert.notEqual(visible[0].values.answer, quiz.values.answer);
  const draft = {
    ...y,
    extensions: y.extensions.map((r) =>
      r.id === quiz.id ? { ...r, status: "draft" } : r,
    ),
  };
  assert.equal(visibleOperations(draft, actor("student"), "quizzes").length, 0);
  const attempt = y.extensions.find((r) => r.kind === "quiz-attempts")!;
  assert.throws(() =>
    saveOperation(y, actor("student"), {
      ...attempt,
      id: "self-graded",
      createdBy: actor("student").id,
      values: { ...attempt.values, score: 100 },
    }),
  );
});
test("loan renewal must extend the date and retain the same borrower and copy", () => {
  const y = fixture();
  const loan = y.extensions.find((r) => r.kind === "loans")!;
  assert.throws(() => renewLoan(y, actor("parent"), loan.id, "2026-12-01"));
  assert.throws(() =>
    renewLoan(y, actor("librarian"), loan.id, String(loan.values.dueDate)),
  );
  const next = renewLoan(y, actor("librarian"), loan.id, "2026-12-01");
  assert.equal(
    next.extensions.find((r) => r.id === loan.id)?.studentId,
    loan.studentId,
  );
  assert.equal(
    next.extensions.find((r) => r.id === loan.id)?.values.copyId,
    loan.values.copyId,
  );
  assert.equal(
    next.extensions.find((r) => r.id === loan.id)?.values.dueDate,
    "2026-12-01",
  );
});

test("sample payment attempts follow the referenced invoice owner, regardless of ledger ordering", () => {
  const y = createWorkspace().years[0];
  y.records.invoices.reverse();
  const next = schoolYearWorkspaceSchema.parse({
    ...y,
    extensions: createOperationsSeed(y),
  });
  const attempt = next.extensions.find((r) => r.kind === "payment-attempts")!;
  assert.equal(
    attempt.studentId,
    next.records.invoices.find((i) => i.id === attempt.values.invoiceId)
      ?.studentId,
  );
});
test("legacy repair fixes only an untouched generated fixture and never rewrites user-authored attempts", () => {
  const root = createWorkspace();
  const row = root.years[0].extensions.find(
    (r) => r.kind === "payment-attempts",
  )!;
  row.values.invoiceId = root.years[0].records.invoices[1].id;
  assert.throws(() => schoolYearWorkspaceSchema.parse(root.years[0]));
  const repaired = repairFixtureLinks(root);
  assert.equal(repaired.changed, true);
  assert.equal(
    schoolYearWorkspaceSchema
      .parse((repaired.value as typeof root).years[0])
      .extensions.find((r) => r.id === row.id)?.studentId,
    "student-2",
  );
  row.history.push({
    at: new Date().toISOString(),
    actorId: "demo-admin",
    action: "Edited by user",
  });
  assert.equal(repairFixtureLinks(root).changed, false);
});

test("audit provenance distinguishes family accounts from the school principal and preserves old entries as unknown", () => {
  const y = fixture();
  const setup = appendAudit(y.setup, "Parent: submit leave", {
    accountId: "demo-parent",
    displayName: "Demo Guardian",
    role: "parent",
  });
  assert.equal(setup.audit.at(-1)?.actor?.accountId, "demo-parent");
  assert.equal(setup.audit.at(-1)?.actor?.role, "parent");
  const legacy = {
    ...setup,
    audit: [
      {
        id: "legacy-event",
        at: new Date().toISOString(),
        action: "Older event",
      },
    ],
  };
  assert.equal(
    schoolYearWorkspaceSchema.parse({ ...y, setup: legacy }).setup.audit[0]
      .actor,
    null,
  );
});

test("staff expense submission requires their own person and only school reviewers can approve or alter it", () => {
  let y = fixture();
  const base = y.extensions.find((r) => r.kind === "expenses")!;
  const claim = {
    ...base,
    id: "staff-claim-audit",
    staffId: actor("staff").personId,
    status: "draft",
    createdBy: actor("staff").id,
  };
  assert.throws(() =>
    saveOperation(y, actor("staff"), { ...claim, staffId: "staff-1" }),
  );
  y = saveOperation(y, actor("staff"), claim);
  y = saveOperation(y, actor("staff"), { ...claim, status: "submitted" });
  const submitted = y.extensions.find((r) => r.id === claim.id)!;
  assert.throws(() =>
    saveOperation(y, actor("staff"), { ...submitted, status: "approved" }),
  );
  assert.throws(() =>
    saveOperation(y, actor("staff"), {
      ...submitted,
      values: { ...submitted.values, amountMinor: 999999 },
    }),
  );
  y = saveOperation(y, actor("admin"), { ...submitted, status: "approved" });
  assert.equal(
    visibleOperations(y, actor("staff"), "expenses").find(
      (r) => r.id === claim.id,
    )?.status,
    "approved",
  );
});
test("teachers cannot grade pending answers; submitted scores respect maximum and year locks", () => {
  let y = fixture();
  const hw = y.records.homework.find(
    (r) => r.staffId === actor("teacher").personId,
  )!;
  const pending = y.records.submissions.find(
    (r) => r.homeworkId === hw.id && r.status === "pending",
  )!;
  assert.ok(pending);
  assert.throws(
    () =>
      gradePortalSubmission(y, actor("teacher"), {
        submissionId: pending.id,
        score: 2,
        feedback: "",
      }),
    /must submit/,
  );
  y = submitPortalHomework(
    y,
    { ...actor("student"), personId: pending.studentId },
    {
      homeworkId: hw.id,
      studentId: pending.studentId,
      answer: "A complete sample answer.",
    },
  );
  const submitted = y.records.submissions.find(
    (r) => r.homeworkId === hw.id && r.studentId === pending.studentId,
  )!;
  assert.throws(() =>
    gradePortalSubmission(y, actor("teacher"), {
      submissionId: submitted.id,
      score: hw.maxScore + 1,
      feedback: "",
    }),
  );
  assert.throws(() =>
    gradePortalSubmission({ ...y, locked: true }, actor("teacher"), {
      submissionId: submitted.id,
      score: 1,
      feedback: "",
    }),
  );
});
test("attendance saves reject dates outside the year and preserve leave after teacher updates", () => {
  let y = fixture();
  const date = y.setup.calendar.year.startDate;
  y = requestPortalLeave(y, actor("parent"), {
    personId: "student-1",
    startDate: date,
    endDate: date,
    reason: "Family appointment.",
  });
  const leave = y.records.leaves.at(-1)!;
  y = decideLeave(y, leave.id, "approved", "School approved appointment.");
  const input = {
    classSectionId: y.setup.students[0].classSectionId,
    date,
    entries: [{ studentId: "student-1", status: "present" }],
  };
  y = savePortalAttendance(y, actor("teacher"), input);
  assert.equal(
    y.records.attendance.find(
      (r) => r.personId === "student-1" && r.date === date,
    )?.status,
    "excused",
  );
  assert.throws(() =>
    savePortalAttendance(y, actor("teacher"), { ...input, date: "2000-01-01" }),
  );
  assert.throws(() =>
    savePortalAttendance(y, actor("teacher"), {
      ...input,
      entries: [...input.entries, ...input.entries],
    }),
  );
});

test("school-scoped projections never expose non-student records across schools", () => {
  const y = fixture();
  for (const role of ["admin", "teacher", "staff", "parent", "student"]) {
    const foreign = { ...actor(role), schoolId: "another-school" };
    for (const kind of [
      "messages",
      "payroll",
      "resources",
      "books",
      "expenses",
    ])
      assert.deepEqual(visibleOperations(y, foreign, kind), []);
  }
});

test("teacher lesson creation checks subject allocation, workflow, school and current year", () => {
  let y = fixture();
  const source = y.records.lessons.find(
    (l) => l.staffId === actor("teacher").personId,
  )!;
  const row = { ...source, id: "teacher-lesson-boundary", status: "draft" };
  y = createTeacherWork(y, actor("teacher"), "lessons", row);
  assert.throws(() =>
    createTeacherWork(y, actor("teacher"), "lessons", {
      ...row,
      id: "duplicate-status",
      status: "approved",
    }),
  );
  assert.throws(() =>
    createTeacherWork(y, actor("teacher"), "lessons", {
      ...row,
      id: "foreign-year",
      academicYearId: "foreign-year",
    }),
  );
  const unit = y.records.units.find((u) => u.id === row.unitId)!;
  const unassigned = {
    ...unit,
    id: "unassigned-unit",
    subjectId: y.records.subjects.find((s) => s.id !== unit.subjectId)!.id,
  };
  const other = {
    ...y,
    records: { ...y.records, units: [...y.records.units, unassigned] },
  };
  assert.throws(() =>
    createTeacherWork(other, actor("teacher"), "lessons", {
      ...row,
      id: "wrong-subject",
      unitId: unassigned.id,
    }),
  );
  assert.throws(() =>
    submitTeacherLesson(
      y,
      { ...actor("teacher"), personId: "staff-2" },
      row.id,
    ),
  );
  y = submitTeacherLesson(y, actor("teacher"), row.id);
  assert.equal(
    y.records.lessons.find((l) => l.id === row.id)?.status,
    "submitted",
  );
  assert.throws(() => submitTeacherLesson(y, actor("teacher"), row.id));
  assert.throws(() =>
    submitTeacherLesson({ ...y, locked: true }, actor("teacher"), row.id),
  );
});
