import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { academicWeekdayDate } from "../src/features/workspace/domain/form-values.ts";
import { scope } from "../src/features/workspace/domain/operations.ts";
import {
  assignmentCandidates,
  assignSubstitute,
} from "../src/features/timetable/domain/assignment.ts";

function fixture() {
  const year = createWorkspace().years[0];
  const slot = year.records.slots[0];
  const date = academicWeekdayDate(year.setup.calendar.year, slot.weekday);
  const candidate = assignmentCandidates(year, slot.id, date).find(
    (c) => !c.unavailableReason,
  );
  assert.ok(candidate, "seed must include an available colleague");
  return {
    year,
    slot,
    date,
    candidate,
    input: {
      ...scope(year),
      slotId: slot.id,
      date,
      substituteStaffId: candidate.staff.id,
      reason: "Cover the scheduled lesson during staff absence.",
    },
  };
}

test("substitute assignment saves a scoped draft and rejects a duplicate slot/date", () => {
  const { year, input, slot } = fixture();
  const next = assignSubstitute(year, input);
  const record = next.records.substitutions.at(-1)!;
  assert.equal(record.absentStaffId, slot.staffId);
  assert.equal(record.status, "draft");
  assert.equal(record.schoolId, year.setup.school.id);
  assert.equal(record.academicYearId, year.setup.calendar.year.id);
  assert.equal(
    year.records.substitutions.length + 1,
    next.records.substitutions.length,
  );
  assert.throws(
    () => assignSubstitute(next, input),
    /already has a substitute/,
  );
});

test("assignment rejects foreign ownership, archived years and invalid inputs", () => {
  const { year, input } = fixture();
  assert.throws(
    () => assignSubstitute(year, { ...input, schoolId: "other-school" }),
    /school and academic year/,
  );
  assert.throws(
    () => assignSubstitute(year, { ...input, academicYearId: "other-year" }),
    /school and academic year/,
  );
  assert.throws(
    () => assignSubstitute({ ...year, locked: true }, input),
    /editable/,
  );
  assert.throws(() => assignSubstitute(year, { ...input, reason: "short" }));
  assert.throws(() => assignSubstitute(year, { ...input, date: "not-a-date" }));
  assert.throws(
    () =>
      assignSubstitute(year, { ...input, substituteStaffId: "unknown-staff" }),
    /available substitute/,
  );
});

test("assignment availability rejects the absent teacher, weekday mismatch and out-of-year dates", () => {
  const { year, input, slot } = fixture();
  assert.throws(
    () => assignSubstitute(year, { ...input, substituteStaffId: slot.staffId }),
    /available substitute/,
  );
  assert.deepEqual(assignmentCandidates(year, slot.id, "2025-01-01"), []);
  const wrong = new Date(input.date + "T00:00:00Z");
  wrong.setUTCDate(wrong.getUTCDate() + 1);
  assert.deepEqual(
    assignmentCandidates(year, slot.id, wrong.toISOString().slice(0, 10)),
    [],
  );
});

test("assignment excludes approved leave and exited staff at save time", () => {
  const { year, input, candidate, slot, date } = fixture();
  const leaveYear = structuredClone(year);
  leaveYear.records.leaves.push({
    ...scope(year),
    id: "assignment-leave",
    personType: "staff",
    personId: candidate.staff.id,
    dates: { startDate: date, endDate: date },
    reason: "Approved absence for the assignment test.",
    status: "approved",
    decisionNote: "Reviewed approved leave for this date.",
  });
  assert.match(
    assignmentCandidates(leaveYear, slot.id, date).find(
      (c) => c.staff.id === candidate.staff.id,
    )!.unavailableReason,
    /approved leave/,
  );
  assert.throws(() => assignSubstitute(leaveYear, input), /approved leave/);
  const exitedYear = structuredClone(year);
  exitedYear.workflows.employmentEvents.push({
    id: "assignment-exit",
    staffId: candidate.staff.id,
    kind: "exited",
    date: year.setup.calendar.year.startDate,
    note: "Employment ended before the coverage date.",
    actorId: "test-admin",
  });
  assert.throws(() => assignSubstitute(exitedYear, input), /Not employed/);
});

test("assignment rejects teacher period conflicts before saving", () => {
  const { year, input, candidate, slot, date } = fixture();
  const busyYear = structuredClone(year);
  busyYear.records.slots.push({
    ...slot,
    id: "assignment-busy-slot",
    staffId: candidate.staff.id,
  });
  assert.match(
    assignmentCandidates(busyYear, slot.id, date).find(
      (c) => c.staff.id === candidate.staff.id,
    )!.unavailableReason,
    /Already teaching/,
  );
  assert.throws(() => assignSubstitute(busyYear, input), /Already teaching/);
});
