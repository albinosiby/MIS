import { setupConfigSchema } from "../schemas/setup-config.schema.ts";
import {
  schoolProfile,
  academicCalendar,
  initialExceptions,
  wizardPreview,
} from "./setup-preview.ts";
import { setupPhaseIds } from "../schemas/setup-wizard.schema.ts";

export function createSetupSeed(fresh = false) {
  const scope = {
    schoolId: schoolProfile.id,
    academicYearId: academicCalendar.year.id,
  };
  const classes = Array.from({ length: 10 }, (_, i) => ({
    ...scope,
    id: `class-${i + 1}-a`,
    grade: String(i + 1),
    section: "A",
    capacity: 40,
  }));
  const staff = [
    wizardPreview.authority.staff,
    ...Array.from({ length: 14 }, (_, i) => ({
      schoolId: schoolProfile.id,
      id: `staff-${i + 1}`,
      displayName: `${["Anita", "Rahul", "Meera", "Arjun", "Priya", "Dev", "Sara"][i % 7]} ${["Nair", "Rao"][Math.floor(i / 7)]}`,
      designation: "Teacher",
    })),
  ];
  const students = Array.from({ length: 100 }, (_, i) => ({
    ...scope,
    id: `student-${i + 1}`,
    admissionNumber:
      i < initialExceptions.length
        ? initialExceptions[i].id
        : `GRN-${10000 + i}`,
    displayName:
      i < initialExceptions.length
        ? initialExceptions[i].name
        : `${["Aisha", "Kabir", "Maya", "Ishan", "Zoya", "Rohan", "Tara", "Vivaan", "Nila", "Arav"][i % 10]} ${["Menon", "Rao", "Das", "Shah", "Roy", "Nair", "Singh", "Kapoor", "Bose", "Kumar"][Math.floor(i / 10)]}`,
    classSectionId: classes[Math.floor(i / 10)].id,
  }));
  const guardians = students.map((s, i) => ({
    schoolId: s.schoolId,
    id: `guardian-${i + 1}`,
    displayName:
      i < initialExceptions.length
        ? initialExceptions[i].guardian
        : `Guardian of ${s.displayName}`,
    email: `guardian${i + 1}@school.example`,
    phone: `+91900000${String(i + 1).padStart(4, "0")}`,
  }));
  return setupConfigSchema.parse({
    version: 1,
    revision: 0,
    school: schoolProfile,
    calendar: academicCalendar,
    branding: { logo: null },
    classes,
    bells: [
      {
        id: "bell-1",
        name: "Period 1",
        kind: "period",
        start: "08:30",
        end: "09:10",
      },
      {
        id: "bell-2",
        name: "Period 2",
        kind: "period",
        start: "09:10",
        end: "09:50",
      },
      {
        id: "bell-break",
        name: "Morning break",
        kind: "break",
        start: "09:50",
        end: "10:05",
      },
      {
        id: "bell-3",
        name: "Period 3",
        kind: "period",
        start: "10:05",
        end: "10:45",
      },
    ],
    fees: [
      {
        id: "fee-tuition",
        name: "Tuition",
        amountMinor: 1500000,
        frequency: "quarterly",
      },
      {
        id: "fee-annual",
        name: "Annual activities",
        amountMinor: 300000,
        frequency: "annual",
      },
    ],
    concessionPercent: 0,
    staff,
    allocations: classes.map((c, i) => ({
      id: `allocation-${i + 1}`,
      staffId: staff[i + 1].id,
      classSectionId: c.id,
      subject: "Mathematics",
    })),
    students,
    guardians,
    relationships: students.map((s, i) => ({
      schoolId: s.schoolId,
      studentId: s.id,
      guardianId: guardians[i].id,
      relationship: "parent",
      canViewRecords: true,
      canReceiveNotices: true,
    })),
    exceptions: initialExceptions,
    reviews: [],
    portal: {
      parentEnabled: true,
      staffEnabled: true,
      invitationsPrepared: false,
      acknowledgeSimulation: false,
    },
    completed: fresh ? [] : setupPhaseIds.slice(0, 6),
    audit: [],
    notifications: [],
  });
}
