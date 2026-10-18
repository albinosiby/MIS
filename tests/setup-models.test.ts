import assert from "node:assert/strict";
import { test } from "node:test";
import { academicCalendarSchema } from "../src/shared/schemas/academics.ts";
import {
  localDateSchema,
  nonnegativeMoneySchema,
  timezoneSchema,
} from "../src/shared/schemas/primitives.ts";
import { schoolProfileSchema } from "../src/shared/schemas/school.ts";
import {
  batchNotificationSchema,
  exceptionQuerySchema,
  exceptionReviewSchema,
  setupPhaseIds,
  setupPipelineSchema,
  setupSummarySchema,
  setupWizardSnapshotSchema,
} from "../src/features/school-setup/schemas/setup-wizard.schema.ts";
import { reviewException } from "../src/features/school-setup/domain/review-exception.ts";
import type { ExceptionRecord } from "../src/features/school-setup/models/index.ts";

const context = { schoolId: "school-a", academicYearId: "year-a" };
const row: ExceptionRecord = {
  id: "record-a",
  ...context,
  name: "Sample Student",
  guardian: "Sample Guardian",
  grade: "V-A",
  status: "UID Pending",
  tone: "warning",
  discrepancy: "Sample identity document needs review",
  action: "Review",
  category: "uid",
};
const year = {
  id: context.academicYearId,
  schoolId: context.schoolId,
  name: "2026–27",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
};
const term = {
  id: "term-a",
  ...context,
  name: "Term 1",
  startDate: "2026-04-01",
  endDate: "2026-10-31",
};
const phases = setupPhaseIds.map((id, index) => ({
  id,
  title: id,
  description: "Sample phase",
  status: index < 6 ? "completed" : index === 6 ? "in_progress" : "locked",
}));
const summary = {
  pipelineVelocityPercent: 87,
  velocityChangePerHour: 14,
  validatedStudents: 1248,
  totalStudents: 1480,
  deadlineDays: 18,
  targetTermStart: "2026-06-01",
  completionPercent: 72,
  pendingApprovals: 12,
  upcomingEvents: 3,
};
const snapshot = {
  ...context,
  batchId: "batch-a",
  phases,
  summary,
  exceptions: [row],
  compliance: [],
  authority: {
    staff: {
      id: "staff-a",
      schoolId: context.schoolId,
      displayName: "Sample Principal",
      designation: "Principal",
    },
    tokenStatus: "unavailable",
    tokenSerial: "preview-only",
    fingerprintDisplay: "not-connected",
    ledgerCount: 0,
    rosterCount: 0,
  },
  snapshot: {
    id: "backup-a",
    schoolId: context.schoolId,
    sourceAcademicYearId: "year-previous",
    ageMinutes: 14,
    status: "unavailable",
  },
};

test("dates reject impossible calendar days and preserve valid leap days", () => {
  assert.equal(localDateSchema.safeParse("2026-02-29").success, false);
  assert.equal(localDateSchema.safeParse("2028-02-29").success, true);
});
test("academic calendar rejects reversed years, out-of-year terms and overlap", () => {
  assert.equal(
    academicCalendarSchema.safeParse({ year, terms: [term] }).success,
    true,
  );
  assert.equal(
    academicCalendarSchema.safeParse({
      year: { ...year, endDate: "2026-03-31" },
      terms: [],
    }).success,
    false,
  );
  assert.equal(
    academicCalendarSchema.safeParse({
      year,
      terms: [{ ...term, startDate: "2026-03-01" }],
    }).success,
    false,
  );
  assert.equal(
    academicCalendarSchema.safeParse({
      year,
      terms: [
        term,
        {
          ...term,
          id: "term-b",
          startDate: "2026-10-31",
          endDate: "2027-03-31",
        },
      ],
    }).success,
    false,
  );
});
test("terms cannot cross schools, academic years or reuse an ID", () => {
  for (const patch of [
    { schoolId: "school-b" },
    { academicYearId: "year-b" },
  ]) {
    assert.equal(
      academicCalendarSchema.safeParse({ year, terms: [{ ...term, ...patch }] })
        .success,
      false,
    );
  }
  assert.equal(
    academicCalendarSchema.safeParse({
      year,
      terms: [
        term,
        { ...term, startDate: "2026-11-01", endDate: "2027-03-31" },
      ],
    }).success,
    false,
  );
});
test("school profile validates contact, timezone and required fields without assuming one board", () => {
  const school = {
    id: "school-a",
    name: " Sample School ",
    shortName: "Sample",
    curriculum: "State Board",
    address: {
      line1: "Sample campus",
      city: "Kochi",
      region: "Kerala",
      postalCode: "682001",
      countryCode: "IN",
    },
    email: "office@example.test",
    phone: "+919876543210",
    timezone: "Asia/Kolkata",
    locale: "en-IN",
    currency: "INR",
  };
  assert.equal(schoolProfileSchema.parse(school).name, "Sample School");
  for (const patch of [
    { name: "   " },
    { email: "invalid" },
    { phone: "123" },
    { timezone: "Invalid/Zone" },
    { currency: "rupees" },
    { unexpected: true },
  ])
    assert.equal(
      schoolProfileSchema.safeParse({ ...school, ...patch }).success,
      false,
    );
  assert.equal(timezoneSchema.safeParse("UTC").success, true);
});
test("fee amounts require nonnegative safe integer minor units", () => {
  assert.equal(
    nonnegativeMoneySchema.safeParse({ amountMinor: 1050, currency: "INR" })
      .success,
    true,
  );
  for (const amountMinor of [-1, 10.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(
      nonnegativeMoneySchema.safeParse({ amountMinor, currency: "INR" })
        .success,
      false,
    );
});
test("pipeline enforces prerequisite order and one active phase", () => {
  assert.equal(setupPipelineSchema.safeParse(phases).success, true);
  assert.equal(
    setupPipelineSchema.safeParse(
      phases.map((phase) => ({ ...phase, status: "completed" })),
    ).success,
    true,
  );
  assert.equal(
    setupPipelineSchema.safeParse([...phases].reverse()).success,
    false,
  );
  assert.equal(
    setupPipelineSchema.safeParse(
      phases.map((phase, index) =>
        index === 2 ? { ...phase, status: "in_progress" } : phase,
      ),
    ).success,
    false,
  );
  assert.equal(
    setupPipelineSchema.safeParse(
      phases.map((phase, index) =>
        index === 0 ? { ...phase, status: "locked" } : phase,
      ),
    ).success,
    false,
  );
});
test("summary rejects impossible percentages, negative counts and over-validation", () => {
  for (const patch of [
    { completionPercent: 101 },
    { validatedStudents: 1481 },
    { deadlineDays: -1 },
    { validatedStudents: 1.5 },
  ])
    assert.equal(
      setupSummarySchema.safeParse({ ...summary, ...patch }).success,
      false,
    );
});
test("review trims notes and rejects whitespace, short, oversize and unrecognised input", () => {
  const input = {
    ...context,
    exceptionId: row.id,
    note: "  Verified sample evidence  ",
  };
  assert.equal(
    exceptionReviewSchema.parse(input).note,
    "Verified sample evidence",
  );
  for (const note of ["        ", "short", "x".repeat(501)])
    assert.equal(
      exceptionReviewSchema.safeParse({ ...input, note }).success,
      false,
    );
  assert.equal(
    exceptionReviewSchema.safeParse({ ...input, approvedBy: "forged-admin" })
      .success,
    false,
  );
});
test("review refuses cross-school, cross-year, unknown and already-reviewed records", () => {
  const input = {
    ...context,
    exceptionId: row.id,
    note: "Reviewed sample evidence",
  };
  assert.equal(
    reviewException([row], { ...input, schoolId: "school-b" }, context).success,
    false,
  );
  assert.equal(
    reviewException([row], { ...input, academicYearId: "year-b" }, context)
      .success,
    false,
  );
  assert.equal(
    reviewException([{ ...row, schoolId: "school-b" }], input, context).success,
    false,
  );
  assert.equal(
    reviewException([row], { ...input, exceptionId: "unknown" }, context)
      .success,
    false,
  );
  const result = reviewException([row], input, context);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.records.length, 0);
    assert.equal(
      reviewException(result.records, input, context).success,
      false,
    );
  }
});
test("notification selection requires unique bounded record IDs", () => {
  assert.equal(
    batchNotificationSchema.safeParse({ ...context, exceptionIds: [row.id] })
      .success,
    true,
  );
  for (const exceptionIds of [
    [],
    [row.id, row.id],
    Array.from({ length: 101 }, (_, i) => `record-${i}`),
  ])
    assert.equal(
      batchNotificationSchema.safeParse({ ...context, exceptionIds }).success,
      false,
    );
});
test("query validation supplies defaults and rejects invalid pagination", () => {
  assert.equal(exceptionQuerySchema.parse({}).pageSize, 6);
  for (const patch of [
    { page: 0 },
    { page: 1.5 },
    { pageSize: 101 },
    { category: "unknown" },
    { search: "x".repeat(201) },
  ])
    assert.equal(exceptionQuerySchema.safeParse(patch).success, false);
});
test("wizard snapshot validates ownership and duplicate exception IDs", () => {
  assert.equal(setupWizardSnapshotSchema.safeParse(snapshot).success, true);
  assert.equal(
    setupWizardSnapshotSchema.safeParse({ ...snapshot, exceptions: [row, row] })
      .success,
    false,
  );
  assert.equal(
    setupWizardSnapshotSchema.safeParse({
      ...snapshot,
      exceptions: [{ ...row, schoolId: "school-b" }],
    }).success,
    false,
  );
  assert.equal(
    setupWizardSnapshotSchema.safeParse({
      ...snapshot,
      authority: {
        ...snapshot.authority,
        staff: { ...snapshot.authority.staff, schoolId: "school-b" },
      },
    }).success,
    false,
  );
  assert.equal(
    setupWizardSnapshotSchema.safeParse({
      ...snapshot,
      snapshot: { ...snapshot.snapshot, schoolId: "school-b" },
    }).success,
    false,
  );
});
