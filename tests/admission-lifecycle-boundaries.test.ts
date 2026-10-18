import { canAccessDocument } from "../src/features/documents/domain/document-access.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { saveInquiry } from "../src/features/admissions/domain/save-inquiry.ts";
import {
  progressInquiry,
  enrolStudent,
} from "../src/features/workspace/domain/operations.ts";
import { applyCloudCommand } from "../src/features/cloud/domain/commands.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";

test("admission edits cannot jump stages or rewrite an enrolled application", () => {
  let year = createWorkspace().years[0];
  const row = {
    ...year.records.inquiries[0],
    id: "application-boundary",
    stage: "new" as const,
    studentId: null,
  };
  year = saveInquiry(year, row);
  assert.throws(
    () => saveInquiry(year, { ...row, stage: "offered" }),
    /progression/,
  );
  assert.throws(
    () =>
      saveInquiry(year, {
        ...row,
        id: "forged-new",
        stage: "enrolled",
        studentId: year.setup.students[0].id,
      }),
    /New applications/,
  );
  assert.throws(
    () => saveInquiry(year, { ...row, schoolId: "foreign-school" }),
    /outside/,
  );
  for (const stage of ["contacted", "application", "assessment"])
    year = progressInquiry(year, row.id, stage);
  assert.throws(() => progressInquiry(year, row.id, "offered"), /score/);
  year = saveInquiry(year, {
    ...year.records.inquiries.find((r) => r.id === row.id)!,
    score: 80,
  });
  assert.equal(
    progressInquiry(year, row.id, "offered").records.inquiries.find(
      (r) => r.id === row.id,
    )!.stage,
    "offered",
  );
});
test("only school admissions administrators can operate applications", () => {
  const root = createWorkspace(),
    input = {
      ...root.years[0].records.inquiries[0],
      id: "permission-application",
      stage: "new",
      studentId: null,
    };
  for (const account of testAccounts.filter((a) =>
    ["teacher", "parent", "student", "staff"].includes(a.role),
  ))
    assert.throws(
      () =>
        applyCloudCommand(root, account, {
          expectedRevision: root.revision,
          yearId: root.activeYearId,
          command: { type: "admission-save", input },
        }),
      /administrator/,
    );
});
test("enrolment requires a valid offer and generates dated fees exactly once", () => {
  let year = createWorkspace().years[0];
  const inquiry = {
    ...year.records.inquiries[0],
    id: "offered-application",
    stage: "offered" as const,
    studentId: null,
    score: 90,
    offerExpiry: year.setup.calendar.year.endDate,
  };
  year.records.inquiries.push(inquiry);
  const profile = year.records.studentProfiles[0],
    guardian = year.setup.guardians[0];
  const request = {
    studentName: "Verified applicant",
    admissionNumber: "VERIFIED-APPLICATION",
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    classSectionId: inquiry.classSectionId,
    address: profile.address,
    guardianName: guardian.displayName,
    email: guardian.email,
    phone: guardian.phone,
    existingGuardianId: guardian.id,
    emergencyName: profile.emergencyName,
    emergencyPhone: profile.emergencyPhone,
    routeId: null,
    documents: [],
    generateInvoice: true,
    inquiryId: inquiry.id,
  };
  year.records.admissionForms[0].applicationFeeMinor = 50000;
  const result = enrolStudent(year, request),
    saved = result.records.inquiries.find((r) => r.id === inquiry.id)!;
  assert.equal(saved.stage, "enrolled");
  assert.ok(saved.studentId);
  assert.equal(result.setup.students.length, year.setup.students.length + 1);
  const invoice = result.records.invoices.find(
    (i) => i.studentId === saved.studentId,
  )!;
  assert.ok(
    invoice.lines.some(
      (l) => l.id === "application-fee" && l.amountMinor === 50000,
    ),
  );
  assert.ok(invoice.dueDate >= invoice.issuedOn);
  assert.throws(() => enrolStudent(result, request), /eligible/);
  assert.throws(
    () => saveInquiry(result, { ...saved, studentName: "Rewritten" }),
    /immutable/,
  );
  const expired = structuredClone(year);
  expired.records.inquiries.find((r) => r.id === inquiry.id)!.offerExpiry =
    "2026-04-01";
  assert.throws(() => enrolStudent(expired, request), /expired/);
  const pending = structuredClone(year);
  pending.records.inquiries.find((r) => r.id === inquiry.id)!.stage =
    "assessment";
  assert.throws(() => enrolStudent(pending, request), /eligible/);
});

test("application files stay private and historical reads use current custody", () => {
  const year = createWorkspace().years[0],
    parent = testAccounts.find((a) => a.role === "parent")!,
    admin = testAccounts.find((a) => a.role === "admin")!,
    teacher = testAccounts.find((a) => a.role === "teacher")!,
    studentId = year.setup.relationships.find(
      (link) => link.guardianId === parent.personId,
    )!.studentId;
  const application = {
    ...year.records.inquiries[0],
    id: "private-application",
    stage: "offered" as const,
    studentId: null as string | null,
  };
  year.records.inquiries.push(application);
  const scope = {
    yearId: year.setup.calendar.year.id,
    ownerType: "admission" as const,
    ownerId: application.id,
    category: "identity" as const,
    replacesId: null,
  };
  assert.equal(canAccessDocument(year, admin, scope, true), true);
  assert.equal(canAccessDocument(year, teacher, scope), false);
  assert.equal(canAccessDocument(year, parent, scope), false);
  year.records.inquiries = year.records.inquiries.map((row) =>
    row.id === application.id ? { ...row, stage: "enrolled", studentId } : row,
  );
  assert.equal(canAccessDocument(year, parent, scope), true);
  assert.equal(canAccessDocument(year, parent, scope, true), false);
  assert.equal(
    canAccessDocument(year, parent, { ...scope, category: "general" }),
    false,
  );
  const current = structuredClone(year);
  current.setup.relationships = current.setup.relationships.map((link) => ({
    ...link,
    canViewRecords: false,
  }));
  assert.equal(canAccessDocument(year, parent, scope, false, current), false);
  assert.equal(
    canAccessDocument(
      year,
      parent,
      { ...scope, ownerType: "student", ownerId: studentId },
      false,
      current,
    ),
    false,
  );
  assert.equal(
    canAccessDocument(year, admin, {
      ...scope,
      ownerId: "foreign-application",
    }),
    false,
  );
});
