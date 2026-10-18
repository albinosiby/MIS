import test from "node:test";
import assert from "node:assert/strict";
import { createSetupSeed } from "../src/features/school-setup/data/setup-seed.ts";
import {
  completeSetupStep,
  annualFeeMinor,
  setupPhases,
} from "../src/features/school-setup/domain/setup-workflow.ts";
import { setupConfigSchema } from "../src/features/school-setup/schemas/setup-config.schema.ts";
import { setupPhaseIds } from "../src/features/school-setup/schemas/setup-wizard.schema.ts";
import {
  importStudents,
  parseCsv,
  studentCsvHeader,
} from "../src/features/school-setup/domain/import-students.ts";
import { reviewException } from "../src/features/school-setup/domain/review-exception.ts";

const copy = <T>(value: T): T => structuredClone(value);
test("seed shares 100 students, guardians, 15 staff and valid owned references", () => {
  const seed = createSetupSeed();
  assert.equal(seed.students.length, 100);
  assert.equal(seed.staff.length, 15);
  assert.equal(seed.guardians.length, 100);
  assert.equal(seed.completed.length, 6);
  assert.equal(createSetupSeed(true).completed.length, 0);
  assert.ok(
    setupConfigSchema.safeParse(JSON.parse(JSON.stringify(seed))).success,
  );
});
test("all eight steps can complete from fresh, with ingestion sign-off and simulated portal invitations", () => {
  let current = createSetupSeed(true);
  for (const step of setupPhaseIds.slice(0, 6))
    current = completeSetupStep(current, step, current);
  assert.throws(() => completeSetupStep(current, "data-ingestion", current));
  for (const record of [...current.exceptions]) {
    const review = reviewException(
      current.exceptions,
      {
        schoolId: current.school.id,
        academicYearId: current.calendar.year.id,
        exceptionId: record.id,
        note: "Reviewed sample evidence.",
      },
      { schoolId: current.school.id, academicYearId: current.calendar.year.id },
    );
    assert.ok(review.success);
    if (review.success)
      current = {
        ...current,
        exceptions: review.records,
        reviews: [...current.reviews, review.review],
      };
  }
  current = completeSetupStep(current, "data-ingestion", current);
  assert.throws(() => completeSetupStep(current, "portal-gateway", current));
  const draft = copy(current);
  draft.portal.acknowledgeSimulation = true;
  draft.portal.invitationsPrepared = true;
  current = completeSetupStep(current, "portal-gateway", draft);
  assert.equal(current.completed.length, 8);
  assert.equal(current.notifications.length, 1);
  assert.equal(current.notifications[0].recipients.length, 100);
  current = completeSetupStep(current, "portal-gateway", current);
  assert.equal(current.notifications.length, 1);
  assert.ok(setupPhases(current).every((p) => p.status === "completed"));
});
test("prerequisites reject direct jumping and forged completed steps", () => {
  const current = createSetupSeed(true);
  const forged = copy(current);
  forged.completed = [...setupPhaseIds];
  assert.throws(() => completeSetupStep(current, "portal-gateway", forged));
  assert.throws(() => completeSetupStep(current, "classes-sections", current));
});
test("saving unchanged steps preserves sign-offs; changed earlier settings invalidate successors", () => {
  const current = createSetupSeed();
  assert.equal(
    completeSetupStep(current, "school-profile", current).completed.length,
    6,
  );
  const draft = copy(current);
  draft.school.name = "Changed demo school";
  assert.equal(
    completeSetupStep(current, "school-profile", draft).completed.length,
    1,
  );
  const terms = copy(current);
  terms.calendar.terms[0].name = "First semester";
  assert.equal(
    completeSetupStep(current, "academic-terms", terms).completed.length,
    2,
  );
});
test("steps accept only their owned fields and do not replace unrelated module records", () => {
  const current = createSetupSeed();
  const draft = copy(current);
  draft.staff[0].displayName = "Unrelated edit";
  assert.equal(
    completeSetupStep(current, "school-profile", draft).staff[0].displayName,
    current.staff[0].displayName,
  );
});
test("new sections can be added before staff assignments, but cannot sign off allocation without coverage", () => {
  const current = createSetupSeed();
  const draft = copy(current);
  draft.classes.push({ ...draft.classes[0], id: "new-section", grade: "11" });
  let next = completeSetupStep(current, "classes-sections", draft);
  assert.equal(next.completed.length, 3);
  next = completeSetupStep(next, "bell-schedule", next);
  next = completeSetupStep(next, "fee-structure", next);
  assert.throws(() => completeSetupStep(next, "staff-allocations", next));
});
test("bell slots reject overlap and reversed times, permit adjacent periods", () => {
  const current = createSetupSeed();
  const draft = copy(current);
  draft.bells[1].start = "08:35";
  assert.ok(!setupConfigSchema.safeParse(draft).success);
  draft.bells[1].start = "09:10";
  assert.ok(setupConfigSchema.safeParse(draft).success);
  draft.bells[1].end = "09:00";
  assert.ok(!setupConfigSchema.safeParse(draft).success);
});
test("records reject foreign schools, missing references, duplicate admissions and capacities below enrolment", () => {
  for (const edit of [
    (s: ReturnType<typeof createSetupSeed>) =>
      (s.students[0].schoolId = "foreign"),
    (s: ReturnType<typeof createSetupSeed>) => (s.classes[0].capacity = 1),
    (s: ReturnType<typeof createSetupSeed>) =>
      (s.students[0].classSectionId = "missing"),
    (s: ReturnType<typeof createSetupSeed>) =>
      (s.students[0].admissionNumber = s.students[1].admissionNumber),
  ]) {
    const data = createSetupSeed();
    edit(data);
    assert.ok(!setupConfigSchema.safeParse(data).success);
  }
});
test("fee schedules calculate integer minor unit totals and reject negative or fractional minor amounts", () => {
  const data = createSetupSeed();
  assert.equal(annualFeeMinor(data), 6300000);
  data.concessionPercent = 10;
  assert.equal(annualFeeMinor(data), 5670000);
  data.fees[0].amountMinor = -1;
  assert.ok(!setupConfigSchema.safeParse(data).success);
  data.fees[0].amountMinor = 1.2;
  assert.ok(!setupConfigSchema.safeParse(data).success);
});
test("CSV parser handles BOM, quoted commas, escaped quotes and CRLF; rejects malformed or oversized input", () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"Name, A","A ""quote"""\r\n'), [
    ["a", "b"],
    ["Name, A", 'A "quote"'],
  ]);
  assert.throws(() => parseCsv('a\n"unterminated'));
  assert.throws(() => parseCsv('a\n"closed"extra'));
  assert.throws(() => parseCsv("a".repeat(1000001)));
});
test("CSV imports are atomic, create linked records, reject duplicates and invalid fields", () => {
  const current = createSetupSeed();
  const row = `NEW-1,"Test, Student",${current.classes[0].id},Test Guardian,test@example.com,+919876543210`;
  const csv = `${studentCsvHeader}\n${row}`;
  const next = importStudents(current, csv);
  assert.equal(next.students.length, 101);
  assert.equal(next.guardians.length, 101);
  assert.equal(next.relationships.length, 101);
  assert.equal(current.students.length, 100);
  assert.throws(() => importStudents(next, csv));
  assert.throws(() => importStudents(current, `${csv}\n${row}`));
  assert.throws(() =>
    importStudents(current, csv.replace("test@example.com", "invalid")),
  );
  assert.throws(() => importStudents(current, studentCsvHeader));
});
test("backup contracts reject wrong versions, malformed data, invalid completion and unsafe logo sources", () => {
  const seed = createSetupSeed();
  assert.ok(!setupConfigSchema.safeParse({ ...seed, version: 2 }).success);
  assert.ok(!setupConfigSchema.safeParse({}).success);
  assert.ok(
    !setupConfigSchema.safeParse({ ...seed, completed: ["academic-terms"] })
      .success,
  );
  assert.ok(
    !setupConfigSchema.safeParse({
      ...seed,
      branding: { logo: "javascript:alert(1)" },
    }).success,
  );
});
