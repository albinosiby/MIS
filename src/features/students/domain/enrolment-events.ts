import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
export function applyEnrolmentEvents(
  previous: SchoolYearWorkspace,
  next: SchoolYearWorkspace,
  a: AccountIdentity,
) {
  const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: next.workflows.advanced.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    date =
      today < next.setup.calendar.year.startDate ||
      today > next.setup.calendar.year.endDate
        ? next.setup.calendar.year.startDate
        : today,
    events = next.setup.students
      .filter(
        (s) =>
          !previous.setup.students.some((o) => o.id === s.id) &&
          !next.workflows.studentEvents.some(
            (e) => e.studentId === s.id && e.kind === "enrolled",
          ),
      )
      .map((s) => ({
        id: crypto.randomUUID(),
        studentId: s.id,
        kind: "enrolled" as const,
        date,
        note: "Student added to the school enrolment register",
        actorId: a.id,
      }));
  return events.length
    ? {
        ...next,
        workflows: {
          ...next.workflows,
          studentEvents: [...next.workflows.studentEvents, ...events],
        },
      }
    : next;
}
