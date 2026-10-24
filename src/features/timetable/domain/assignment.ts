import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { localDateSchema } from "../../../shared/schemas/primitives.ts";
import { employedOn } from "../../hr/domain/employment-status.ts";
import { substitutionAssignmentSchema } from "../schemas/assignment.schema.ts";
import { putRecord } from "../../workspace/domain/operations.ts";

/** Presentation projections: scheduled subject experience and availability, not verified qualifications. */
export function assignmentCandidates(
  y: SchoolYearWorkspace,
  slotId: string,
  date: string,
) {
  const slot = y.records.slots.find((s) => s.id === slotId);
  if (
    !slot ||
    !localDateSchema.safeParse(date).success ||
    date < y.setup.calendar.year.startDate ||
    date > y.setup.calendar.year.endDate ||
    new Date(date + "T00:00:00Z").toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    }) !== slot.weekday
  )
    return [];
  const alreadyCovered = y.records.substitutions.some(
    (s) => s.slotId === slotId && s.date === date,
  );
  return y.setup.staff
    .filter((s) => s.id !== slot.staffId)
    .map((staff) => {
      const reason = alreadyCovered
        ? "Slot already has a substitute"
        : !employedOn(y.workflows.employmentEvents, staff.id, date)
          ? "Not employed on this date"
          : y.records.leaves.some(
                (l) =>
                  l.personType === "staff" &&
                  l.personId === staff.id &&
                  l.status === "approved" &&
                  l.dates.startDate <= date &&
                  l.dates.endDate >= date,
              )
            ? "On approved leave"
            : y.records.slots.some(
                  (s) =>
                    s.staffId === staff.id &&
                    s.weekday === slot.weekday &&
                    s.periodId === slot.periodId,
                ) ||
                y.records.substitutions.some(
                  (s) =>
                    s.date === date &&
                    s.substituteStaffId === staff.id &&
                    y.records.slots.find((t) => t.id === s.slotId)?.periodId ===
                      slot.periodId,
                )
              ? "Already teaching in this period"
              : "";
      return {
        staff,
        unavailableReason: reason,
        scheduledPeriods: y.records.slots.filter((s) => s.staffId === staff.id)
          .length,
        teachesSubject: y.records.slots.some(
          (s) => s.staffId === staff.id && s.subjectId === slot.subjectId,
        ),
      };
    })
    .sort(
      (a, b) =>
        Number(Boolean(a.unavailableReason)) -
          Number(Boolean(b.unavailableReason)) ||
        Number(b.teachesSubject) - Number(a.teachesSubject) ||
        a.scheduledPeriods - b.scheduledPeriods ||
        a.staff.displayName.localeCompare(b.staff.displayName),
    );
}

export function assignSubstitute(y: SchoolYearWorkspace, input: unknown) {
  const data = substitutionAssignmentSchema.parse(input);
  if (
    y.locked ||
    data.schoolId !== y.setup.school.id ||
    data.academicYearId !== y.setup.calendar.year.id
  )
    throw new Error("Choose an editable school and academic year you own.");
  const slot = y.records.slots.find((s) => s.id === data.slotId);
  const candidate = assignmentCandidates(y, data.slotId, data.date).find(
    (c) => c.staff.id === data.substituteStaffId,
  );
  if (!slot || !candidate || candidate.unavailableReason)
    throw new Error(
      candidate?.unavailableReason ||
        "Choose an available substitute on the slot weekday.",
    );
  return putRecord(y, "substitutions", {
    ...data,
    id: crypto.randomUUID(),
    absentStaffId: slot.staffId,
    status: "draft",
  });
}
