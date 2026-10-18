import { roomOccupied } from "../../workspace/domain/room-occupancy.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import { marksBatchRequestSchema } from "../schemas/exams.schema.ts";
import { scope } from "../../workspace/domain/operations.ts";
export function autoScheduleExam(y: SchoolYearWorkspace, id: string) {
  const exam = y.records.exams.find((e) => e.id === id);
  if (!exam || exam.status === "completed")
    throw new Error("Choose an editable exam cycle.");
  const next = structuredClone(y);
  next.records.papers = next.records.papers.filter((p) => p.examId !== id);
  const periods = y.setup.bells.filter((b) => b.kind === "period"),
    rooms = y.records.rooms,
    staff = y.setup.staff;
  if (!periods.length || !rooms.length || !staff.length)
    throw new Error("Configure periods, rooms and staff first.");
  for (const classId of exam.classSectionIds)
    for (const subjectId of exam.subjectIds) {
      let assigned = false;
      for (
        let date = new Date(exam.dates.startDate + "T00:00:00Z");
        date.toISOString().slice(0, 10) <= exam.dates.endDate && !assigned;
        date.setUTCDate(date.getUTCDate() + 1)
      ) {
        const iso = date.toISOString().slice(0, 10);
        if (
          !y.records.preferences.workingDays.includes(
            date.toLocaleDateString("en-US", {
              weekday: "long",
              timeZone: "UTC",
            }) as (typeof y.records.preferences.workingDays)[number],
          )
        )
          continue;
        for (const period of periods) {
          if (assigned) break;
          for (const room of rooms) {
            if (assigned) break;
            if (
              y.setup.students.filter((s) => s.classSectionId === classId)
                .length > room.capacity
            )
              continue;
            if (roomOccupied(next.records, iso, period.id, room.name)) continue;
            for (const teacher of staff) {
              if (
                next.records.papers.some(
                  (p) =>
                    p.date === iso &&
                    p.periodId === period.id &&
                    (p.room === room.name ||
                      p.invigilatorId === teacher.id ||
                      p.classSectionId === classId),
                )
              )
                continue;
              next.records.papers.push({
                ...scope(y),
                id: crypto.randomUUID(),
                examId: id,
                classSectionId: classId,
                subjectId,
                date: iso,
                periodId: period.id,
                room: room.name,
                invigilatorId: teacher.id,
              });
              assigned = true;
              break;
            }
          }
        }
      }
      if (!assigned)
        throw new Error(
          "Not enough free rooms, periods or invigilators in the exam date range.",
        );
    }
  return schoolYearWorkspaceSchema.parse(next);
}
export function publishExam(y: SchoolYearWorkspace, id: string) {
  const exam = y.records.exams.find((e) => e.id === id);
  if (!exam) throw new Error("Exam not found.");
  if (exam.status === "completed")
    throw new Error("Results are locked. Request an approved exam unlock.");
  for (const cohort of exam.classSectionIds)
    for (const subject of exam.subjectIds)
      if (
        !y.records.papers.some(
          (p) =>
            p.examId === id &&
            p.classSectionId === cohort &&
            p.subjectId === subject,
        )
      )
        throw new Error("Schedule every cohort and subject before publishing.");
  return schoolYearWorkspaceSchema.parse({
    ...y,
    records: {
      ...y.records,
      exams: y.records.exams.map((e) =>
        e.id === id ? { ...e, status: "published" } : e,
      ),
    },
  });
}
export function completeExam(y: SchoolYearWorkspace, id: string) {
  if(y.workflows.resultReviews.some(r=>r.examId===id&&r.status==="submitted"))throw new Error("Decide pending mark moderation before locking results.");
  const exam = y.records.exams.find((e) => e.id === id);
  if (!exam || exam.status !== "published")
    throw new Error("Publish the exam before completing results.");
  const eligible = y.setup.students.filter(
    (s) =>
      exam.classSectionIds.includes(s.classSectionId) &&
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ),
  );
  for (const student of eligible)
    for (const subject of exam.subjectIds)
      if (
        !y.records.marks.some(
          (m) =>
            m.examId === id &&
            m.subjectId === subject &&
            m.studentId === student.id,
        )
      )
        throw new Error(
          "Enter all eligible student marks before locking results.",
        );
  return schoolYearWorkspaceSchema.parse({
    ...y,
    records: {
      ...y.records,
      exams: y.records.exams.map((e) =>
        e.id === id ? { ...e, status: "completed" } : e,
      ),
    },
  });
}
export function gradeBandForPercent(percent: number) {
  return percent >= 91
    ? "A1"
    : percent >= 81
      ? "A2"
      : percent >= 71
        ? "B1"
        : percent >= 61
          ? "B2"
          : percent >= 51
            ? "C1"
            : percent >= 41
              ? "C2"
              : percent >= 33
                ? "D"
                : "E";
}

export function saveMarks(y: SchoolYearWorkspace, input: unknown) {
  const v = marksBatchRequestSchema.parse(input);
  const exam = y.records.exams.find((e) => e.id === v.examId);
  if (
    v.schoolId !== y.setup.school.id ||
    v.academicYearId !== y.setup.calendar.year.id ||
    !exam
  )
    throw new Error("Exam is unavailable in this school/year.");
  if (exam.status === "completed")
    throw new Error("Results are locked. Request an approved exam unlock.");
  if (
    !exam.classSectionIds.includes(v.classSectionId) ||
    !exam.subjectIds.includes(v.subjectId)
  )
    throw new Error("Choose an eligible exam cohort and subject.");
  if (new Set(v.entries.map((e) => e.studentId)).size !== v.entries.length)
    throw new Error("Duplicate student marks.");
  const next = structuredClone(y);
  for (const entry of v.entries) {
    if (
      !y.setup.students.some(
        (s) =>
          s.id === entry.studentId && s.classSectionId === v.classSectionId,
      )
    )
      throw new Error("Student is outside this exam class.");
    if (entry.marks !== null && entry.marks > exam.maxMarks)
      throw new Error("Marks exceed the exam maximum.");
    const existing = next.records.marks.find(
      (m) =>
        m.examId === v.examId &&
        m.studentId === entry.studentId &&
        m.subjectId === v.subjectId,
    );
    next.records.marks = next.records.marks.filter(
      (m) => m.id !== existing?.id,
    );
    if (entry.marks !== null)
      next.records.marks.push({
        ...scope(y),
        id: existing?.id ?? crypto.randomUUID(),
        examId: v.examId,
        subjectId: v.subjectId,
        studentId: entry.studentId,
        marks: entry.marks,
        remark: existing?.remark ?? "",
      });
  }
  return schoolYearWorkspaceSchema.parse(next);
}
