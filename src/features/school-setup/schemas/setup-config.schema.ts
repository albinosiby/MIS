import { auditActorSchema } from "../../../shared/schemas/audit.ts";
import { z } from "zod";
import { schoolProfileSchema } from "../../../shared/schemas/school.ts";
import {
  academicCalendarSchema,
  classSectionSchema,
} from "../../../shared/schemas/academics.ts";
import {
  staffSummarySchema,
  guardianRelationshipSchema,
} from "../../../shared/schemas/people.ts";
import {
  enrolledStudentSchema,
  guardianContactSchema,
} from "../../../shared/schemas/school-records.ts";
import {
  identifierSchema,
  displayNameSchema,
} from "../../../shared/schemas/primitives.ts";
import {
  exceptionRecordSchema,
  exceptionReviewSchema,
  setupPhaseIds,
} from "./setup-wizard.schema.ts";

const minuteTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid 24-hour time");
export const bellSlotSchema = z
  .strictObject({
    id: identifierSchema,
    name: displayNameSchema,
    kind: z.enum(["period", "break"]),
    start: minuteTime,
    end: minuteTime,
  })
  .refine((v) => v.start < v.end, {
    path: ["end"],
    message: "End must be after start",
  });
export const feeHeadSchema = z.strictObject({
  id: identifierSchema,
  name: displayNameSchema,
  amountMinor: z.number().int().min(0).max(100_000_000),
  frequency: z.enum(["annual", "quarterly", "monthly"]),
});
export const staffAllocationSchema = z.strictObject({
  id: identifierSchema,
  staffId: identifierSchema,
  classSectionId: identifierSchema,
  subject: displayNameSchema,
});
export const portalConfigSchema = z.strictObject({
  parentEnabled: z.boolean(),
  staffEnabled: z.boolean(),
  invitationsPrepared: z.boolean(),
  acknowledgeSimulation: z.boolean(),
});
/** Standalone setup checks its full roster; operational workspaces supply enrolment context. */
export function setupConfigSchemaFor(
  inactiveStudentIds: ReadonlySet<string> | null,
) {
  return z
    .strictObject({
      version: z.literal(1),
      revision: z.number().int().nonnegative(),
      school: schoolProfileSchema,
      calendar: academicCalendarSchema,
      branding: z.strictObject({
        logo: z
          .string()
          .max(210_000)
          .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
          .nullable(),
      }),
      classes: z.array(classSectionSchema).max(200),
      bells: z.array(bellSlotSchema).max(30),
      fees: z.array(feeHeadSchema).max(50),
      concessionPercent: z.number().min(0).max(100),
      staff: z.array(staffSummarySchema).min(1).max(200),
      allocations: z.array(staffAllocationSchema).max(500),
      students: z.array(enrolledStudentSchema).max(2000),
      guardians: z.array(guardianContactSchema).max(4000),
      relationships: z.array(guardianRelationshipSchema).max(8000),
      exceptions: z.array(exceptionRecordSchema).max(100),
      reviews: z.array(exceptionReviewSchema).max(500),
      portal: portalConfigSchema,
      completed: z.array(z.enum(setupPhaseIds)).max(8),
      audit: z
        .array(
          z.strictObject({
            id: identifierSchema,
            at: z.iso.datetime(),
            action: z.string().min(1).max(300),
            actor: auditActorSchema.nullable().default(null),
          }),
        )
        .max(200),
      notifications: z
        .array(
          z.strictObject({
            id: identifierSchema,
            at: z.iso.datetime(),
            recipients: z.array(identifierSchema).min(1).max(2000),
            status: z.literal("simulated"),
          }),
        )
        .max(200),
    })
    .superRefine((v, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", path, message });
      const unique = (name: string, rows: { id: string }[]) => {
        if (new Set(rows.map((r) => r.id)).size !== rows.length)
          issue([name], "IDs must be unique");
      };
      for (const name of [
        "classes",
        "bells",
        "fees",
        "staff",
        "allocations",
        "students",
        "guardians",
        "exceptions",
        "audit",
        "notifications",
      ] as const)
        unique(name, v[name]);
      if (v.calendar.year.schoolId !== v.school.id)
        issue(["calendar"], "Academic year belongs to another school");
      for (const name of [
        "classes",
        "students",
        "guardians",
        "staff",
        "exceptions",
        "reviews",
        "relationships",
      ] as const) {
        v[name].forEach((r, i) => {
          if (r.schoolId !== v.school.id)
            issue([name, i], "Record belongs to another school");
          if ("academicYearId" in r && r.academicYearId !== v.calendar.year.id)
            issue([name, i], "Record belongs to another academic year");
        });
      }
      const classIds = new Set(v.classes.map((r) => r.id));
      const studentIds = new Set(v.students.map((r) => r.id));
      const guardianIds = new Set(v.guardians.map((r) => r.id));
      const staffIds = new Set(v.staff.map((r) => r.id));
      if (
        new Set(
          v.classes.map(
            (r) => `${r.grade.toLowerCase()}:${r.section.toLowerCase()}`,
          ),
        ).size !== v.classes.length
      )
        issue(["classes"], "Grade and section combinations must be unique");
      if (
        new Set(v.students.map((r) => r.admissionNumber)).size !==
        v.students.length
      )
        issue(["students"], "Admission numbers must be unique");
      if (
        new Set(v.relationships.map((r) => `${r.studentId}:${r.guardianId}`))
          .size !== v.relationships.length
      )
        issue(["relationships"], "Guardian links must be unique");
      v.students.forEach((r, i) => {
        if (!classIds.has(r.classSectionId))
          issue(
            ["students", i, "classSectionId"],
            "Choose an existing section",
          );
      });
      v.classes.forEach((r, i) => {
        if (
          inactiveStudentIds !== null &&
          v.students.filter(
            (s) => s.classSectionId === r.id && !inactiveStudentIds.has(s.id),
          ).length > r.capacity
        )
          issue(
            ["classes", i, "capacity"],
            "Capacity cannot be below enrolled student count",
          );
      });
      v.relationships.forEach((r, i) => {
        if (!studentIds.has(r.studentId) || !guardianIds.has(r.guardianId))
          issue(
            ["relationships", i],
            "Guardian link must reference existing records",
          );
      });
      v.allocations.forEach((r, i) => {
        if (!classIds.has(r.classSectionId) || !staffIds.has(r.staffId))
          issue(
            ["allocations", i],
            "Select an existing staff member and section",
          );
      });
      if (
        new Set(
          v.allocations.map(
            (r) => `${r.classSectionId}:${r.subject.toLowerCase()}`,
          ),
        ).size !== v.allocations.length
      )
        issue(
          ["allocations"],
          "A subject can have only one teacher per section",
        );
      v.bells.forEach((slot, i) => {
        if (
          v.bells
            .slice(0, i)
            .some((p) => slot.start < p.end && slot.end > p.start)
        )
          issue(["bells", i, "start"], "Periods and breaks cannot overlap");
      });
      if (v.completed.length >= 4 && !v.bells.some((b) => b.kind === "period"))
        issue(["bells"], "Add at least one teaching period");
      if (v.completed.length >= 2 && !v.calendar.terms.length)
        issue(["calendar", "terms"], "Add at least one term");
      for (const [field, step] of [
        ["classes", 3],
        ["fees", 5],
        ["staff", 6],
        ["allocations", 6],
      ] as const) {
        if (v.completed.length >= step && !v[field].length)
          issue([field], "Add at least one record before completing this step");
      }
      if (v.completed.some((id, i) => id !== setupPhaseIds[i]))
        issue(["completed"], "Complete setup steps in prerequisite order");
      if (
        v.completed.length >= 6 &&
        v.classes.some(
          (c) => !v.allocations.some((a) => a.classSectionId === c.id),
        )
      )
        issue(["allocations"], "Every section needs a staff allocation");
      if (
        v.completed.length >= 7 &&
        (!v.students.length || v.exceptions.length)
      )
        issue(
          ["exceptions"],
          "Import students and resolve every exception before sign-off",
        );
      if (
        v.completed.length === 8 &&
        (!(v.portal.parentEnabled || v.portal.staffEnabled) ||
          !v.portal.acknowledgeSimulation)
      )
        issue(["portal"], "Enable a portal and acknowledge mode");
      if (
        v.portal.invitationsPrepared &&
        (!v.portal.parentEnabled || !v.portal.acknowledgeSimulation)
      )
        issue(
          ["portal"],
          "Enable the parent portal and acknowledge mode before preparing invitations",
        );
      v.notifications.forEach((n, i) => {
        if (n.recipients.some((id) => !guardianIds.has(id)))
          issue(
            ["notifications", i],
            "Notification recipient must be an existing guardian",
          );
      });
    });
}
export const setupConfigSchema = setupConfigSchemaFor(new Set());
/** Capacity is checked against canonical student profiles by the workspace schema. */
export const canonicalSetupConfigSchema = setupConfigSchemaFor(null);
