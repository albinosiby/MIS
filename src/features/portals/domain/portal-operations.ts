import {staffLeaveEntitlement} from "../../attendance/domain/leave-policy.ts";
import { canReadPortalNotice } from "./notice-access.ts";
import {
  homeworkSchema,
  lessonPlanSchema,
} from "../../academics/schemas/academics.schema.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  portalLeaveSchema,
  portalSubmissionSchema,
  portalAttendanceSchema,
  portalGradeSchema,
  portalMarkSchema,
} from "../schemas/portal.schema.ts";
import { scopedStudentIds } from "../../operations/domain/operations.ts";
import { putRecord, scope } from "../../workspace/domain/operations.ts";
function check(y: SchoolYearWorkspace, a: AccountIdentity) {
  if (a.schoolId !== y.setup.school.id || y.locked)
    throw new Error("School/year is inaccessible or archived.");
}
/** Create teaching work only within this account's current class and subject allocation. */
export function createTeacherWork(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  kind: "homework" | "lessons",
  input: unknown,
) {
  check(y, a);
  if (a.role !== "teacher") throw new Error("Teacher required.");
  const row =
    kind === "homework"
      ? homeworkSchema.parse(input)
      : lessonPlanSchema.parse(input);
  if (
    row.staffId !== a.personId ||
    row.schoolId !== a.schoolId ||
    row.academicYearId !== y.setup.calendar.year.id
  )
    throw new Error(
      "Teaching work must belong to your school, year and account.",
    );
  if (y.records[kind].some((r) => r.id === row.id))
    throw new Error("Teaching work already exists.");
  const unit =
    "unitId" in row ? y.records.units.find((u) => u.id === row.unitId) : null;
  const classId =
    "classSectionId" in row ? row.classSectionId : unit?.classSectionId;
  const subjectId = "subjectId" in row ? row.subjectId : unit?.subjectId;
  const subject = y.records.subjects.find((s) => s.id === subjectId);
  if (
    !y.setup.allocations.some(
      (x) =>
        x.staffId === a.personId &&
        x.classSectionId === classId &&
        x.subject === subject?.name,
    )
  )
    throw new Error("Choose your assigned class and subject.");
  if ("status" in row && row.status !== "draft")
    throw new Error("New lesson plans must start as drafts.");
  return putRecord(y, kind, row);
}
export function submitTeacherLesson(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  id: string,
) {
  check(y, a);
  const lesson = y.records.lessons.find((l) => l.id === id);
  if (
    a.role !== "teacher" ||
    !lesson ||
    lesson.staffId !== a.personId ||
    !["draft", "returned"].includes(lesson.status)
  )
    throw new Error("Only your own draft or returned lesson can be submitted.");
  return putRecord(y, "lessons", { ...lesson, status: "submitted" });
}
export function requestPortalLeave(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  check(y, a);
  const v = portalLeaveSchema.parse(input);
  const student = ["parent", "student"].includes(a.role);
  if(student&&y.records.studentProfiles.some(p=>p.studentId===v.personId&&p.status!=="active"))throw new Error("Leave requests require an active enrolment.");
  if (
    student
      ? !scopedStudentIds(y, a).includes(v.personId)
      : a.personId !== v.personId
  )
    throw new Error("You can request leave only for an authorised person.");
  if (
    v.startDate < y.setup.calendar.year.startDate ||
    v.endDate > y.setup.calendar.year.endDate
  )
    throw new Error("Leave dates must be inside the academic year.");
  if(!student)staffLeaveEntitlement(y,v.personId,v.leaveType??"Casual leave");
  if(y.records.leaves.some(l=>l.personId===v.personId&&l.personType===(student?"student":"staff")&&l.status!=="rejected"&&l.dates.startDate<=v.endDate&&l.dates.endDate>=v.startDate))throw new Error("A leave request already covers these dates.");
  return putRecord(y, "leaves", {
    ...scope(y),
    id: crypto.randomUUID(),
    personType: student ? "student" : "staff",
    personId: v.personId,
    dates: { startDate: v.startDate, endDate: v.endDate },
    reason: v.reason,
    ...(!student?{leaveType:v.leaveType??"Casual leave"}:{}),
    status: "pending",
    decisionNote: "",
  });
}
export function submitPortalHomework(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  check(y, a);
  const v = portalSubmissionSchema.parse(input);
  if (a.role !== "student" || a.personId !== v.studentId)
    throw new Error("Only the linked student can submit this homework.");
  if(y.records.studentProfiles.some(p=>p.studentId===v.studentId&&p.status!=="active"))throw new Error("Homework submissions require an active enrolment.");
  const student = y.setup.students.find((s) => s.id === v.studentId);
  const homework = y.records.homework.find(
    (h) =>
      h.id === v.homeworkId && h.classSectionId === student?.classSectionId,
  );
  if (!homework) throw new Error("Homework is not assigned to this student.");
  const prev = y.records.submissions.find(
    (s) => s.studentId === v.studentId && s.homeworkId === v.homeworkId,
  );
  if (prev?.status === "graded")
    throw new Error("Graded submissions are locked.");
  return putRecord(y, "submissions", {
    ...scope(y),
    id: prev?.id ?? crypto.randomUUID(),
    homeworkId: v.homeworkId,
    studentId: v.studentId,
    status: "submitted",
    answer: v.answer,
    score: null,
    feedback: "",
  });
}
export function savePortalAttendance(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  check(y, a);
  const v = portalAttendanceSchema.parse(input);
  if (
    a.role !== "teacher" ||
    !y.setup.allocations.some(
      (x) => x.staffId === a.personId && x.classSectionId === v.classSectionId,
    )
  )
    throw new Error("You are not assigned to this class.");
  const ids = new Set(v.entries.map((x) => x.studentId));
  if (ids.size !== v.entries.length)
    throw new Error("Duplicate attendance entries.");
  let next = y;
  for (const entry of v.entries) {
    if (
      !y.setup.students.some(
        (s) =>
          s.id === entry.studentId && s.classSectionId === v.classSectionId,
      )
    )
      throw new Error("Student is not in this class.");
    const leave = y.records.leaves.some(
      (l) =>
        l.personType === "student" &&
        l.personId === entry.studentId &&
        l.status === "approved" &&
        l.dates.startDate <= v.date &&
        l.dates.endDate >= v.date,
    );
    const prev = next.records.attendance.find(
      (x) =>
        x.personType === "student" &&
        x.personId === entry.studentId &&
        x.date === v.date &&
        x.periodId === null,
    );
    next = putRecord(next, "attendance", {
      ...scope(y),
      id: prev?.id ?? crypto.randomUUID(),
      personType: "student",
      personId: entry.studentId,
      date: v.date,
      periodId: null,
      status: leave ? "excused" : entry.status,
      note: leave ? "Approved leave" : "",
    });
  }
  return next;
}
export function gradePortalSubmission(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  check(y, a);
  const v = portalGradeSchema.parse(input);
  const submission = y.records.submissions.find((s) => s.id === v.submissionId);
  const hw = y.records.homework.find((h) => h.id === submission?.homeworkId);
  if (!submission || !hw || a.role !== "teacher" || hw.staffId !== a.personId)
    throw new Error("This submission is not assigned to you.");
  if (submission.status === "pending")
    throw new Error("The student must submit an answer before review.");
  if (v.score > hw.maxScore) throw new Error("Score exceeds homework maximum.");
  return putRecord(y, "submissions", {
    ...submission,
    status: "graded",
    score: v.score,
    feedback: v.feedback,
  });
}
export function savePortalMark(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
) {
  check(y, a);
  const v = portalMarkSchema.parse(input);
  if(y.records.studentProfiles.some(p=>p.studentId===v.studentId&&p.status!=="active"))throw new Error("Homework submissions require an active enrolment.");
  const student = y.setup.students.find((s) => s.id === v.studentId);
  const subject = y.records.subjects.find((s) => s.id === v.subjectId);
  const exam = y.records.exams.find((e) => e.id === v.examId);
  if (
    a.role !== "teacher" ||
    !student ||
    !subject ||
    !exam ||
    exam.status === "completed" ||
    !exam.classSectionIds.includes(student.classSectionId) ||
    !exam.subjectIds.includes(subject.id) ||
    !y.setup.allocations.some(
      (x) =>
        x.staffId === a.personId &&
        x.classSectionId === student.classSectionId &&
        x.subject === subject.name,
    )
  )
    throw new Error("This mark is locked or outside your teaching assignment.");
  if (v.marks > exam.maxMarks)
    throw new Error("Marks exceed the examination maximum.");
  const prev = y.records.marks.find(
    (m) =>
      m.examId === v.examId &&
      m.studentId === v.studentId &&
      m.subjectId === v.subjectId,
  );
  return putRecord(y, "marks", {
    ...scope(y),
    id: prev?.id ?? crypto.randomUUID(),
    ...v,
  });
}
export function acknowledgePortalNotice(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  id: string,
) {
  check(y, a);
  const row = y.records.notices.find(
    (n) => n.id === id && canReadPortalNotice(y, a, n),
  );
  if (!row) throw new Error("This notice is not addressed to you.");
  return putRecord(y, "notices", {
    ...row,
    recipientIds: [...new Set([...row.recipientIds, a.personId!])],
    acknowledgedIds: [...new Set([...row.acknowledgedIds, a.personId!])],
  });
}
