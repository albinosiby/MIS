import { projectWorkflowState } from "../../workspace/domain/workflow-projection.ts";
import { isSchoolRole } from "../../identity/domain/permissions.ts";
import { canReadPortalNotice } from "../../portals/domain/notice-access.ts";
import type { Workspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import { cloudProjectionSchema } from "../schemas/cloud.schema.ts";
import {
  scopedStudentIds,
  visibleOperations,
} from "../../operations/domain/operations.ts";
export function projectCloudWorkspace(root: Workspace, actor: AccountIdentity) {
  if (!isSchoolRole(actor.role))
    throw new Error("A school membership is required.");
  if (root.years.some((y) => y.setup.school.id !== actor.schoolId))
    throw new Error("School is inaccessible.");
  if (["admin", "principal"].includes(actor.role))
    return cloudProjectionSchema.parse(root);
  return cloudProjectionSchema.parse({
    ...root,
    years: root.years.map((y) => {
      const family = ["parent", "student"].includes(actor.role),
        teacher = actor.role === "teacher";
      const directory = [
        "accountant",
        "librarian",
        "nurse",
        "counsellor",
        "transport",
        "warden",
      ].includes(actor.role);
      const ids =
        family || teacher || actor.role === "driver"
          ? scopedStudentIds(y, actor)
          : directory
            ? y.setup.students.map((s) => s.id)
            : [];
      const students = y.setup.students.filter((s) => ids.includes(s.id));
      const classIds = students.map((s) => s.classSectionId);
      const allocations = y.setup.allocations.filter(
        (a) =>
          classIds.includes(a.classSectionId) &&
          (family || a.staffId === actor.personId),
      );
      const staffIds = new Set([
        ...allocations.map((a) => a.staffId),
        actor.personId,
        ...(["hr", "transport"].includes(actor.role)
          ? y.setup.staff.map((s) => s.id)
          : []),
        ...(teacher ? y.setup.staff.map((s) => s.id) : []),
      ]);
      const homework = y.records.homework.filter(
        (h) =>
          classIds.includes(h.classSectionId) &&
          (!teacher || h.staffId === actor.personId),
      );
      const invoices =
        actor.role === "accountant"
          ? y.records.invoices
          : family
            ? y.records.invoices.filter((i) => ids.includes(i.studentId))
            : [];
      const records = { ...y.records };
      for (const key of Object.keys(records))
        if (Array.isArray(records[key as keyof typeof records]))
          (records as Record<string, unknown>)[key] = [];
      records.subjects = teacher || family ? y.records.subjects : [];
      records.homework = homework;
      records.submissions = y.records.submissions.filter(
        (s) =>
          ids.includes(s.studentId) &&
          homework.some((h) => h.id === s.homeworkId),
      );
      records.attendance = y.records.attendance.filter((a) =>
        a.personType === "student"
          ? ids.includes(a.personId)
          : a.personId === actor.personId,
      );
      records.leaves = y.records.leaves.filter((l) =>
        l.personType === "student"
          ? family && ids.includes(l.personId)
          : l.personId === actor.personId,
      );
      const publishedSlots =
        y.workflows.timetableVersions
          .at(-1)
          ?.slots.map(
            ({
              className: _c,
              subjectName: _s,
              teacherName: _t,
              periodName: _p,
              ...slot
            }) => slot,
          ) ?? y.records.slots;
      const coverSlotIds = teacher
        ? y.records.substitutions
            .filter(
              (s) =>
                s.status === "published" &&
                s.substituteStaffId === actor.personId,
            )
            .map((s) => s.slotId)
        : [];
      records.slots = publishedSlots.filter(
        (t) =>
          t.status === "published" &&
          ((classIds.includes(t.classSectionId) &&
            (!teacher || t.staffId === actor.personId)) ||
            coverSlotIds.includes(t.id)),
      );
      records.substitutions = y.records.substitutions
        .filter(
          (s) =>
            s.status === "published" &&
            (records.slots.some((slot) => slot.id === s.slotId) ||
              (teacher && s.substituteStaffId === actor.personId)),
        )
        .map((s) =>
          family ? { ...s, reason: "Published teaching cover." } : s,
        );
      records.exams = y.records.exams.filter((e) =>
        e.classSectionIds.some((c) => classIds.includes(c)),
      );
      records.marks = y.records.marks.filter(
        (m) =>
          ids.includes(m.studentId) &&
          (teacher
            ? y.setup.allocations.some(
                (a) =>
                  a.staffId === actor.personId &&
                  a.classSectionId ===
                    students.find((s) => s.id === m.studentId)
                      ?.classSectionId &&
                  a.subject ===
                    y.records.subjects.find((s) => s.id === m.subjectId)?.name,
              )
            : records.exams.some(
                (e) => e.id === m.examId && e.status === "completed",
              )),
      );
      records.lessons = teacher
        ? y.records.lessons.filter((l) => l.staffId === actor.personId)
        : [];
      records.units = teacher
        ? y.records.units.filter((u) =>
            allocations.some(
              (a) =>
                a.classSectionId === u.classSectionId &&
                y.records.subjects.some(
                  (s) => s.id === u.subjectId && s.name === a.subject,
                ),
            ),
          )
        : [];
      records.invoices = invoices;
      records.payments = y.records.payments.filter((p) =>
        invoices.some((i) => i.id === p.invoiceId),
      );
      records.staffProfiles = y.records.staffProfiles.filter(
        (p) => p.staffId === actor.personId,
      );
      records.studentProfiles = family
        ? y.records.studentProfiles.filter((p) => ids.includes(p.studentId))
        : [];
      records.routes = family
        ? y.records.routes.filter(
            (r) =>
              records.studentProfiles.some((p) => p.routeId === r.id) ||
              y.extensions.some(
                (a) =>
                  a.kind === "transport-allocations" &&
                  a.status === "active" &&
                  ids.includes(a.studentId ?? "") &&
                  a.values.routeId === r.id,
              ),
          )
        : [];
      records.notices = y.records.notices
        .filter((n) => canReadPortalNotice(y, actor, n))
        .map((n) => ({
          ...n,
          recipientIds: [actor.personId!],
          acknowledgedIds: n.acknowledgedIds.filter(
            (id) => id === actor.personId,
          ),
        }));
      records.events = y.records.events.filter(
        (e) =>
          e.status === "published" &&
          (!e.classSectionIds.length ||
            e.classSectionIds.some((c) => classIds.includes(c))),
      );
      records.certificates = family
        ? y.records.certificates.filter((c) => ids.includes(c.studentId))
        : [];
      if (actor.role === "hr") {
        records.staffProfiles = y.records.staffProfiles;
        records.roles = y.records.roles;
        records.attendance = y.records.attendance.filter(
          (a) => a.personType === "staff",
        );
        records.leaves = y.records.leaves.filter(
          (a) => a.personType === "staff",
        );
      }
      if (["transport", "driver"].includes(actor.role))
        records.routes =
          actor.role === "transport"
            ? y.records.routes
            : y.records.routes.filter((r) =>
                y.extensions.some(
                  (t) =>
                    t.kind === "trips" &&
                    t.staffId === actor.personId &&
                    t.status !== "cancelled" &&
                    t.values.routeId === r.id,
                ),
              );
      // Specialist projections explicitly withhold unrelated record collections.
      if (!["parent", "student", "teacher", "staff"].includes(actor.role)) {
        const allowed =
          actor.role === "accountant"
            ? ["invoices", "payments"]
            : actor.role === "hr"
              ? ["staffProfiles", "roles", "attendance", "leaves"]
              : ["transport", "driver"].includes(actor.role)
                ? ["routes"]
                : [];
        for (const key of Object.keys(records))
          if (
            Array.isArray(records[key as keyof typeof records]) &&
            !allowed.includes(key)
          )
            (records as Record<string, unknown>)[key] = [];
      }
      const kinds = [...new Set(y.extensions.map((r) => r.kind))];
      return {
        ...y,
        workflows: projectWorkflowState(y, actor),
        setup: {
          ...y.setup,
          students,
          classes: y.setup.classes.filter(
            (c) =>
              classIds.includes(c.id) ||
              (teacher && records.slots.some((s) => s.classSectionId === c.id)),
          ),
          staff: y.setup.staff.filter((s) => staffIds.has(s.id)),
          allocations,
          fees: actor.role === "accountant" ? y.setup.fees : [],
          guardians: y.setup.guardians.filter(
            (g) => actor.role === "parent" && g.id === actor.personId,
          ),
          relationships: y.setup.relationships.filter(
            (r) =>
              actor.role === "parent" &&
              r.guardianId === actor.personId &&
              ids.includes(r.studentId),
          ),
          exceptions: [],
          reviews: [],
          audit: [],
          notifications: [],
        },
        records,
        extensions: kinds.flatMap((kind) => visibleOperations(y, actor, kind)),
      };
    }),
  });
}
