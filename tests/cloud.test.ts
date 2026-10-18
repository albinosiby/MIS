import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { testAccounts } from "../src/features/identity/data/test-accounts.ts";
import { projectCloudWorkspace } from "../src/features/cloud/domain/projection.ts";
import { applyCloudCommand } from "../src/features/cloud/domain/commands.ts";
const actor = (role: string) => testAccounts.find((x) => x.role === role)!;
test("cloud parent projection withholds other students, HR, health, unpublished marks, admission and audit data", () => {
  const root = createWorkspace();
  const p = projectCloudWorkspace(root, actor("parent"));
  const y = p.years[0];
  assert.deepEqual(
    y.setup.students.map((s) => s.id),
    ["student-1"],
  );
  assert.equal(y.setup.audit.length, 0);
  assert.equal(y.records.inquiries.length, 0);
  assert.equal(y.records.staffProfiles.length, 0);
  assert.equal(
    y.extensions.some((r) =>
      ["clinic", "payroll", "safeguarding"].includes(r.kind),
    ),
    false,
  );
  assert.ok(y.records.invoices.every((i) => i.studentId === "student-1"));
  assert.equal(y.records.marks.length, 0);
  assert.throws(() =>
    projectCloudWorkspace(root, {
      ...actor("parent"),
      schoolId: "another-school",
    }),
  );
});
test("cloud staff projection withholds student demographics and financial accounts", () => {
  const y = projectCloudWorkspace(createWorkspace(), actor("staff")).years[0];
  assert.equal(y.setup.students.length, 0);
  assert.equal(y.records.studentProfiles.length, 0);
  assert.equal(y.records.invoices.length, 0);
  assert.ok(
    y.records.staffProfiles.every((p) => p.staffId === actor("staff").personId),
  );
});
test("cloud commands reject forged ownership, stale writes and archived years; valid leave is audited", () => {
  const root = createWorkspace();
  const yearId = root.activeYearId;
  const date = root.years[0].setup.calendar.year.startDate;
  const command = {
    type: "leave",
    input: {
      personId: "student-1",
      startDate: date,
      endDate: date,
      reason: "Family appointment.",
    },
  };
  const next = applyCloudCommand(root, actor("parent"), {
    expectedRevision: root.revision,
    yearId,
    command,
  });
  assert.equal(next.revision, root.revision + 1);
  assert.equal(next.years[0].records.leaves.at(-1)?.personId, "student-1");
  assert.equal(next.years[0].setup.audit.at(-1)?.actor?.role, "parent");
  assert.throws(() =>
    applyCloudCommand(root, actor("parent"), {
      expectedRevision: root.revision,
      yearId,
      command: {
        ...command,
        input: { ...command.input, personId: "student-2" },
      },
    }),
  );
  assert.throws(() =>
    applyCloudCommand(next, actor("parent"), {
      expectedRevision: root.revision,
      yearId,
      command,
    }),
  );
  assert.throws(() =>
    applyCloudCommand(
      { ...root, years: root.years.map((y) => ({ ...y, locked: true })) },
      actor("parent"),
      { expectedRevision: root.revision, yearId, command },
    ),
  );
});
test("teacher projection contains assigned students and teaching work but no private finances or other staff dossiers", () => {
  const y = projectCloudWorkspace(createWorkspace(), actor("teacher")).years[0];
  assert.equal(y.setup.students.length, 10);
  assert.equal(y.records.invoices.length, 0);
  assert.ok(
    y.records.homework.every((h) => h.staffId === actor("teacher").personId),
  );
  assert.ok(
    y.records.staffProfiles.every(
      (p) => p.staffId === actor("teacher").personId,
    ),
  );
});

test("public projection exposes published content and form configuration without any student or certificate registry", async () => {
  const { projectCloudPublicWorkspace } = await import(
    "../src/features/cloud/domain/public-projection.ts"
  );
  const root = createWorkspace();
  root.years[0].workflows.customValues.push({
    entity: "staff",
    ownerId: root.years[0].setup.staff[0].id,
    values: { private_note: "Hidden personnel content" },
  });
  root.years[0].workflows.salaryPlans.push({
    staffId: root.years[0].setup.staff[0].id,
    basicMinor: 10000,
    grossMinor: 20000,
    effectiveFrom: root.years[0].setup.calendar.year.startDate,
  });
  root.years[0].workflows.publications.push({
    id: "private-publication",
    kind: "payslip",
    sourceId: "private-payroll",
    ownerType: "staff",
    ownerId: root.years[0].setup.staff[0].id,
    version: 1,
    reference: "PRIVATE-PAY",
    title: "Private pay slip",
    issuedBy: "private-actor",
    issuedAt: new Date().toISOString(),
    revokedAt: null,
    revocationReason: "",
    snapshot: { netMinor: 10000 },
  });
  const projection = projectCloudPublicWorkspace(root),
    y = projection.years[0];
  assert.equal(y.workflows.customValues.length, 0);
  assert.equal(y.workflows.salaryPlans.length, 0);
  assert.equal(y.workflows.publications.length, 0);
  assert.ok(!JSON.stringify(projection).includes("Hidden personnel content"));
  assert.ok(!JSON.stringify(projection).includes("PRIVATE-PAY"));
  assert.equal(y.setup.students.length, 0);
  assert.equal(y.setup.staff.length, 0);
  assert.equal(y.setup.guardians.length, 0);
  assert.equal(y.setup.audit.length, 0);
  assert.equal(y.records.certificates.length, 0);
  assert.equal(y.records.inquiries.length, 0);
  assert.equal(y.records.payments.length, 0);
  assert.ok(
    y.extensions.every(
      (r) =>
        ["cms-pages", "cms-news"].includes(r.kind) && r.status === "published",
    ),
  );
  assert.equal(y.records.preferences.principalBio, "");
  assert.ok(y.records.admissionForms.length > 0);
});

test("public intake cannot forge ownership or enrolment decisions; validates contact and configured sibling requirements", async () => {
  const { preparePublicInquiry } = await import(
    "../src/features/cloud/domain/public-intake.ts"
  );
  const y = createWorkspace().years[0];
  y.records.admissionForms[0].requireDocuments = false;
  const input = {
    ...y.records.inquiries[0],
    schoolId: "foreign-school",
    academicYearId: "foreign-year",
    stage: "enrolled",
    studentId: "student-2",
    score: 100,
    source: "Walk-in",
  };
  const result = preparePublicInquiry(y, input);
  assert.equal(result.schoolId, y.setup.school.id);
  assert.equal(result.academicYearId, y.setup.calendar.year.id);
  assert.equal(result.stage, "new");
  assert.equal(result.source, "Website");
  assert.equal(result.studentId, null);
  assert.equal(result.score, null);
  assert.notEqual(result.id, input.id);
  assert.throws(() =>
    preparePublicInquiry(y, { ...input, phone: "9876543210" }),
  );
  assert.throws(() => preparePublicInquiry({ ...y, locked: true }, input));
  y.records.admissionForms[0].requireSibling = true;
  assert.throws(() =>
    preparePublicInquiry(y, { ...input, siblingStudentId: "student-1" }),
  );
  assert.equal(
    preparePublicInquiry(y, {
      ...input,
      siblingStudentId: y.setup.students[0].admissionNumber,
    }).siblingStudentId,
    y.setup.students[0].id,
  );
});

test("expected action validation failures preserve useful field errors across the server boundary", async () => {
  const { cloudFailure } = await import(
    "../src/features/cloud/domain/action-result.ts"
  );
  const { inquirySchema } = await import(
    "../src/features/admissions/schemas/admissions.schema.ts"
  );
  const parsed = inquirySchema.safeParse({});
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const result = cloudFailure(parsed.error);
    assert.equal(result.ok, false);
    assert.match(result.error, /studentName/);
    assert.ok(result.error.length <= 1000);
  }
});
