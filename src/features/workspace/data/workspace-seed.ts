import { createOperationsSeed } from "../../operations/data/operations-seed.ts";
import type { SetupConfig } from "../../school-setup/models/index.ts";
import { createSetupSeed } from "../../school-setup/data/setup-seed.ts";
import {
  workspaceSchema,
  schoolYearWorkspaceSchema,
} from "../schemas/workspace.schema.ts";
export const REFERENCE_DATE = "2026-10-14";
export function createYearSeed(setup: SetupConfig = createSetupSeed()) {
  const scope = {
    schoolId: setup.school.id,
    academicYearId: setup.calendar.year.id,
  };
  const date = (md: string) => {
    const d = `${setup.calendar.year.startDate.slice(0, 4)}-${md}`;
    return d < setup.calendar.year.startDate
      ? setup.calendar.year.startDate
      : d > setup.calendar.year.endDate
        ? setup.calendar.year.endDate
        : d;
  };
  const c = setup.classes[0].id,
    t = setup.staff[1]?.id ?? setup.staff[0].id;
  const subjects = [
    "Mathematics",
    "English",
    "Science",
    "Social Studies",
    "Computer Science",
  ].map((name, i) => ({
    ...scope,
    id: `subject-${i + 1}`,
    name,
    code: ["MAT", "ENG", "SCI", "SST", "CS"][i],
    maxMarks: 100,
  }));
  const roles = [
    {
      ...scope,
      id: "role-admin",
      name: "Super Administrator",
      permissions: [
        "students:read",
        "students:write",
        "staff:read",
        "staff:write",
        "attendance:write",
        "academics:write",
        "exams:write",
        "fees:write",
        "notices:write",
        "settings:write",
        "audit:read",
      ],
    },
    {
      ...scope,
      id: "role-teacher",
      name: "Teacher",
      permissions: [
        "students:read",
        "attendance:write",
        "academics:write",
        "exams:write",
      ],
    },
    {
      ...scope,
      id: "role-accounts",
      name: "Accounts & Bursar",
      permissions: ["students:read", "fees:write", "audit:read"],
    },
  ];
  const route = {
    ...scope,
    id: "route-14",
    name: "Route 14 · Campus Express",
    vehicle: "DL-01-SCH-14",
    capacity: 40,
    stops: [
      { id: "stop-1", name: "Sector 14", time: "07:30" },
      { id: "stop-2", name: "Main Campus", time: "08:10" },
    ],
  };
  const units = subjects.slice(0, 3).map((sub, i) => ({
    ...scope,
    id: `unit-${i + 1}`,
    subjectId: sub.id,
    classSectionId: c,
    title: ["Numbers & Operations", "Prose & Reading", "Living World"][i],
    description: "Sample curriculum unit with learning outcomes.",
    plannedPeriods: 12,
    completedPeriods: 5 + i,
  }));
  const exam = {
    ...scope,
    id: "exam-term-1",
    name: "Term 1 Half-Yearly",
    dates: { startDate: date("10-20"), endDate: date("10-30") },
    classSectionIds: setup.classes.map((c) => c.id),
    subjectIds: subjects.slice(0, 3).map((s) => s.id),
    maxMarks: 100,
    passMarks: 33,
    status: "published",
  };
  const inquiries = Array.from({ length: 18 }, (_, i) => ({
    ...scope,
    id: `ENQ-2026-${String(401 + i).padStart(4, "0")}`,
    studentName:
      [
        "Aadhya Sharma",
        "Reyansh Gupta",
        "Tanvi Seth",
        "Vihaan Nair",
        "Ananya Iyer",
        "Kavya Patel",
        "Ishaan Mehta",
        "Siddharth Verma",
        "Meera Krishnan",
      ][i % 9] + (i >= 9 ? " (Sample 2)" : ""),
    guardianName: `Sample Guardian ${i + 1}`,
    email: `applicant${i + 1}@school.example`,
    phone: `+91800000${String(i + 1).padStart(4, "0")}`,
    classSectionId: setup.classes[i % setup.classes.length].id,
    source: ["Website", "Walk-in", "Referral", "Phone", "Campaign"][i % 5],
    stage: [
      "new",
      "contacted",
      "campus_visit",
      "application",
      "assessment",
      "offered",
      "waitlisted",
      "lost",
    ][i % 8],
    counselorId: i % 3 === 0 ? null : setup.staff[i % setup.staff.length].id,
    followUpDate: date("10-18"),
    notes: "Sample admissions record. Follow up with guardian.",
    score: i % 8 >= 4 ? 75 + (i % 20) : null,
    interviewDate: i % 8 >= 4 ? date("10-19") : null,
    offerExpiry: i % 8 === 5 ? date("10-25") : null,
    studentId: null,
    lostReason: i % 8 === 7 ? "Family relocated." : "",
  }));
  return schoolYearWorkspaceSchema.parse({
    setup,
    records: {
      subjects,
      inquiries,
      admissionForms: [
        {
          ...scope,
          id: "form-admission",
          title: `${setup.school.shortName} Admission Form`,
          accepting: true,
          requireDocuments: true,
          requireSibling: false,
          applicationFeeMinor: 250000,
          fields: [
            {
              id: "field-student",
              label: "Student full name",
              type: "text",
              required: true,
            },
            {
              id: "field-email",
              label: "Guardian email",
              type: "email",
              required: true,
            },
            {
              id: "field-phone",
              label: "Guardian phone",
              type: "phone",
              required: true,
            },
          ],
        },
      ],
      reenrolments: setup.students.slice(0, 20).map((s, i) => ({
        ...scope,
        id: `reenrol-${i}`,
        studentId: s.id,
        intent: i % 4 === 0 ? "pending" : "continue",
        note: "",
      })),
      studentProfiles: setup.students.map((s, i) => ({
        ...scope,
        id: `profile-${s.id}`,
        studentId: s.id,
        dateOfBirth: `${2012 + (i % 6)}-05-12`,
        gender: i % 2 ? "Female" : "Male",
        address: `Sample address ${i + 1}, ${setup.school.address.city}`,
        emergencyName: setup.guardians[i]?.displayName ?? "Sample Guardian",
        emergencyPhone: setup.guardians[i]?.phone ?? "+919000000000",
        bloodGroup: "Unknown",
        medicalNotes: "",
        routeId: i < 20 ? route.id : null,
        status: "active",
        documents: [
          {
            id: `doc-${s.id}`,
            name: "Birth certificate (sample)",
            size: 120000,
            kind: "document",
            status: i % 7 ? "verified" : "pending",
          },
        ],
      })),
      routes: [route],
      certificates: [],
      promotions: [],
      roles,
      staffProfiles: setup.staff.map((s, i) => ({
        ...scope,
        id: `staff-profile-${s.id}`,
        staffId: s.id,
        email: `staff${i + 1}@school.example`,
        phone: `+91700000${String(i + 1).padStart(4, "0")}`,
        department:
          i === 0
            ? "Administration"
            : ["Primary", "Middle School", "Senior School"][i % 3],
        joinedOn: "2020-06-01",
        employment: "Full-time",
        roleId: i === 0 ? "role-admin" : "role-teacher",
        documents: [
          {
            id: `staff-doc-${i}`,
            name: "Qualification certificate (sample)",
            size: 100000,
            kind: "document",
            status: i % 4 ? "verified" : "pending",
          },
        ],
        bio: "Sample faculty member.",
      })),
      attendance: setup.students.map((s, i) => ({
        ...scope,
        id: `att-${i}`,
        personType: "student",
        personId: s.id,
        date: date("10-14"),
        periodId: null,
        status: i % 10 === 0 ? "absent" : i % 13 === 0 ? "late" : "present",
        note: "",
      })),
      leaves: [
        {
          ...scope,
          id: "leave-1",
          personType: "staff",
          personId: t,
          dates: { startDate: date("10-14"), endDate: date("10-15") },
          reason: "Sample medical leave request.",
          status: "pending",
          decisionNote: "",
        },
      ],
      rooms: [
        {
          ...scope,
          id: "room-204",
          name: "Room 204",
          capacity: 40,
          type: "Classroom",
        },
        {
          ...scope,
          id: "room-physics",
          name: "Physics Lab 1",
          capacity: 40,
          type: "Laboratory",
        },
        {
          ...scope,
          id: "room-chemistry",
          name: "Chemistry Lab",
          capacity: 40,
          type: "Laboratory",
        },
        {
          ...scope,
          id: "room-computer",
          name: "Senior Computer Lab",
          capacity: 40,
          type: "Laboratory",
        },
        {
          ...scope,
          id: "room-hall",
          name: "Auditorium Hall",
          capacity: 200,
          type: "Auditorium",
        },
      ],
      reservations: [],
      slots: setup.bells
        .filter((b) => b.kind === "period")
        .slice(0, 3)
        .map((p, i) => ({
          ...scope,
          id: `slot-${i + 1}`,
          classSectionId: c,
          staffId: setup.staff[(i + 1) % setup.staff.length].id,
          subjectId: subjects[i].id,
          weekday: "Monday",
          periodId: p.id,
          room: "Room 204",
          status: "published",
        })),
      substitutions: [],
      units,
      lessons: units.map((u, i) => ({
        ...scope,
        id: `lesson-${i + 1}`,
        unitId: u.id,
        staffId: t,
        title: `Lesson: ${u.title}`,
        date: date("10-15"),
        objectives:
          "Develop understanding through guided practice and assessment.",
        status: i === 0 ? "submitted" : "draft",
      })),
      homework: [
        {
          ...scope,
          id: "homework-1",
          classSectionId: c,
          subjectId: subjects[0].id,
          staffId: t,
          title: "Fractions practice worksheet",
          instructions: "Complete exercises 1–10 and show all working steps.",
          dueDate: date("10-18"),
          maxScore: 20,
          attachments: [],
        },
      ],
      submissions: setup.students
        .filter((s) => s.classSectionId === c)
        .map((s, i) => ({
          ...scope,
          id: `submission-${i + 1}`,
          homeworkId: "homework-1",
          studentId: s.id,
          status: i < 3 ? "graded" : i < 6 ? "submitted" : "pending",
          score: i < 3 ? 15 + i : null,
          feedback: i < 3 ? "Good work. Review the final question." : "",
        })),
      exams: [exam],
      papers: [],
      marks: setup.students
        .filter((s) => s.classSectionId === c)
        .slice(0, 5)
        .flatMap((s, i) =>
          subjects.slice(0, 3).map((sub, j) => ({
            ...scope,
            id: `mark-${i}-${j}`,
            examId: exam.id,
            subjectId: sub.id,
            studentId: s.id,
            marks: 65 + i * 4 + j,
            remark: "",
          })),
        ),
      invoices: setup.students.slice(0, 20).map((s, i) => ({
        ...scope,
        id: `invoice-${i + 1}`,
        studentId: s.id,
        reference: `INV-2026-${1001 + i}`,
        issuedOn: date("10-01"),
        dueDate: date("10-20"),
        lines: setup.fees.map((f) => ({
          id: f.id,
          name: f.name,
          amountMinor: f.amountMinor,
        })),
        concessionMinor: 0,
        status: "issued",
      })),
      payments: [],
      events: [
        {
          ...scope,
          id: "event-1",
          title: "Term 1 Parent–Teacher Meeting",
          category: "PTM",
          dates: { startDate: date("10-17"), endDate: date("10-17") },
          description: "Meet class teachers and review student progress.",
          classSectionIds: [],
          status: "published",
        },
        {
          ...scope,
          id: "event-2",
          title: "Half-yearly examinations begin",
          category: "Exam",
          dates: { startDate: date("10-20"), endDate: date("10-30") },
          description: "Sample exam schedule.",
          classSectionIds: [],
          status: "published",
        },
      ],
      notices: [
        {
          ...scope,
          id: "notice-1",
          title: "Term 1 PTM and progress review",
          body: "Dear parents, please attend the term progress review meeting on Saturday. This is a simulated school notice.",
          priority: "normal",
          audience: "guardians",
          classSectionIds: [],
          channels: ["App", "Email"],
          status: "published",
          scheduledFor: null,
          recipientIds: setup.guardians.map((g) => g.id),
          acknowledgedIds: setup.guardians.slice(0, 20).map((g) => g.id),
        },
      ],
      notifications: [
        {
          ...scope,
          id: "notification-1",
          title: "Staff leave awaiting approval",
          body: "A sample faculty leave request needs review.",
          category: "approvals",
          createdAt: `${date("10-14")}T08:00:00.000Z`,
          read: false,
          href: "/attendance/leave",
        },
        {
          ...scope,
          id: "notification-2",
          title: "Term 1 examination readiness",
          body: "Review the timetable and remaining marks.",
          category: "general",
          createdAt: `${date("10-14")}T09:00:00.000Z`,
          read: false,
          href: "/exams",
        },
      ],
      exports: [],
      approvals: [
        {
          ...scope,
          id: "approval-1",
          title: "Sibling fee concession",
          category: "concession",
          requesterId: setup.staff[0].id,
          targetId: "invoice-1",
          reason: "Sample request for a sibling concession.",
          amountMinor: 100000,
          status: "pending",
          decisionNote: "",
        },
      ],
      preferences: {
        language: "English",
        dateFormat: "DD MMM YYYY",
        workingDays: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        principalBio:
          "Educational administrator leading the school academic community.",
        qualification: "Ph.D. in Educational Leadership",
        emergencyAlerts: true,
        auditAlerts: true,
        weeklyDigest: false,
        schoolCode: "DEL-SCH-01",
        letterheadFooter: "Generated from the school workspace workspace.",
      },
    },
  });
}
export function createWorkspace(setup: SetupConfig = createSetupSeed()) {
  return workspaceSchema.parse({
    version: 2,
    revision: 0,
    activeYearId: setup.calendar.year.id,
    years: [
      (() => {
        const year = createYearSeed(setup);
        return { ...year, extensions: createOperationsSeed(year) };
      })(),
    ],
  });
}
