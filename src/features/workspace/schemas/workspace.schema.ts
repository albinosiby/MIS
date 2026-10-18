import { bankImportSchema } from "../../fees/schemas/bank-reconciliation.schema.ts";
import {
  classAtDate,
  hasClassMembership,
} from "../../students/domain/class-history.ts";
import { workflowStateSchema } from "./workflow-state.schema.ts";
import { operationRecordSchema } from "../../operations/schemas/operations.schema.ts";
import { validateOperationalRecords } from "../../operations/domain/validation.ts";
import { z } from "zod";
import { roomOccupied } from "../domain/room-occupancy.ts";
import { canonicalSetupConfigSchema } from "../../school-setup/schemas/setup-config.schema.ts";
import { subjectSchema } from "../../../shared/schemas/workflow.ts";
import {
  inquirySchema,
  admissionFormSchema,
  reenrolmentSchema,
} from "../../admissions/schemas/admissions.schema.ts";
import {
  studentProfileSchema,
  busRouteSchema,
  certificateSchema,
  promotionSchema,
} from "../../students/schemas/students.schema.ts";
import {
  staffProfileSchema,
  roleSchema,
} from "../../staff/schemas/staff.schema.ts";
import {
  attendanceRecordSchema,
  leaveRequestSchema,
} from "../../attendance/schemas/attendance.schema.ts";
import {
  timetableSlotSchema,
  substitutionSchema,
  roomSchema,
  roomReservationSchema,
} from "../../timetable/schemas/timetable.schema.ts";
import {
  syllabusUnitSchema,
  lessonPlanSchema,
  homeworkSchema,
  homeworkSubmissionSchema,
} from "../../academics/schemas/academics.schema.ts";
import {
  examCycleSchema,
  examPaperSchema,
  examMarkSchema,
} from "../../exams/schemas/exams.schema.ts";
import {
  invoiceSchema,
  paymentSchema,
} from "../../fees/schemas/fees.schema.ts";
import {
  academicEventSchema,
  noticeSchema,
  notificationSchema,
  exportJobSchema,
  reportScheduleSchema,
} from "../../communication/schemas/communication.schema.ts";
import {
  preferenceSchema,
  approvalSchema,
} from "../../settings/schemas/settings.schema.ts";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const moduleRecordsSchema = z.strictObject({
  subjects: z.array(subjectSchema).max(100),
  inquiries: z.array(inquirySchema).max(2000),
  admissionForms: z.array(admissionFormSchema).max(10),
  reenrolments: z.array(reenrolmentSchema).max(2000),
  studentProfiles: z.array(studentProfileSchema).max(2000),
  routes: z.array(busRouteSchema).max(100),
  certificates: z.array(certificateSchema).max(5000),
  promotions: z.array(promotionSchema).max(2000),
  staffProfiles: z.array(staffProfileSchema).max(200),
  roles: z.array(roleSchema).max(30),
  attendance: z.array(attendanceRecordSchema).max(30000),
  leaves: z.array(leaveRequestSchema).max(2000),
  rooms: z.array(roomSchema).max(200).default([]),
  reservations: z.array(roomReservationSchema).max(5000).default([]),
  slots: z.array(timetableSlotSchema).max(5000),
  substitutions: z.array(substitutionSchema).max(2000),
  units: z.array(syllabusUnitSchema).max(2000),
  lessons: z.array(lessonPlanSchema).max(5000),
  homework: z.array(homeworkSchema).max(2000),
  submissions: z.array(homeworkSubmissionSchema).max(10000),
  exams: z.array(examCycleSchema).max(100),
  papers: z.array(examPaperSchema).max(1000),
  marks: z.array(examMarkSchema).max(20000),
  invoices: z.array(invoiceSchema).max(5000),
  payments: z.array(paymentSchema).max(10000),
  events: z.array(academicEventSchema).max(2000),
  notices: z.array(noticeSchema).max(2000),
  notifications: z.array(notificationSchema).max(2000),
  reportSchedules: z.array(reportScheduleSchema).max(200).default([]),
  exports: z.array(exportJobSchema).max(200),
  approvals: z.array(approvalSchema).max(2000),
  preferences: preferenceSchema,
});
export const schoolYearWorkspaceSchema = z
  .strictObject({
    setup: canonicalSetupConfigSchema,
    records: moduleRecordsSchema,
    extensions: z.array(operationRecordSchema).max(20000).default([]),
    locked: z.boolean().default(false),
    workflows: workflowStateSchema.default(() => workflowStateSchema.parse({})),
  })
  .superRefine(({ setup: s, records: r, extensions, workflows: w }, ctx) => {
    const matchedJournals = new Set<string>();
    if (
      new Set(
        w.bankStatements
          .filter((s) => !s.voidedAt)
          .map((s) => s.account.toLowerCase()),
      ).size > 1
    )
      ctx.addIssue({
        code: "custom",
        message: "Use one school Bank ledger account label.",
      });

    for (const statement of w.bankStatements) {
      if (
        statement.voidedAt &&
        (!statement.voidedBy ||
          statement.voidReason.trim().length < 8 ||
          statement.closedAt ||
          statement.matches.some((m) => !m.voidedAt))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Only an unmatched open statement can be voided with an actor and reason.",
        });

      const input = {
        account: statement.account,
        from: statement.from,
        to: statement.to,
        openingMinor: statement.openingMinor,
        closingMinor: statement.closingMinor,
        lines: statement.lines.map(({ id: _id, ...line }) => line),
      };
      if (
        !bankImportSchema.safeParse(input).success ||
        statement.from < s.calendar.year.startDate ||
        statement.to > s.calendar.year.endDate
      )
        ctx.addIssue({
          code: "custom",
          path: ["workflows", "bankStatements"],
          message: "Invalid bank statement dates or balances.",
        });
      const matchedLines = new Set<string>();
      for (const match of statement.matches) {
        if (match.voidedAt) {
          if (!match.voidedBy || match.voidReason.trim().length < 8)
            ctx.addIssue({
              code: "custom",
              message: "Match corrections require an actor and reason.",
            });
          continue;
        }
        const line = statement.lines.find((l) => l.id === match.lineId),
          journal = w.ledger.find((j) => j.id === match.journalId),
          net = journal?.lines
            .filter((l) => l.account === "Bank")
            .reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0);
        if (
          !line ||
          !journal ||
          journal.date !== line.date ||
          net !== line.amountMinor ||
          matchedLines.has(match.lineId) ||
          matchedJournals.has(match.journalId)
        )
          ctx.addIssue({
            code: "custom",
            path: ["workflows", "bankStatements"],
            message:
              "Bank matches must uniquely reference a posted bank movement with the same date and amount.",
          });
        matchedLines.add(match.lineId);
        matchedJournals.add(match.journalId);
      }
      if (
        statement.closedAt &&
        w.ledger
          .filter((j) => j.date < statement.from)
          .flatMap((j) => j.lines)
          .filter((l) => l.account === "Bank")
          .reduce((sum, l) => sum + l.debitMinor - l.creditMinor, 0) !==
          statement.openingMinor
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Posted bank movements cannot change a reconciled opening balance.",
        });
      if (
        statement.closedAt &&
        w.ledger.some(
          (j) =>
            j.date >= statement.from &&
            j.date <= statement.to &&
            j.lines.some((l) => l.account === "Bank") &&
            !statement.matches.some((m) => !m.voidedAt && m.journalId === j.id),
        )
      )
        ctx.addIssue({
          code: "custom",
          message:
            "A reconciled period cannot contain unmatched or newly backdated bank movements.",
        });
      if (
        Boolean(statement.closedAt) !== Boolean(statement.closedBy) ||
        (statement.closedAt &&
          (statement.matches.filter((m) => !m.voidedAt).length !==
            statement.lines.length ||
            statement.importedBy === statement.closedBy ||
            statement.matches.some(
              (m) => !m.voidedAt && m.matchedBy === statement.closedBy,
            )))
      )
        ctx.addIssue({
          code: "custom",
          path: ["workflows", "bankStatements"],
          message:
            "Reconciliation requires all lines matched and an independent finance reviewer.",
        });
    }
    try {
      validateOperationalRecords(extensions, {
        schoolId: s.school.id,
        academicYearId: s.calendar.year.id,
        studentClasses: Object.fromEntries(
          s.students.map((student) => [
            student.id,
            [
              student.classSectionId,
              ...w.studentEvents
                .filter(
                  (e) =>
                    e.studentId === student.id && e.kind === "class-changed",
                )
                .flatMap((e) =>
                  [e.fromClassId, e.toClassId].filter((id): id is string =>
                    Boolean(id),
                  ),
                ),
            ],
          ]),
        ),
        ids: {
          students: s.students.map((v) => v.id),
          staff: s.staff.map((v) => v.id),
          classes: s.classes.map((v) => v.id),
          ...Object.fromEntries(
            Object.entries(r)
              .filter(([, v]) => Array.isArray(v))
              .map(([k, v]) => [k, (v as { id: string }[]).map((x) => x.id)]),
          ),
        },
        invoices: r.invoices.map((i) => ({
          id: i.id,
          studentId: i.studentId,
          amountMinor:
            i.lines.reduce((s, l) => s + l.amountMinor, 0) - i.concessionMinor,
          status: i.status,
        })),
        payments: r.payments.map((p) => ({
          ...p,
          studentId:
            r.invoices.find((i) => i.id === p.invoiceId)?.studentId ?? "",
        })),
      });
    } catch (e) {
      ctx.addIssue({
        code: "custom",
        path: ["extensions"],
        message: e instanceof Error ? e.message : "Invalid operational records",
      });
    }
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const scope = { schoolId: s.school.id, academicYearId: s.calendar.year.id };
    for (const [name, rows] of Object.entries(r)) {
      if (!Array.isArray(rows)) continue;
      const ids = new Set<string>();
      rows.forEach((record, index) => {
        if (ids.has(record.id))
          issue(["records", name, index, "id"], "Record IDs must be unique");
        ids.add(record.id);
        if (
          record.schoolId !== scope.schoolId ||
          record.academicYearId !== scope.academicYearId
        )
          issue(
            ["records", name, index],
            "Record belongs to another school or academic year",
          );
      });
    }
    const studentIds = new Set(s.students.map((v) => v.id)),
      staffIds = new Set(s.staff.map((v) => v.id)),
      classIds = new Set(s.classes.map((v) => v.id)),
      guardianIds = new Set(s.guardians.map((v) => v.id)),
      subjectIds = new Set(r.subjects.map((v) => v.id)),
      periodIds = new Set(
        s.bells.filter((b) => b.kind === "period").map((v) => v.id),
      );
    const ref = (set: Set<string>, id: string, path: (string | number)[]) => {
      if (!set.has(id))
        issue(path, "Referenced record does not exist in this school/year");
    };
    const inactiveStudents = new Set(
      r.studentProfiles
        .filter((p) => p.status !== "active")
        .map((p) => p.studentId),
    );
    for (const cohort of s.classes)
      if (
        s.students.filter(
          (student) =>
            student.classSectionId === cohort.id &&
            !inactiveStudents.has(student.id),
        ).length > cohort.capacity
      )
        issue(
          ["setup", "classes"],
          "Capacity cannot be below active enrolled student count.",
        );
    for (const progress of w.learningProgress) {
      ref(studentIds, progress.studentId, ["workflows", "learningProgress"]);
      ref(
        new Set(
          extensions.filter((r) => r.kind === "resources").map((r) => r.id),
        ),
        progress.resourceId,
        ["workflows", "learningProgress"],
      );
    }
    for (const decision of w.admissionDecisions) {
      ref(studentIds, decision.studentId, ["workflows", "admissionDecisions"]);
      if (decision.targetClassId)
        ref(classIds, decision.targetClassId, [
          "workflows",
          "admissionDecisions",
        ]);
      for (const id of decision.affectedInvoiceIds)
        ref(new Set(r.invoices.map((i) => i.id)), id, [
          "workflows",
          "admissionDecisions",
        ]);
    }
    for (const review of w.resultReviews) {
      ref(studentIds, review.studentId, ["workflows", "resultReviews"]);
      ref(subjectIds, review.subjectId, ["workflows", "resultReviews"]);
      ref(new Set(r.exams.map((e) => e.id)), review.examId, [
        "workflows",
        "resultReviews",
      ]);
      const pub = w.publications.find((p) => p.id === review.publicationId);
      if (
        review.publicationId &&
        (!pub ||
          pub.sourceId !== review.examId ||
          pub.ownerId !== review.studentId ||
          pub.kind !== "report-card")
      )
        issue(
          ["workflows", "resultReviews"],
          "Review must reference its student's report card.",
        );
      if (
        review.correctedPublicationId &&
        !w.publications.some(
          (p) =>
            p.id === review.correctedPublicationId &&
            p.ownerId === review.studentId &&
            p.sourceId === review.examId,
        )
      )
        issue(
          ["workflows", "resultReviews"],
          "Corrected result must belong to this review.",
        );
    }
    for (const version of w.timetableVersions) {
      if (
        version.slots.some(
          (slot) =>
            slot.schoolId !== s.school.id ||
            slot.academicYearId !== s.calendar.year.id,
        ) ||
        new Set(version.slots.map((slot) => slot.id)).size !==
          version.slots.length
      )
        issue(
          ["workflows", "timetableVersions"],
          "Timetable version has invalid school/year scope or duplicate slots.",
        );
    }
    for (const review of w.substitutionReviews) {
      if (
        review.substitution.schoolId !== s.school.id ||
        review.substitution.academicYearId !== s.calendar.year.id
      )
        issue(
          ["workflows", "substitutionReviews"],
          "Substitution review belongs to another school/year.",
        );
    }
    for (const release of w.websiteReleases)
      if (release.schoolId !== s.school.id)
        ctx.addIssue({
          code: "custom",
          path: ["workflows", "websiteReleases"],
          message: "Website releases must belong to this school.",
        });
    for (const event of w.studentEvents) {
      ref(studentIds, event.studentId, ["workflows", "studentEvents"]);
      if (event.fromClassId)
        ref(classIds, event.fromClassId, ["workflows", "studentEvents"]);
      if (event.toClassId)
        ref(classIds, event.toClassId, ["workflows", "studentEvents"]);
    }
    for (const plan of w.salaryPlans)
      ref(staffIds, plan.staffId, ["workflows", "salaryPlans"]);
    for (const run of w.payrollRuns)
      for (const line of run.lines)
        ref(staffIds, line.staffId, ["workflows", "payrollRuns"]);
    for (const event of w.employmentEvents)
      ref(staffIds, event.staffId, ["workflows", "employmentEvents"]);
    for (const plan of w.feePlans)
      ref(studentIds, plan.studentId, ["workflows", "feePlans"]);
    for (const value of w.customValues)
      ref(
        value.entity === "student"
          ? studentIds
          : value.entity === "staff"
            ? staffIds
            : new Set(r.inquiries.map((i) => i.id)),
        value.ownerId,
        ["workflows", "customValues"],
      );
    for (const pub of w.publications) {
      if (pub.ownerType === "school" && pub.ownerId !== s.school.id)
        issue(
          ["workflows", "publications"],
          "Publication belongs to another school",
        );
      else if (pub.ownerType !== "school")
        ref(pub.ownerType === "student" ? studentIds : staffIds, pub.ownerId, [
          "workflows",
          "publications",
        ]);
    }
    for (const schedule of w.reportSchedules)
      ref(new Set(w.reportBuilders.map((b) => b.id)), schedule.reportId, [
        "workflows",
        "reportSchedules",
      ]);
    const unique = (name: string, values: string[]) => {
      if (new Set(values).size !== values.length)
        issue(["records", name], "Duplicate record combination");
    };
    unique(
      "studentProfiles",
      r.studentProfiles.map((v) => v.studentId),
    );
    unique(
      "staffProfiles",
      r.staffProfiles.map((v) => v.staffId),
    );
    unique(
      "subjects",
      r.subjects.map((v) => v.code.toLowerCase()),
    );
    unique(
      "attendance",
      r.attendance.map(
        (v) => `${v.personType}:${v.personId}:${v.date}:${v.periodId ?? "day"}`,
      ),
    );
    unique(
      "marks",
      r.marks.map((v) => `${v.examId}:${v.studentId}:${v.subjectId}`),
    );
    unique(
      "payments",
      r.payments.map((v) => v.idempotencyKey),
    );
    unique(
      "submissions",
      r.submissions.map((v) => `${v.homeworkId}:${v.studentId}`),
    );
    unique(
      "reenrolments",
      r.reenrolments.map((v) => v.studentId),
    );
    unique(
      "promotions",
      r.promotions.map((v) => v.studentId),
    );
    const scopedDate = (date: string, path: (string | number)[]) => {
      if (date < s.calendar.year.startDate || date > s.calendar.year.endDate)
        issue(path, "Date must be within the selected academic year");
    };
    r.admissionForms.forEach((v, i) => {
      unique(
        "admissionForms",
        v.fields.map((f) => f.id),
      );
      for (const f of v.fields)
        if (f.type === "select" && !f.options.split(",").some((x) => x.trim()))
          issue(
            ["records", "admissionForms", i],
            "Select fields require comma-separated choices",
          );
    });
    r.reportSchedules.forEach((v, i) =>
      v.recipientIds.forEach((id) =>
        ref(staffIds, id, ["records", "reportSchedules", i]),
      ),
    );
    r.approvals.forEach((v, i) => {
      ref(new Set([...staffIds, ...studentIds]), v.requesterId, [
        "records",
        "approvals",
        i,
      ]);
      if (v.category === "concession")
        ref(new Set(r.invoices.map((x) => x.id)), v.targetId ?? "", [
          "records",
          "approvals",
          i,
        ]);
      if (v.category === "exam_unlock")
        ref(new Set(r.exams.map((x) => x.id)), v.targetId ?? "", [
          "records",
          "approvals",
          i,
        ]);
    });
    r.inquiries.forEach((v, i) => {
      ref(classIds, v.classSectionId, ["records", "inquiries", i]);
      if (v.siblingStudentId)
        ref(studentIds, v.siblingStudentId, ["records", "inquiries", i]);
      if (v.counselorId)
        ref(staffIds, v.counselorId, [
          "records",
          "inquiries",
          i,
          "counselorId",
        ]);
      if (v.studentId)
        ref(studentIds, v.studentId, ["records", "inquiries", i, "studentId"]);
      if (v.stage === "enrolled" && !v.studentId)
        issue(
          ["records", "inquiries", i, "stage"],
          "Enrolled inquiry must link a student",
        );
    });
    w.studentEvents.forEach((e) =>
      scopedDate(e.date, ["workflows", "studentEvents"]),
    );
    w.employmentEvents.forEach((e) =>
      scopedDate(e.date, ["workflows", "employmentEvents"]),
    );
    r.studentProfiles.forEach((v, i) => {
      ref(studentIds, v.studentId, ["records", "studentProfiles", i]);
      if (v.routeId)
        ref(new Set(r.routes.map((v) => v.id)), v.routeId, [
          "records",
          "studentProfiles",
          i,
          "routeId",
        ]);
    });
    r.routes.forEach((v, i) => {
      if (
        r.studentProfiles.filter(
          (p) => p.routeId === v.id && p.status === "active",
        ).length > v.capacity
      )
        issue(["records", "routes", i, "capacity"], "Route capacity exceeded");
    });
    r.staffProfiles.forEach((v, i) => {
      ref(staffIds, v.staffId, ["records", "staffProfiles", i]);
      ref(new Set(r.roles.map((v) => v.id)), v.roleId, [
        "records",
        "staffProfiles",
        i,
        "roleId",
      ]);
    });
    r.attendance.forEach((v, i) => {
      ref(v.personType === "student" ? studentIds : staffIds, v.personId, [
        "records",
        "attendance",
        i,
      ]);
      scopedDate(v.date, ["records", "attendance", i, "date"]);
      if (v.periodId)
        ref(periodIds, v.periodId, ["records", "attendance", i, "periodId"]);
    });
    r.leaves.forEach((v, i) => {
      ref(v.personType === "student" ? studentIds : staffIds, v.personId, [
        "records",
        "leaves",
        i,
      ]);
      scopedDate(v.dates.startDate, ["records", "leaves", i, "dates"]);
      scopedDate(v.dates.endDate, ["records", "leaves", i, "dates"]);
    });
    r.slots.forEach((v, i) => {
      ref(classIds, v.classSectionId, [
        "records",
        "slots",
        i,
        "classSectionId",
      ]);
      ref(staffIds, v.staffId, ["records", "slots", i, "staffId"]);
      ref(subjectIds, v.subjectId, ["records", "slots", i, "subjectId"]);
      ref(periodIds, v.periodId, ["records", "slots", i, "periodId"]);
      if (
        r.slots
          .slice(0, i)
          .some(
            (p) =>
              p.weekday === v.weekday &&
              p.periodId === v.periodId &&
              (p.classSectionId === v.classSectionId ||
                p.staffId === v.staffId ||
                p.room.toLowerCase() === v.room.toLowerCase()),
          )
      )
        issue(
          ["records", "slots", i],
          "Class, teacher or room has a timetable clash",
        );
    });
    r.substitutions.forEach((v, i) => {
      const slot = r.slots.find((p) => p.id === v.slotId);
      if (!slot) {
        issue(
          ["records", "substitutions", i],
          "Choose an existing timetable slot",
        );
        return;
      }
      scopedDate(v.date, ["records", "substitutions", i]);
      const weekday = new Date(v.date + "T00:00:00Z").toLocaleDateString(
        "en-US",
        { weekday: "long", timeZone: "UTC" },
      );
      if (weekday !== slot.weekday)
        issue(
          ["records", "substitutions", i],
          "Substitution date must match the slot weekday",
        );
      if (
        r.leaves.some(
          (l) =>
            l.status === "approved" &&
            l.personType === "staff" &&
            l.personId === v.substituteStaffId &&
            l.dates.startDate <= v.date &&
            l.dates.endDate >= v.date,
        )
      )
        issue(
          ["records", "substitutions", i],
          "Substitute is on approved leave",
        );
      ref(staffIds, v.substituteStaffId, ["records", "substitutions", i]);
      if (
        v.absentStaffId !== slot.staffId ||
        v.substituteStaffId === v.absentStaffId
      )
        issue(
          ["records", "substitutions", i],
          "Choose a different available substitute for this slot",
        );
      if (
        r.slots.some(
          (p) =>
            p.staffId === v.substituteStaffId &&
            p.weekday === slot.weekday &&
            p.periodId === slot.periodId,
        )
      )
        issue(
          ["records", "substitutions", i],
          "Substitute already teaches in this period",
        );
      if (
        r.substitutions
          .slice(0, i)
          .some(
            (p) =>
              p.date === v.date &&
              (p.slotId === v.slotId ||
                (p.substituteStaffId === v.substituteStaffId &&
                  r.slots.find((q) => q.id === p.slotId)?.periodId ===
                    slot.periodId)),
          )
      )
        issue(
          ["records", "substitutions", i],
          "Duplicate substitution or substitute period clash",
        );
    });
    r.reservations.forEach((v, i) => {
      scopedDate(v.date, ["records", "reservations", i]);
      ref(periodIds, v.periodId, ["records", "reservations", i]);
      if (r.rooms.length && !r.rooms.some((room) => room.name === v.room))
        issue(["records", "reservations", i], "Choose an existing room");
      if (roomOccupied(r, v.date, v.periodId, v.room, { reservationId: v.id }))
        issue(
          ["records", "reservations", i],
          "Room is already occupied in this period",
        );
    });
    r.units.forEach((v, i) => {
      ref(classIds, v.classSectionId, ["records", "units", i]);
      ref(subjectIds, v.subjectId, ["records", "units", i]);
    });
    r.lessons.forEach((v, i) => {
      ref(new Set(r.units.map((u) => u.id)), v.unitId, [
        "records",
        "lessons",
        i,
      ]);
      ref(staffIds, v.staffId, ["records", "lessons", i]);
      scopedDate(v.date, ["records", "lessons", i, "date"]);
    });
    r.homework.forEach((v, i) => {
      ref(classIds, v.classSectionId, ["records", "homework", i]);
      ref(subjectIds, v.subjectId, ["records", "homework", i]);
      ref(staffIds, v.staffId, ["records", "homework", i]);
      scopedDate(v.dueDate, ["records", "homework", i, "dueDate"]);
    });
    r.submissions.forEach((v, i) => {
      const hw = r.homework.find((h) => h.id === v.homeworkId);
      const student = s.students.find((st) => st.id === v.studentId);
      if (
        !hw ||
        !student ||
        !hasClassMembership(
          student.classSectionId,
          w.studentEvents,
          student.id,
          hw.classSectionId,
        )
      )
        issue(
          ["records", "submissions", i],
          "Submission must belong to a student in the assigned class",
        );
      if (hw && v.score !== null && v.score > hw.maxScore)
        issue(["records", "submissions", i, "score"], "Score exceeds maximum");
      if ((v.status === "graded") !== (v.score !== null))
        issue(
          ["records", "submissions", i, "score"],
          "Only graded submissions must have a score",
        );
    });
    r.exams.forEach((v, i) => {
      v.classSectionIds.forEach((id) =>
        ref(classIds, id, ["records", "exams", i]),
      );
      v.subjectIds.forEach((id) =>
        ref(subjectIds, id, ["records", "exams", i]),
      );
      scopedDate(v.dates.startDate, ["records", "exams", i, "dates"]);
      scopedDate(v.dates.endDate, ["records", "exams", i, "dates"]);
    });
    r.papers.forEach((v, i) => {
      const exam = r.exams.find((e) => e.id === v.examId);
      if (
        !exam ||
        !exam.classSectionIds.includes(v.classSectionId) ||
        !exam.subjectIds.includes(v.subjectId) ||
        v.date < exam.dates.startDate ||
        v.date > exam.dates.endDate
      )
        issue(
          ["records", "papers", i],
          "Paper must belong to its exam subjects and date range",
        );
      ref(staffIds, v.invigilatorId, ["records", "papers", i]);
      ref(periodIds, v.periodId, ["records", "papers", i]);
      if (roomOccupied({ ...r, papers: [] }, v.date, v.periodId, v.room))
        issue(
          ["records", "papers", i],
          "Exam room conflicts with a class or facility reservation",
        );
      if (
        r.papers
          .slice(0, i)
          .some(
            (p) =>
              p.date === v.date &&
              p.periodId === v.periodId &&
              (p.room === v.room ||
                p.invigilatorId === v.invigilatorId ||
                p.classSectionId === v.classSectionId),
          )
      )
        issue(
          ["records", "papers", i],
          "Exam room, cohort or invigilator clash",
        );
    });
    r.marks.forEach((v, i) => {
      const exam = r.exams.find((e) => e.id === v.examId),
        student = s.students.find((st) => st.id === v.studentId);
      if (
        !exam ||
        !student ||
        !exam.classSectionIds.some((id) =>
          hasClassMembership(
            student.classSectionId,
            w.studentEvents,
            student.id,
            id,
          ),
        ) ||
        !exam.subjectIds.includes(v.subjectId)
      )
        issue(
          ["records", "marks", i],
          "Marks must belong to an eligible exam student and subject",
        );
      if (exam && v.marks > exam.maxMarks)
        issue(["records", "marks", i, "marks"], "Marks exceed exam maximum");
    });
    r.invoices.forEach((v, i) => {
      ref(studentIds, v.studentId, ["records", "invoices", i]);
      const total =
        v.lines.reduce((a, l) => a + l.amountMinor, 0) - v.concessionMinor;
      const paid = r.payments
        .filter((p) => p.invoiceId === v.id && p.status === "completed")
        .reduce((a, p) => a + p.amountMinor - p.refundedMinor, 0);
      if (paid > total)
        issue(["records", "invoices", i], "Payments exceed invoice total");
    });
    r.payments.forEach((v, i) => {
      const invoice = r.invoices.find((n) => n.id === v.invoiceId);
      if (
        !invoice ||
        (invoice.status === "void" &&
          v.status === "completed" &&
          v.amountMinor > v.refundedMinor)
      )
        issue(
          ["records", "payments", i],
          "Payment must reference an issued invoice",
        );
    });
    r.events.forEach((v, i) => {
      if (
        v.startTime &&
        v.endTime &&
        v.dates.startDate === v.dates.endDate &&
        v.startTime >= v.endTime
      )
        issue(
          ["records", "events", i],
          "Event end time must follow start time",
        );
      scopedDate(v.dates.startDate, ["records", "events", i, "dates"]);
      scopedDate(v.dates.endDate, ["records", "events", i, "dates"]);
      v.classSectionIds.forEach((id) =>
        ref(classIds, id, ["records", "events", i]),
      );
    });
    r.notices.forEach((v, i) => {
      v.classSectionIds.forEach((id) =>
        ref(classIds, id, ["records", "notices", i]),
      );
      v.recipientIds.forEach((id) =>
        ref(new Set([...guardianIds, ...staffIds, ...studentIds]), id, [
          "records",
          "notices",
          i,
        ]),
      );
      if (v.acknowledgedIds.some((id) => !v.recipientIds.includes(id)))
        issue(
          ["records", "notices", i],
          "Acknowledgment must belong to a recipient",
        );
      if (v.status === "scheduled" && !v.scheduledFor)
        issue(
          ["records", "notices", i, "scheduledFor"],
          "Choose a scheduled date",
        );
    });
    r.certificates.forEach((v, i) =>
      ref(studentIds, v.studentId, ["records", "certificates", i]),
    );
    r.promotions.forEach((v, i) => {
      ref(studentIds, v.studentId, ["records", "promotions", i]);
      ref(classIds, v.targetClassId, ["records", "promotions", i]);
    });
    r.reenrolments.forEach((v, i) =>
      ref(studentIds, v.studentId, ["records", "reenrolments", i]),
    );
  });
export const workspaceSchema = z
  .strictObject({
    version: z.literal(2),
    revision: z.number().int().nonnegative(),
    activeYearId: identifierSchema,
    years: z.array(schoolYearWorkspaceSchema).min(1).max(10),
  })
  .superRefine((v, ctx) => {
    if (!v.years.some((y) => y.setup.calendar.year.id === v.activeYearId))
      ctx.addIssue({
        code: "custom",
        path: ["activeYearId"],
        message: "Choose an existing academic year",
      });
    if (
      new Set(v.years.map((y) => y.setup.calendar.year.id)).size !==
      v.years.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["years"],
        message: "Academic years must be unique",
      });
    if (v.years.some((y) => y.setup.school.id !== v.years[0].setup.school.id))
      ctx.addIssue({
        code: "custom",
        path: ["years"],
        message: "All academic years must belong to the same school",
      });
  });
