import test from "node:test";
import assert from "node:assert/strict";
import {
  institutionCreateSchema,
  platformCommandSchema,
  supportCreateSchema,
  accountCreateSchema,
} from "../src/features/admin/schemas/platform.schema.ts";
import { provisionWorkspace } from "../src/features/admin/domain/provision-workspace.ts";
import {
  assertPlatformOperator,
  assertTicketTransition,
  manualEmailHref,
} from "../src/features/admin/domain/policy.ts";
import { completeSetupStep } from "../src/features/school-setup/domain/setup-workflow.ts";
import { canAccess } from "../src/features/identity/domain/access.ts";
const request = {
  requestId: "32076837-f1da-4d1f-a1f8-486806a0e104",
  institutionType: "school",
  school: {
    name: "New Institution",
    shortName: "New",
    curriculum: "CBSE",
    address: {
      line1: "Campus Road",
      city: "Kochi",
      region: "Kerala",
      postalCode: "682001",
      countryCode: "IN",
    },
    email: "office@new.example",
    phone: "+919876543210",
    timezone: "Asia/Kolkata",
    locale: "en-IN",
    currency: "INR",
  },
  year: { name: "2026–27", startDate: "2026-04-01", endDate: "2027-03-31" },
  administratorName: "New Administrator",
  administratorEmail: "admin@new.example",
  temporaryPassword: "NewPassword123!",
};
test("new institution workspace contains actual registration and administrator, with no fixture transactions or students", () => {
  const root = provisionWorkspace(request, "school-new"),
    year = root.years[0];
  assert.equal(root.revision, 0);
  assert.equal(year.setup.school.id, "school-new");
  assert.equal(year.setup.school.name, "New Institution");
  assert.equal(year.setup.staff.length, 1);
  assert.equal(year.setup.staff[0].displayName, "New Administrator");
  assert.deepEqual(year.setup.students, []);
  assert.deepEqual(year.setup.completed, []);
  assert.deepEqual(year.extensions, []);
  for (const [key, records] of Object.entries(year.records))
    if (key !== "preferences") assert.deepEqual(records, [], key);
  assert.deepEqual(year.workflows.ledger, []);
  assert.deepEqual(year.workflows.publications, []);
  const first = completeSetupStep(year.setup, "school-profile", year.setup);
  assert.deepEqual(first.completed, ["school-profile"]);
  assert.throws(
    () => completeSetupStep(first, "academic-terms", first),
    /term/i,
  );
  const terms = {
    ...first,
    calendar: {
      ...first.calendar,
      terms: [
        {
          id: "term-one",
          schoolId: "school-new",
          academicYearId: root.activeYearId,
          name: "Term 1",
          startDate: "2026-04-01",
          endDate: "2027-03-31",
        },
      ],
    },
  };
  const second = completeSetupStep(first, "academic-terms", terms);
  assert.equal(second.completed.length, 2);
  assert.throws(
    () => completeSetupStep(second, "classes-sections", second),
    /record/i,
  );
});
test("registration contracts reject weak credentials, foreign fields and invalid academic ranges", () => {
  for (const password of [
    "short",
    "aaaaaaaaaaaaa",
    "NoNumberHere!",
    "NoSymbols1234",
  ]) {
    assert.equal(
      institutionCreateSchema.safeParse({
        ...request,
        temporaryPassword: password,
      }).success,
      false,
    );
  }
  assert.equal(
    institutionCreateSchema.safeParse({ ...request, role: "platform" }).success,
    false,
  );
  assert.equal(
    institutionCreateSchema.safeParse({
      ...request,
      year: { ...request.year, endDate: "2025-01-01" },
    }).success,
    false,
  );
  assert.equal(
    institutionCreateSchema.safeParse({
      ...request,
      year: { ...request.year, endDate: "2030-01-01" },
    }).success,
    false,
  );
  const account = {
    requestId: request.requestId,
    schoolId: "school-new",
    email: "a@new.example",
    name: "New User",
    role: "staff",
    personId: null,
    temporaryPassword: request.temporaryPassword,
  };
  assert.ok(accountCreateSchema.safeParse(account).success);
  for (const role of ["platform", "group"])
    assert.equal(
      accountCreateSchema.safeParse({ ...account, role }).success,
      false,
    );
  assert.equal(
    platformCommandSchema.safeParse({
      type: "account-update",
      schoolId: "school-new",
      userId: request.requestId,
      role: "platform",
      active: true,
    }).success,
    false,
  );
});
test("platform routes are unavailable to school roles; every school role has support", () => {
  assert.throws(() => assertPlatformOperator(false));
  assertPlatformOperator(true);
  for (const role of [
    "admin",
    "teacher",
    "staff",
    "parent",
    "student",
  ] as const) {
    assert.equal(canAccess(role, "/platform"), false);
    assert.equal(canAccess(role, "/support"), true);
  }
  assert.equal(canAccess("platform", "/platform/institutions"), true);
  assert.equal(canAccess("platform", "/dashboard"), false);
});
test("support validates bounded content and rejects forged ownership", () => {
  const support = {
    requestId: request.requestId,
    subject: "Cannot open a report",
    description: "The report download did not complete.",
    replyEmail: "recipient@new.example",
    category: "technical",
  };
  assert.ok(supportCreateSchema.safeParse(support).success);
  for (const extra of [
    { schoolId: "foreign" },
    { requesterId: request.requestId },
    { status: "resolved" },
  ])
    assert.equal(
      supportCreateSchema.safeParse({ ...support, ...extra }).success,
      false,
    );
  assert.equal(
    supportCreateSchema.safeParse({ ...support, description: "a".repeat(4001) })
      .success,
    false,
  );
  assert.equal(
    supportCreateSchema.safeParse({
      ...support,
      replyEmail: "a@example.com\r\nBcc:evil@example.com",
    }).success,
    false,
  );
  assertTicketTransition("open", "in-progress");
  assertTicketTransition("in-progress", "resolved");
  assertTicketTransition("resolved", "closed");
  assertTicketTransition("closed", "open");
  assert.throws(() => assertTicketTransition("open", "closed"));
  const href = manualEmailHref(
    "a@example.com",
    "Issue & bcc=evil@example.com",
    "id",
  );
  assert.ok(href.startsWith("mailto:a%40example.com?subject="));
  assert.equal(new URL(href).searchParams.size, 1);
});
test("provisioning preserves the institution timezone in operational defaults", () => {
  const root = provisionWorkspace(
    { ...request, school: { ...request.school, timezone: "Asia/Dubai" } },
    "school-timezone",
  );
  assert.equal(root.years[0].workflows.advanced.timezone, "Asia/Dubai");
});
