import { localDateSchema } from "../../../shared/schemas/primitives.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { reportKeys } from "../schemas/communication.schema.ts";
import {
  balance,
  csvExport,
  scope,
  putRecord,
  publishNotice,
} from "../../workspace/domain/operations.ts";
export type ReportKey = (typeof reportKeys)[number];
export const reportTitles: Record<ReportKey, string> = {
  students: "Master Student Roster",
  attendance: "Daily Student Attendance Digest",
  fees: "Fee Collection & Defaulter Ageing Ledger",
  marks: "Consolidated Marks & Attendance",
  staff: "Faculty Directory",
  notices: "Notice Publication Register",
  audit: "System Audit & Compliance Log",
  guardians: "Guardian Contact Directory",
  "period-attendance": "Period-wise Attendance Register",
  "staff-attendance": "Staff Attendance Digest",
  leaves: "Leave Decisions Ledger",
  calendar: "Academic Events Calendar",
  admissions: "Admissions Conversion Pipeline",
  "admission-sources": "Inquiry Channel Sources",
  "exam-schedule": "Exam Papers & Hall Allocations",
  payments: "Payment Receipt Register",
  concessions: "Fee Concession Decisions",
  promotions: "Promotion & Transfer Directives",
  "staff-documents": "Faculty Documentation Readiness",
  "class-capacity": "Class & Section Capacity",
  allocations: "Faculty Class & Subject Workload",
  syllabus: "Syllabus Pacing & Curriculum",
  lessons: "Lesson Plan Approval Register",
  homework: "Homework Submission & Grading",
  certificates: "Certificates & TC Register",
  "notice-recipients": "Guardian Delivery & Read Audit",
  roles: "Roles & Permission Presets",
  enrolments: "Enrolment & Guardian Link Register",
  reenrolment: "Re-enrolment Intent Ledger",
  "room-reservations": "Room & Lab Reservations",
  health: "Student Health & Blood Group Directory",
  transport: "Transport Route & Boarding Directory",
};
export function reportRows(
  y: SchoolYearWorkspace,
  key: ReportKey,
): Record<string, unknown>[] {
  const student = (id: string) =>
      y.setup.students.find((s) => s.id === id)?.displayName ?? id,
    staff = (id: string) =>
      y.setup.staff.find((s) => s.id === id)?.displayName ?? id,
    cohort = (id: string) => {
      const c = y.setup.classes.find((c) => c.id === id);
      return c ? `${c.grade}-${c.section}` : id;
    };
  switch (key) {
    case "students":
      return y.setup.students.map((s) => ({
        ...s,
        className: cohort(s.classSectionId),
      }));
    case "guardians":
      return y.setup.guardians.map((g) => ({
        ...g,
        linkedStudents: y.setup.relationships
          .filter((l) => l.guardianId === g.id)
          .map((l) => student(l.studentId))
          .join("; "),
      }));
    case "attendance":
    case "period-attendance":
    case "staff-attendance":
      return y.records.attendance
        .filter((r) =>
          key === "staff-attendance"
            ? r.personType === "staff"
            : r.personType === "student" &&
              (key === "period-attendance"
                ? r.periodId !== null
                : r.periodId === null),
        )
        .map((r) => ({
          ...r,
          name:
            r.personType === "staff" ? staff(r.personId) : student(r.personId),
        }));
    case "fees":
      return y.records.invoices.map((i) => ({
        reference: i.reference,
        period: i.period,
        student: student(i.studentId),
        dueDate: i.dueDate,
        totalMinor: i.lines.reduce((s, l) => s + l.amountMinor, 0),
        concessionMinor: i.concessionMinor,
        outstandingMinor: balance(y, i.id),
        status: i.status,
      }));
    case "marks":
      return y.records.marks.map((m) => ({
        ...m,
        student: student(m.studentId),
        exam: y.records.exams.find((e) => e.id === m.examId)?.name,
        subject: y.records.subjects.find((s) => s.id === m.subjectId)?.name,
      }));
    case "staff":
      return y.setup.staff.map((s) => ({
        ...s,
        department:
          y.records.staffProfiles.find((p) => p.staffId === s.id)?.department ??
          "",
      }));
    case "notices":
      return y.records.notices.map((n) => ({
        ...n,
        recipientCount: n.recipientIds.length,
        readCount: n.acknowledgedIds.length,
      }));
    case "audit":
      return y.setup.audit.map((a) => ({
        ...a,
        schoolId: y.setup.school.id,
        academicYearId: y.setup.calendar.year.id,
      }));
    case "leaves":
      return y.records.leaves.map((l) => ({
        ...l,
        name:
          l.personType === "staff" ? staff(l.personId) : student(l.personId),
      }));
    case "calendar":
      return y.records.events;
    case "admissions":
      return y.records.inquiries;
    case "admission-sources":
      return ["Website", "Walk-in", "Referral", "Phone", "Campaign"].map(
        (source) => ({
          source,
          inquiries: y.records.inquiries.filter((i) => i.source === source)
            .length,
          enrolled: y.records.inquiries.filter(
            (i) => i.source === source && i.stage === "enrolled",
          ).length,
        }),
      );
    case "exam-schedule":
      return y.records.papers.map((p) => ({
        ...p,
        className: cohort(p.classSectionId),
        invigilator: staff(p.invigilatorId),
      }));
    case "payments":
      return y.records.payments.map((p) => ({
        ...p,
        invoice: y.records.invoices.find((i) => i.id === p.invoiceId)
          ?.reference,
      }));
    case "concessions":
      return y.records.approvals.filter((a) => a.category === "concession");
    case "promotions":
      return y.records.promotions.map((p) => ({
        ...p,
        student: student(p.studentId),
        targetClass: cohort(p.targetClassId),
      }));
    case "staff-documents":
      return y.records.staffProfiles.flatMap((p) =>
        p.documents.map((d) => ({
          staff: staff(p.staffId),
          name: d.name,
          status: d.status,
          size: d.size,
        })),
      );
    case "class-capacity":
      return y.setup.classes.map((c) => ({
        cohort: cohort(c.id),
        enrolled: y.setup.students.filter((s) => s.classSectionId === c.id)
          .length,
        capacity: c.capacity,
      }));
    case "allocations":
      return y.setup.allocations.map((a) => ({
        ...a,
        className: cohort(a.classSectionId),
        staff: staff(a.staffId),
      }));
    case "syllabus":
      return y.records.units;
    case "lessons":
      return y.records.lessons.map((l) => ({
        ...l,
        teacher: staff(l.staffId),
      }));
    case "homework":
      return y.records.submissions.map((s) => ({
        ...s,
        student: student(s.studentId),
        task: y.records.homework.find((h) => h.id === s.homeworkId)?.title,
      }));
    case "certificates":
      return y.records.certificates.map((c) => ({
        ...c,
        student: student(c.studentId),
      }));
    case "notice-recipients":
      return y.records.notices.flatMap((n) =>
        n.recipientIds.map((id) => ({
          notice: n.title,
          recipient:
            y.setup.guardians.find((g) => g.id === id)?.displayName ??
            staff(id),
          channels: n.channels.join("; "),
          dispatch: "In-app delivery; external providers disconnected",
          acknowledged: n.acknowledgedIds.includes(id),
        })),
      );
    case "roles":
      return y.records.roles;
    case "enrolments":
      return y.setup.relationships.map((l) => ({
        ...l,
        student: student(l.studentId),
        guardian:
          y.setup.guardians.find((g) => g.id === l.guardianId)?.displayName ??
          "",
      }));
    case "reenrolment":
      return y.records.reenrolments.map((r) => ({
        ...r,
        student: student(r.studentId),
      }));
    case "room-reservations":
      return y.records.reservations;
    case "health":
      return y.records.studentProfiles.map((p) => ({
        student: student(p.studentId),
        dateOfBirth: p.dateOfBirth,
        bloodGroup: p.bloodGroup,
        medicalNotes: p.medicalNotes,
        emergencyContact: p.emergencyName,
        emergencyPhone: p.emergencyPhone,
      }));
    case "transport":
      return y.records.routes.map((r) => ({
        ...r,
        assignedStudents: y.records.studentProfiles
          .filter((p) => p.routeId === r.id && p.status === "active")
          .map((p) => student(p.studentId))
          .join("; "),
        telemetry:
          "No GPS provider connected; workspace route records only",
      }));
  }
}
export function buildExport(y: SchoolYearWorkspace, report: ReportKey) {
  const rows = reportRows(y, report);
  return {
    ...scope(y),
    id: crypto.randomUUID(),
    report,
    createdAt: new Date().toISOString(),
    format: "csv" as const,
    rowCount: rows.length,
    status: "ready" as const,
    content: csvExport(rows),
    filename: report + ".csv",
  };
}
export function runScheduledJobs(y: SchoolYearWorkspace, throughDate: string) {
  localDateSchema.parse(throughDate);
  let next = structuredClone(y);
  for (const notice of next.records.notices.filter(
    (n) =>
      n.status === "scheduled" &&
      n.scheduledFor &&
      n.scheduledFor <= throughDate,
  ))
    next = publishNotice(next, notice.id);
  for (const schedule of next.records.reportSchedules.filter(
    (s) => s.enabled && s.nextRun <= throughDate,
  )) {
    next.records.exports = [
      ...next.records.exports,
      buildExport(next, schedule.report),
    ].slice(-200);
    const date = new Date(throughDate + "T00:00:00Z");
    if (schedule.frequency === "monthly") {
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
    } else
      date.setUTCDate(
        date.getUTCDate() + (schedule.frequency === "weekly" ? 7 : 1),
      );
    next = putRecord(next, "reportSchedules", {
      ...schedule,
      lastRun: throughDate,
      nextRun: date.toISOString().slice(0, 10),
    });
  }
  return next;
}
