import type { ExceptionRecord } from "../models";
import {
  setupPhaseIds,
  setupPipelineSchema,
  setupWizardSnapshotSchema,
} from "../schemas/setup-wizard.schema.ts";
import { schoolProfileSchema } from "../../../shared/schemas/school.ts";
import { academicCalendarSchema } from "../../../shared/schemas/academics.ts";
import { figmaAssets } from "../../../components/layout/figma-assets.ts";

const phaseFixtures = [
  {
    title: "School Profile",
    description: "CBSE Affiliation #1930281 verified 12 Apr 2026.",
  },
  {
    title: "Terms & Semesters",
    description: "2 Terms configured, 220 statutory working days.",
  },
  {
    title: "Classes & Sections",
    description: "42 cohorts mapped, capacity locked at 1,480.",
  },
  {
    title: "Bell Schedule",
    description: "8 periods × 40 mins, 2 recesses, zero conflict.",
  },
  {
    title: "Fee Structure",
    description: "4 quarter slabs, concessions & UPI gateway set.",
  },
  {
    title: "Staff Allocations",
    description: "82 teachers assigned; 0 orphaned periods.",
  },
  {
    title: "Data Sync & Ingestion",
    description: "DigiLocker UID / Aadhaar 85% verified. 1,248 / 1,480.",
  },
  {
    title: "Portal & App Gateway",
    description: "Parent credentials unlock upon Phase 07 zero-error sign-off.",
  },
] as const;

const images = figmaAssets.workspace;

// Six visible Figma rows plus two explicitly labelled sample rows for the second page.
// These are reference fixtures, not records fetched from a school service.
const exceptionFixtures: Omit<
  ExceptionRecord,
  "schoolId" | "academicYearId"
>[] = [
  {
    id: "GRN-8921",
    name: "Aarav M. Khurana",
    guardian: "Rajesh Khurana",
    grade: "IX-A",
    image: images.imgAaravMKhurana.src,
    status: "UID Mismatch",
    tone: "danger",
    discrepancy: "Aadhaar DOB (14/05/11) != Certificate (12/05/11)",
    action: "Resolve UID",
    category: "uid",
  },
  {
    id: "GRN-9102",
    name: "Diya Sneha Patel",
    guardian: "Sneha K. Patel",
    grade: "VI-C",
    image: images.imgDiyaSnehaPatel.src,
    status: "Sibling Conflict",
    tone: "warning",
    discrepancy: "Linked sibling GRN-7231 marked Alumni in 2025",
    action: "Link Sibling",
    category: "sibling",
  },
  {
    id: "GRN-9442",
    name: "Tanvi R. Sengupta",
    guardian: "Dr. Rohit Sengupta",
    grade: "IV-B",
    image: images.imgTanviRSengupta.src,
    status: "Route Drift",
    tone: "info",
    discrepancy: "Address shifted south (Gurugram Sec 42); Bus #14 invalid",
    action: "Verify Zone",
    category: "address",
  },
  {
    id: "GRN-8420",
    name: "Kabeer N. Joshi",
    guardian: "Nitin Joshi",
    grade: "XI-Sci",
    image: images.imgKabeerNJoshi.src,
    status: "Stream Subject",
    tone: "danger",
    discrepancy: "CBSE 041 Math prerequisite check unverified (X Board)",
    action: "Review Marks",
    category: "uid",
  },
  {
    id: "GRN-9811",
    name: "Ananya V. Deshmukh",
    guardian: "Vikram Deshmukh",
    grade: "II-A",
    image: images.imgDiyaSnehaPatel.src,
    status: "DigiLocker OK",
    tone: "success",
    discrepancy: "Secondary emergency contact: 9 digits supplied",
    action: "Override Contact",
    category: "address",
  },
  {
    id: "GRN-8745",
    name: "Reyansh G. Chawla",
    guardian: "Gurpreet Chawla",
    grade: "VIII-B",
    image: images.imgKabeerNJoshi.src,
    status: "PEN Pending",
    tone: "warning",
    discrepancy: "UDISE+ PEN number missing from transferred TC record",
    action: "Resolve UID",
    category: "uid",
  },
  {
    id: "DEMO-0007",
    name: "Additional UID exception",
    guardian: "Sample guardian",
    grade: "—",
    status: "UID Pending",
    tone: "warning",
    discrepancy: "Sample pagination record; identity document awaiting review.",
    action: "Resolve UID",
    category: "uid",
  },
  {
    id: "DEMO-0008",
    name: "Additional sibling exception",
    guardian: "Sample guardian",
    grade: "—",
    status: "Sibling Conflict",
    tone: "warning",
    discrepancy:
      "Sample pagination record; guardian relationship awaiting review.",
    action: "Link Sibling",
    category: "sibling",
  },
];

export const schoolProfile = schoolProfileSchema.parse({
  id: "school-greenfield",
  name: "Greenfield International School",
  shortName: "Greenfield Int.",
  curriculum: "CBSE",
  affiliationNumber: "1930281",
  address: {
    line1: "Sample campus address",
    city: "New Delhi",
    region: "Delhi",
    postalCode: "110001",
    countryCode: "IN",
  },
  email: "office@greenfield.example",
  phone: "+911140001234",
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  currency: "INR",
});
export const academicCalendar = academicCalendarSchema.parse({
  year: {
    id: "ay-2026-27",
    schoolId: schoolProfile.id,
    name: "2026–27",
    startDate: "2026-04-01",
    endDate: "2027-03-31",
  },
  terms: [
    {
      id: "term-1",
      schoolId: schoolProfile.id,
      academicYearId: "ay-2026-27",
      name: "Term 1",
      startDate: "2026-04-01",
      endDate: "2026-10-31",
    },
    {
      id: "term-2",
      schoolId: schoolProfile.id,
      academicYearId: "ay-2026-27",
      name: "Term 2",
      startDate: "2026-11-01",
      endDate: "2027-03-31",
    },
  ],
});
export const previewContext = {
  schoolId: schoolProfile.id,
  academicYearId: academicCalendar.year.id,
};
export const phases = setupPipelineSchema.parse(
  phaseFixtures.map((phase, index) => ({
    ...phase,
    id: setupPhaseIds[index],
    status: index < 6 ? "completed" : index === 6 ? "in_progress" : "locked",
  })),
);
export const wizardPreview = setupWizardSnapshotSchema.parse({
  ...previewContext,
  batchId: "SYNC-2026-B812",
  phases,
  summary: {
    pipelineVelocityPercent: 87,
    velocityChangePerHour: 14,
    validatedStudents: 1248,
    totalStudents: 1480,
    deadlineDays: 18,
    targetTermStart: "2026-06-01",
    completionPercent: 72,
    pendingApprovals: 12,
    upcomingEvents: 3,
  },
  exceptions: exceptionFixtures.map((record) => ({
    ...record,
    ...previewContext,
  })),
  compliance: [
    {
      id: "cbse-oasis",
      label: "CBSE OASIS v4.2 Schema",
      detail: "Mandatory curriculum tagging",
      status: "pass",
      value: "100% Compliant",
      supportingText: "Valid checksum",
    },
    {
      id: "udise-ptr",
      label: "UDISE+ PTR Benchmark",
      detail: "Teacher-Pupil Ratio",
      status: "pass",
      value: "1 : 24 Ratio",
      supportingText: "Norm < 1:30 (Met)",
    },
    {
      id: "rte-quota",
      label: "RTE 25% EWS / DG Quota",
      detail: "Entry level reservation",
      status: "pass",
      value: "370 / 370 Enrolled",
      supportingText: "100% Seat Allocation",
    },
    {
      id: "apaar",
      label: "DigiLocker APAAR ID",
      detail: "One Nation One Student ID",
      status: "pass",
      value: "84.3% Coverage",
      supportingText: "Target > 95% by Step 8",
    },
  ],
  authority: {
    staff: {
      id: "staff-rajiv",
      schoolId: schoolProfile.id,
      displayName: "Dr. Rajiv Sharma",
      designation: "Principal / Head of Institution",
    },
    tokenStatus: "active",
    tokenSerial: "IN-CCA-8849-2027",
    fingerprintDisplay: "7E:3B:19:9A...C2:55",
    ledgerCount: 1480,
    rosterCount: 42,
  },
  snapshot: {
    id: "snapshot-preview",
    schoolId: schoolProfile.id,
    sourceAcademicYearId: "ay-2025-26",
    ageMinutes: 14,
    status: "available",
  },
});
export const initialExceptions = wizardPreview.exceptions;
