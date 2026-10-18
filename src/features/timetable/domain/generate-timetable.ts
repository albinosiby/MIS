import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { timetableGenerateSchema } from "../schemas/generator.schema.ts";
import type { TimetableSlot } from "../models/index.ts";
import { timetableVersionSchema, timetablePublishRequestSchema } from "../schemas/publication.schema.ts";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
/** Bounded backtracking: either return a complete conflict-free draft or preserve the original. */
export function generateTimetable(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("School administrator required.");
  const request = timetableGenerateSchema.parse(input),
    periods = y.setup.bells.filter((b) => b.kind === "period").map((b) => b.id),
    base = y.records.slots.filter(
      (s) => !request.replaceDrafts || s.status === "published",
    );
  for (const blocked of request.unavailable)
    if (
      !y.setup.staff.some((s) => s.id === blocked.staffId) ||
      !periods.includes(blocked.periodId)
    )
      throw new Error(
        "Availability must reference a current teacher and teaching period.",
      );
  if (new Set(request.days).size !== request.days.length)
    throw new Error("Choose unique weekdays.");
  for (const r of request.requirements) {
    const subject = y.records.subjects.find((s) => s.id === r.subjectId);
    if (
      !y.setup.classes.some((c) => c.id === r.classSectionId) ||
      !subject ||
      !y.setup.allocations.some(
        (x) =>
          x.staffId === r.staffId &&
          x.classSectionId === r.classSectionId &&
          x.subject === subject.name,
      )
    )
      throw new Error(
        "Each requirement needs a current class/subject teaching allocation.",
      );
    const room = y.records.rooms.find((room) => room.name === r.room);
    if (
      !room ||
      room.capacity <
        y.setup.students.filter((s) => s.classSectionId === r.classSectionId&&!y.records.studentProfiles.some(p=>p.studentId===s.id&&p.status!=="active"))
          .length
    )
      throw new Error("Choose a registered room with enough seats.");
  }
  const demands = request.requirements
    .flatMap((r) => Array.from({ length: r.periodsPerWeek }, () => r))
    .sort((a, b) => b.periodsPerWeek - a.periodsPerWeek);
  if (demands.length > 2000)
    throw new Error("Generate smaller timetable batches.");
  const placed: TimetableSlot[] = [];
  let attempts = 0;
  function place(index: number): boolean {
    if (index === demands.length) return true;
    if (++attempts > 200000) return false;
    const demand = demands[index];
    for (const day of request.days)
      for (const periodId of periods) {
        const current = [...base, ...placed];
        if (
          request.unavailable.some(
            (b) =>
              b.staffId === demand.staffId &&
              b.weekday === day &&
              b.periodId === periodId,
          )
        )
          continue;
        if (
          current.some(
            (s) =>
              s.weekday === day &&
              s.periodId === periodId &&
              (s.classSectionId === demand.classSectionId ||
                s.staffId === demand.staffId ||
                s.room === demand.room),
          )
        )
          continue;
        if (
          current.filter(
            (s) => s.weekday === day && s.staffId === demand.staffId,
          ).length >= request.maxPeriodsPerTeacherPerDay
        )
          continue;
        placed.push({
          id: crypto.randomUUID(),
          schoolId: a.schoolId,
          academicYearId: y.setup.calendar.year.id,
          classSectionId: demand.classSectionId,
          subjectId: demand.subjectId,
          staffId: demand.staffId,
          room: demand.room,
          weekday: day,
          periodId,
          status: "draft",
        });
        if (place(index + 1)) return true;
        placed.pop();
      }
    return false;
  }
  if (!place(0))
    throw new Error(
      "No complete timetable satisfies these constraints. Increase room/period capacity, reduce workloads or generate a smaller batch; nothing was saved.",
    );
  return { ...y, records: { ...y.records, slots: [...base, ...placed] } };
}
export function publishTimetable(y: SchoolYearWorkspace, a: AccountIdentity, input: unknown = {}) {
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("Administrator required.");
  if (!y.records.slots.length) throw new Error("Prepare timetable slots before publication.");
  const request=timetablePublishRequestSchema.parse(input);
  if (request.classSectionId && !y.setup.classes.some(c=>c.id===request.classSectionId)) throw new Error("Choose a class in this school/year.");
  const slots = y.records.slots.map(s => !request.classSectionId || s.classSectionId===request.classSectionId ? ({ ...s, status: "published" as const }) : s);
  const snapshots = slots.filter(s=>s.status==="published").map(s => ({ ...s,
    className: y.setup.classes.filter(c=>c.id===s.classSectionId).map(c=>`${c.grade} ${c.section}`).join(""),
    subjectName: y.records.subjects.find(subject=>subject.id===s.subjectId)?.name,
    teacherName: y.setup.staff.find(teacher=>teacher.id===s.staffId)?.displayName,
    periodName: y.setup.bells.filter(b=>b.id===s.periodId).map(b=>`${b.name} ${b.start}–${b.end}`).join(""),
  }));
  const latest = y.workflows.timetableVersions.at(-1);
  if (latest && JSON.stringify(latest.slots) === JSON.stringify(snapshots)) throw new Error("This timetable version is already published.");
  const version = timetableVersionSchema.parse({ id: crypto.randomUUID(), version: (latest?.version ?? 0)+1, publishedBy: a.id, publishedAt: new Date().toISOString(), slots: snapshots });
  return schoolYearWorkspaceSchema.parse({
    ...y,
    records: {
      ...y.records,
      slots,
    },
    workflows: { ...y.workflows, timetableVersions: [...y.workflows.timetableVersions, version] },
  });
}
