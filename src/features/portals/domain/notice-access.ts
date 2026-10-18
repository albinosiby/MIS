import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import type { Notice } from "../../communication/models/index.ts";
/** Materialised recipient lists do not override a guardian's current notice permissions. */
export function canReadPortalNotice(
  year: SchoolYearWorkspace,
  actor: AccountIdentity,
  notice: Notice,
) {
  if (
    actor.schoolId !== year.setup.school.id ||
    notice.status !== "published" ||
    !actor.personId
  )
    return false;
  if (actor.role === "student")
    return (
      notice.audience === "all" &&
      year.setup.students.some(
        (student) =>
          student.id === actor.personId &&
          (!notice.classSectionIds.length ||
            notice.classSectionIds.includes(student.classSectionId)) &&
          !year.records.studentProfiles.some(
            (profile) =>
              profile.studentId === student.id && profile.status !== "active",
          ),
      )
    );
  if (!notice.recipientIds.includes(actor.personId)) return false;
  if (actor.role !== "parent") return true;
  if (notice.audience === "staff") return false;
  return year.setup.relationships.some(
    (link) =>
      link.guardianId === actor.personId &&
      link.canReceiveNotices &&
      year.setup.students.some(
        (student) =>
          student.id === link.studentId &&
          (!notice.classSectionIds.length ||
            notice.classSectionIds.includes(student.classSectionId)),
      ),
  );
}
