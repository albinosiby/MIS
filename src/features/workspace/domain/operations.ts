import {
  staffLeaveEntitlement,
  leaveWorkingDates,
} from "../../attendance/domain/leave-policy.ts";
import type { SchoolYearWorkspace, ModuleRecords } from "../models/index.ts";
import { schoolYearWorkspaceSchema } from "../schemas/workspace.schema.ts";
import { inquirySchema } from "../../admissions/schemas/admissions.schema.ts";
import { paymentSchema } from "../../fees/schemas/fees.schema.ts";
import { enrolStudentRequestSchema as enrolStudentSchema } from "../../students/schemas/students.schema.ts";
export type Collection = Exclude<keyof ModuleRecords, "preferences">;
export function scope(y: SchoolYearWorkspace) {
  return {
    schoolId: y.setup.school.id,
    academicYearId: y.setup.calendar.year.id,
  };
}
export function putRecord(
  y: SchoolYearWorkspace,
  key: Collection,
  input: unknown,
): SchoolYearWorkspace {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid record");
  let row: Record<string, unknown> = { ...input, ...scope(y) };
  if (!("id" in row) || typeof row.id !== "string")
    throw new Error("Record ID required");
  if (key === "slots") {
    const previous = y.records.slots.find(s=>s.id===row.id);
    if (previous?.status === "published" && ["classSectionId","staffId","subjectId","weekday","periodId","room"].some(field=>JSON.stringify(row[field])!==JSON.stringify(previous[field as keyof typeof previous]))) row = { ...row, status: "draft" };
  }
  if (key === "notices") {
    const previous = y.records.notices.find((n) => n.id === row.id);
    if (
      previous?.status === "published" &&
      [
        "title",
        "body",
        "priority",
        "audience",
        "classSectionIds",
        "channels",
        "scheduledFor",
      ].some(
        (field) =>
          JSON.stringify(row[field]) !==
          JSON.stringify(previous[field as keyof typeof previous]),
      )
    )
      row = { ...row, status: "draft", recipientIds: [], acknowledgedIds: [] };
  }
  if (key === "lessons") {
    const previous = y.records.lessons.find((n) => n.id === row.id);
    if (
      previous?.status === "approved" &&
      row.status === "approved" &&
      ["unitId", "staffId", "title", "date", "objectives"].some(
        (field) =>
          JSON.stringify(row[field]) !==
          JSON.stringify(previous[field as keyof typeof previous]),
      )
    )
      row = { ...row, status: "draft" };
  }
  let setup = y.setup;
  if (key === "subjects") {
    const previous = y.records.subjects.find((n) => n.id === row.id);
    if (previous && typeof row.name === "string" && previous.name !== row.name)
      setup = {
        ...setup,
        allocations: setup.allocations.map((a) =>
          a.subject === previous.name
            ? { ...a, subject: row.name as string }
            : a,
        ),
      };
  }
  const records = {
    ...y.records,
    [key]: y.records[key].some((r) => r.id === row.id)
      ? y.records[key].map((r) => (r.id === row.id ? row : r))
      : [...y.records[key], row],
  };
  return schoolYearWorkspaceSchema.parse({ ...y, setup, records });
}
export function removeRecord(
  y: SchoolYearWorkspace,
  key: Collection,
  id: string,
) {
  if (!y.records[key].some((r) => r.id === id))
    throw new Error("Record no longer exists.");
  return schoolYearWorkspaceSchema.parse({
    ...y,
    records: { ...y.records, [key]: y.records[key].filter((r) => r.id !== id) },
  });
}
export function balance(y: SchoolYearWorkspace, invoiceId: string) {
  const invoice = y.records.invoices.find((r) => r.id === invoiceId);
  if (!invoice || invoice.status === "void") return 0;
  return (
    invoice.lines.reduce((s, l) => s + l.amountMinor, 0) -
    invoice.concessionMinor -
    y.records.payments
      .filter((p) => p.invoiceId === invoice.id && p.status === "completed")
      .reduce((s, p) => s + p.amountMinor - p.refundedMinor, 0)
  );
}
export function takePayment(y: SchoolYearWorkspace, input: unknown) {
  const payment = paymentSchema.parse(input);
  if (payment.refundedMinor)
    throw new Error("New collections cannot include a refund.");
  const invoice = y.records.invoices.find((i) => i.id === payment.invoiceId);
  if (
    !invoice ||
    invoice.status !== "issued" ||
    payment.schoolId !== y.setup.school.id ||
    payment.academicYearId !== y.setup.calendar.year.id
  )
    throw new Error("Invoice is unavailable in this school/year.");
  const existing = y.records.payments.find(
    (p) => p.idempotencyKey === payment.idempotencyKey,
  );
  if (existing) {
    if (
      existing.invoiceId !== payment.invoiceId ||
      existing.amountMinor !== payment.amountMinor
    )
      throw new Error("Payment key already used for a different transaction.");
    return y;
  }
  if (payment.amountMinor > balance(y, invoice.id))
    throw new Error("Payment exceeds the outstanding balance.");
  return putRecord(y, "payments", payment);
}
export function progressInquiry(
  y: SchoolYearWorkspace,
  id: string,
  next: string,
) {
  const record = y.records.inquiries.find((r) => r.id === id);
  if (!record) throw new Error("Inquiry no longer exists.");
  if (next === "enrolled")
    throw new Error("Complete student enrolment to confirm this admission.");
  if (record.stage === "enrolled")
    throw new Error(
      "An enrolled application cannot return to the prospect pipeline.",
    );
  const transitions: Record<string, string[]> = {
    new: ["contacted", "lost"],
    contacted: ["campus_visit", "application", "lost"],
    campus_visit: ["application", "lost"],
    application: ["assessment", "lost"],
    assessment: ["offered", "waitlisted", "lost"],
    offered: ["waitlisted", "lost"],
    waitlisted: ["offered", "lost"],
    lost: ["new"],
  };
  if (!transitions[record.stage]?.includes(next))
    throw new Error("Complete the preceding admission stage first.");
  if (next === "offered" && record.score === null)
    throw new Error("Record the assessment score before extending an offer.");
  return putRecord(
    y,
    "inquiries",
    inquirySchema.parse({
      ...record,
      stage: next,
      lostReason:
        next === "lost"
          ? record.lostReason || "Closed by administrator."
          : record.lostReason,
    }),
  );
}
export function enrolStudent(y: SchoolYearWorkspace, input: unknown) {
  const v = enrolStudentSchema.parse(input);
  const next = structuredClone(y);
  const sc = scope(y);
  if (y.records.admissionForms[0]?.requireDocuments && !v.inquiryId)
    throw new Error(
      "Create an application and upload its required private files before enrolment.",
    );
  if (v.inquiryId) {
    const inquiry = next.records.inquiries.find((r) => r.id === v.inquiryId);
    if (!inquiry || inquiry.studentId || inquiry.stage !== "offered")
      throw new Error(
        "Choose an eligible application which has not already been enrolled.",
      );
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: y.workflows.advanced.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const issuedOn =
    today < y.setup.calendar.year.startDate
      ? y.setup.calendar.year.startDate
      : today;
  if (issuedOn > y.setup.calendar.year.endDate)
    throw new Error(
      "Choose the current academic year before enrolling a student.",
    );
  const application = v.inquiryId
    ? next.records.inquiries.find((row) => row.id === v.inquiryId)!
    : null;
  if (application?.offerExpiry && application.offerExpiry < issuedOn)
    throw new Error("The offer has expired; extend it before enrolment.");
  if (application && application.classSectionId !== v.classSectionId)
    throw new Error("Enrolment class must match the reviewed offer.");
  const studentId = crypto.randomUUID(),
    guardianId = v.existingGuardianId ?? crypto.randomUUID();
  if (
    v.existingGuardianId &&
    !next.setup.guardians.some((g) => g.id === v.existingGuardianId)
  )
    throw new Error("Choose an existing guardian in this school.");
  next.setup.students.push({
    ...sc,
    id: studentId,
    admissionNumber: v.admissionNumber,
    displayName: v.studentName,
    classSectionId: v.classSectionId,
  });
  if (!v.existingGuardianId)
    next.setup.guardians.push({
      id: guardianId,
      schoolId: sc.schoolId,
      displayName: v.guardianName,
      email: v.email,
      phone: v.phone,
    });
  next.setup.relationships.push({
    schoolId: sc.schoolId,
    studentId,
    guardianId,
    relationship: "parent",
    canViewRecords: true,
    canReceiveNotices: true,
  });
  next.records.studentProfiles.push({
    ...sc,
    id: crypto.randomUUID(),
    studentId,
    dateOfBirth: v.dateOfBirth,
    gender: v.gender,
    address: v.address,
    emergencyName: v.emergencyName,
    emergencyPhone: v.emergencyPhone,
    bloodGroup: "Unknown",
    medicalNotes: "",
    routeId: v.routeId,
    status: "active",
    documents: v.documents,
  });
  if (v.generateInvoice)
    next.records.invoices.push({
      ...sc,
      id: crypto.randomUUID(),
      studentId,
      reference: `INV-${next.setup.calendar.year.name.replace(/[^0-9]/g, "")}-${next.records.invoices.length + 1001}`,
      period: "Admission fees",
      issuedOn,
      dueDate:
        next.setup.calendar.terms.find((term) => term.endDate >= issuedOn)
          ?.endDate ?? next.setup.calendar.year.endDate,
      lines: [
        ...next.setup.fees.map((f) => ({
          id: f.id,
          name: f.name,
          amountMinor: f.amountMinor,
        })),
        ...(application && next.records.admissionForms[0]?.applicationFeeMinor
          ? [
              {
                id: "application-fee",
                name: "Application fee",
                amountMinor: next.records.admissionForms[0].applicationFeeMinor,
              },
            ]
          : []),
      ],
      concessionMinor: 0,
      status: "issued",
    });
  if (v.inquiryId)
    next.records.inquiries = next.records.inquiries.map((r) =>
      r.id === v.inquiryId ? { ...r, stage: "enrolled", studentId } : r,
    );
  next.setup.portal.invitationsPrepared = false;
  return schoolYearWorkspaceSchema.parse(next);
}
export function decideLeave(
  y: SchoolYearWorkspace,
  id: string,
  status: "approved" | "rejected",
  note: string,
) {
  if (note.trim().length < 8)
    throw new Error("Add a decision note of at least 8 characters.");
  const leave = y.records.leaves.find((l) => l.id === id);
  if (!leave || leave.status !== "pending")
    throw new Error("This leave request has already been processed.");
  let paid = leave.paid,
    leaveType = leave.leaveType;
  if (status === "approved" && leave.personType === "staff") {
    const entitlement = staffLeaveEntitlement(
      y,
      leave.personId,
      leave.leaveType ?? "Casual leave",
    );
    const days = leaveWorkingDates(
      y,
      leave.dates.startDate,
      leave.dates.endDate,
    ).length;
    if (!days || days > entitlement.remainingDays)
      throw new Error(
        "Requested working days exceed the remaining leave allowance.",
      );
    paid = entitlement.paid;
    leaveType = entitlement.name;
  }
  let next = putRecord(y, "leaves", {
    ...leave,
    status,
    decisionNote: note,
    ...(leave.personType === "staff" ? { paid, leaveType } : {}),
  });
  if (status === "approved")
    next = {
      ...next,
      records: {
        ...next.records,
        attendance: next.records.attendance.map((record) =>
          record.personType === leave.personType &&
          record.personId === leave.personId &&
          record.date >= leave.dates.startDate &&
          record.date <= leave.dates.endDate
            ? { ...record, status: "excused", note: `Approved leave: ${note}` }
            : record,
        ),
      },
    };
  if (status === "approved") {
    const from = new Date(leave.dates.startDate + "T00:00:00Z"),
      to = new Date(leave.dates.endDate + "T00:00:00Z");
    let days = 0;
    for (let date = from; date <= to; date.setUTCDate(date.getUTCDate() + 1)) {
      if (++days > 366) throw new Error("Leave range is too long.");
      const iso = date.toISOString().slice(0, 10);
      const existing = next.records.attendance.find(
        (r) =>
          r.personId === leave.personId &&
          r.personType === leave.personType &&
          r.date === iso &&
          r.periodId === null,
      );
      next = putRecord(next, "attendance", {
        ...scope(next),
        id: existing?.id ?? crypto.randomUUID(),
        personType: leave.personType,
        personId: leave.personId,
        date: iso,
        periodId: null,
        status: "excused",
        note: `Approved leave: ${note}`,
      });
    }
  }
  return next;
}
export function decideApproval(
  y: SchoolYearWorkspace,
  id: string,
  status: "approved" | "rejected",
  note: string,
) {
  if (note.trim().length < 8)
    throw new Error("Add a decision note of at least 8 characters.");
  const approval = y.records.approvals.find((a) => a.id === id);
  if (!approval || approval.status !== "pending")
    throw new Error("Approval has already been processed.");
  let next = putRecord(y, "approvals", {
    ...approval,
    status,
    decisionNote: note,
  });
  if (status === "approved" && approval.category === "concession") {
    const invoice = next.records.invoices.find(
      (i) => i.id === approval.targetId,
    );
    if (!invoice) throw new Error("Linked invoice is no longer available.");
    if (approval.amountMinor > balance(next, invoice.id))
      throw new Error("Concession exceeds the remaining balance.");
    next = putRecord(next, "invoices", {
      ...invoice,
      concessionMinor: invoice.concessionMinor + approval.amountMinor,
    });
  }
  if (status === "approved" && approval.category === "exam_unlock") {
    const exam = next.records.exams.find((e) => e.id === approval.targetId);
    if (!exam) throw new Error("Exam is no longer available.");
    if (y.workflows.publications.some(p=>p.kind==="report-card"&&p.sourceId===exam.id)) throw new Error("Issued report cards require an independently approved result correction; use Result reviews.");
    next = putRecord(next, "exams", { ...exam, status: "published" });
  }
  return next;
}
export function publishNotice(y: SchoolYearWorkspace, id: string) {
  const notice = y.records.notices.find((n) => n.id === id);
  if (!notice) throw new Error("Notice not found.");
  if (notice.status === "published") return y;
  const eligible = y.setup.students.filter(
    (s) =>
      !y.records.studentProfiles.some(
        (p) => p.studentId === s.id && p.status !== "active",
      ) &&
      (!notice.classSectionIds.length ||
        notice.classSectionIds.includes(s.classSectionId)),
  );
  const guardianIds = y.setup.relationships
    .filter(
      (r) => r.canReceiveNotices && eligible.some((s) => s.id === r.studentId),
    )
    .map((r) => r.guardianId);
  const recipients = [
    ...new Set([
      ...(notice.audience === "staff" ? [] : guardianIds),
      ...(notice.audience === "all" ? eligible.map((s) => s.id) : []),
      ...(notice.audience === "guardians"
        ? []
        : y.setup.staff.map((s) => s.id)),
    ]),
  ];
  return putRecord(y, "notices", {
    ...notice,
    status: "published",
    recipientIds: recipients,
  });
}
export function mergeStudents(
  y: SchoolYearWorkspace,
  primaryId: string,
  duplicateId: string,
) {
  if (primaryId === duplicateId)
    throw new Error("Choose two different students.");
  const next = structuredClone(y),
    primary = next.setup.students.find((s) => s.id === primaryId),
    duplicate = next.setup.students.find((s) => s.id === duplicateId);
  if (!primary || !duplicate) throw new Error("Student no longer exists.");
  const hasHistory =
    next.records.invoices.some((r) => r.studentId === duplicateId) ||
    next.records.marks.some((r) => r.studentId === duplicateId) ||
    next.records.attendance.some((r) => r.personId === duplicateId) ||
    next.records.submissions.some((r) => r.studentId === duplicateId) ||
    next.records.certificates.some((r) => r.studentId === duplicateId) ||
    next.workflows.studentEvents.some((e) => e.studentId === duplicateId) ||
    next.workflows.publications.some(
      (p) => p.ownerType === "student" && p.ownerId === duplicateId,
    ) ||
    next.workflows.feePlans.some((p) => p.studentId === duplicateId) ||
    next.workflows.customValues.some(
      (v) => v.entity === "student" && v.ownerId === duplicateId,
    );
  if (hasHistory)
    throw new Error(
      "The duplicate has operational history. Resolve those references before merging; history will not be silently discarded.",
    );
  next.setup.relationships = next.setup.relationships
    .map((r) =>
      r.studentId === duplicateId ? { ...r, studentId: primaryId } : r,
    )
    .filter(
      (r, i, all) =>
        all.findIndex(
          (p) => p.studentId === r.studentId && p.guardianId === r.guardianId,
        ) === i,
    );
  next.records.studentProfiles = next.records.studentProfiles.filter(
    (r) => r.studentId !== duplicateId,
  );
  next.records.reenrolments = next.records.reenrolments.filter(
    (r) => r.studentId !== duplicateId,
  );
  next.records.promotions = next.records.promotions.filter(
    (r) => r.studentId !== duplicateId,
  );
  next.records.inquiries = next.records.inquiries.map((r) =>
    r.studentId === duplicateId ? { ...r, studentId: primaryId } : r,
  );
  next.setup.students = next.setup.students.filter((s) => s.id !== duplicateId);
  next.setup.exceptions = next.setup.exceptions.filter(
    (r) => r.id !== duplicate.admissionNumber,
  );
  return schoolYearWorkspaceSchema.parse(next);
}
export function issueCertificate(y: SchoolYearWorkspace, id: string) {
  const cert = y.records.certificates.find((c) => c.id === id);
  if (!cert) throw new Error("Certificate not found.");
  let next = putRecord(y, "certificates", { ...cert, status: "issued" });
  if (cert.type === "Transfer Certificate")
    next = {
      ...next,
      records: {
        ...next.records,
        studentProfiles: next.records.studentProfiles.map((p) =>
          p.studentId === cert.studentId ? { ...p, status: "transferred" } : p,
        ),
      },
    };
  return schoolYearWorkspaceSchema.parse(next);
}
export function csvExport(rows: Record<string, unknown>[]) {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    let s =
      v === null || v === undefined
        ? ""
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\uFEFF" +
    [
      headers.map(cell).join(","),
      ...rows.map((row) => headers.map((h) => cell(row[h])).join(",")),
    ].join("\r\n")
  );
}
