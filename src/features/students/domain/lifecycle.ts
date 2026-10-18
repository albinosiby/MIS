import { z } from "zod";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
export function changeStudentLifecycle(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  const data = z
    .strictObject({
      studentId: z.string().min(1),
      kind: z.enum(["class-changed", "transferred", "withdrawn"]),
      classSectionId: z.string().nullable(),
      date: z.iso.date(),
      note: z.string().trim().min(8).max(500),
    })
    .parse(input);
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal"].includes(a.role)
  )
    throw new Error("Student lifecycle permission required.");
  const student = y.setup.students.find((s) => s.id === data.studentId);
  if (!student) throw new Error("Student unavailable.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: y.workflows.advanced.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (data.date > today)
    throw new Error("Choose an effective date that has already arrived.");
  if (
    data.date < y.setup.calendar.year.startDate ||
    data.date > y.setup.calendar.year.endDate
  )
    throw new Error("Choose a date in this academic year.");
  if(y.workflows.studentEvents.some(e=>e.studentId===student.id&&["enrolled","class-changed"].includes(e.kind)&&e.date>data.date))throw new Error("Movement cannot precede the student's enrolment or latest class movement.");
  if (data.kind === "class-changed") {
    if (
      !y.records.studentProfiles.some(
        (p) => p.studentId === student.id && p.status === "active",
      )
    )
      throw new Error("Class changes require an active enrolment.");
    if (
      y.workflows.studentEvents.some(
        (e) =>
          e.studentId === student.id &&
          e.kind === "class-changed" &&
          e.date >= data.date,
      )
    )
      throw new Error(
        "Class movements must follow the saved movement history.",
      );
    const target = y.setup.classes.find((c) => c.id === data.classSectionId);
    if (!target || target.id === student.classSectionId)
      throw new Error("Choose a different class in this year.");
    if (
      y.setup.students.filter((s) => s.classSectionId === target.id&&!y.records.studentProfiles.some(p=>p.studentId===s.id&&p.status!=="active")).length >=
      target.capacity
    )
      throw new Error("Class capacity reached.");
  } else if (
    !y.records.studentProfiles.some(
      (p) => p.studentId === student.id && p.status === "active",
    )
  )
    throw new Error("Only an active student can leave this school.");
  if(data.kind!=="class-changed"&&y.extensions.some(r=>r.studentId===student.id&&((r.kind==="loans"&&r.status==="issued")||(r.kind==="hostel-allocations"&&r.status==="active")||(r.kind==="outpasses"&&["approved","out"].includes(r.status))||(r.kind==="library-fines"&&r.status==="outstanding"))))throw new Error("Return loans, close hostel/outpasses and settle fines before withdrawal or transfer.");
  const events = [
    ...y.workflows.studentEvents,
    {
      id: crypto.randomUUID(),
      studentId: student.id,
      kind: data.kind,
      date: data.date,
      note: data.note,
      actorId: a.id,
      ...(data.kind === "class-changed"
        ? {
            fromClassId: student.classSectionId,
            toClassId: data.classSectionId!,
          }
        : {}),
    },
  ];
  return {
    ...y,
    setup: {
      ...y.setup,
      students: y.setup.students.map((s) =>
        s.id === student.id && data.kind === "class-changed"
          ? { ...s, classSectionId: data.classSectionId! }
          : s,
      ),
    },
    records: {
      ...y.records,
      studentProfiles: y.records.studentProfiles.map((p) =>
        p.studentId === student.id && data.kind !== "class-changed"
          ? { ...p, status: "transferred" as const }
          : p,
      ),
    },
    workflows: { ...y.workflows, studentEvents: events },
  };
}
export function studentTimeline(y: SchoolYearWorkspace, studentId: string) {
  const events = [
    ...y.workflows.studentEvents
      .filter((e) => e.studentId === studentId)
      .map((e) => ({ date: e.date, kind: e.kind, detail: e.note })),
    ...y.records.attendance
      .filter((r) => r.personType === "student" && r.personId === studentId)
      .map((r) => ({ date: r.date, kind: "attendance", detail: r.status })),
    ...y.records.certificates
      .filter((c) => c.studentId === studentId)
      .map((c) => ({
        date: c.issuedOn,
        kind: "certificate",
        detail: `${c.type}: ${c.status}`,
      })),
    ...y.records.invoices
      .filter((i) => i.studentId === studentId)
      .map((i) => ({ date: i.issuedOn, kind: "invoice", detail: i.reference })),
    ...y.workflows.publications
      .filter((p) => p.ownerType === "student" && p.ownerId === studentId)
      .map((p) => ({
        date: p.issuedAt.slice(0, 10),
        kind: p.kind,
        detail: p.reference,
      })),
  ];
  return events.sort((a, b) => b.date.localeCompare(a.date));
}
