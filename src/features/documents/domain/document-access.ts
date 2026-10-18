import type { AccountIdentity } from "../../identity/models/index.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { DocumentUpload, PrivateDocument } from "../models/index.ts";
import { isSchoolRole } from "../../identity/domain/permissions.ts";
/** Reevaluate current relationships on every read/write; uploader is not an access grant. */
export function canAccessDocument(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  doc: DocumentUpload,
  write = false,
  currentYear: SchoolYearWorkspace = y,
) {
  if (currentYear.setup.school.id !== a.schoolId) return false;
  if (write && a.blockedMutations?.includes("documents")) return false;
  if (
    !isSchoolRole(a.role) ||
    a.schoolId !== y.setup.school.id ||
    doc.yearId !== y.setup.calendar.year.id ||
    (write && y.locked)
  )
    return false;
  if (doc.ownerType === "admission") {
    const application = y.records.inquiries.find(
      (inquiry) => inquiry.id === doc.ownerId,
    );
    if (!application || !["general", "identity"].includes(doc.category))
      return false;
    if (["admin", "principal"].includes(a.role)) return true;
    if (
      write ||
      doc.category !== "identity" ||
      application.stage !== "enrolled" ||
      !application.studentId
    )
      return false;
    return a.role === "student"
      ? application.studentId === a.personId
      : a.role === "parent" &&
          currentYear.setup.relationships.some(
            (link) =>
              link.guardianId === a.personId &&
              link.studentId === application.studentId &&
              link.canViewRecords,
          );
  }
  const exists =
    doc.ownerType === "school"
      ? doc.ownerId === a.schoolId
      : doc.ownerType === "student"
        ? y.setup.students.some((s) => s.id === doc.ownerId)
        : y.setup.staff.some((s) => s.id === doc.ownerId);
  if (
    !exists ||
    (doc.ownerType === "school" && doc.category !== "general") ||
    (doc.category === "employment" && doc.ownerType !== "staff") ||
    (doc.category === "academic" && doc.ownerType !== "student")
  )
    return false;
  if (["admin", "principal"].includes(a.role)) return true;
  if (doc.ownerType === "school") return doc.category === "general" && !write;
  const family =
    doc.ownerType === "student" &&
    (a.role === "student"
      ? doc.ownerId === a.personId
      : a.role === "parent" &&
        currentYear.setup.relationships.some(
          (l) =>
            l.guardianId === a.personId &&
            l.studentId === doc.ownerId &&
            l.canViewRecords,
        ));
  if (["identity", "academic", "finance"].includes(doc.category) && family)
    return !write || doc.category !== "finance";
  if (
    doc.ownerType === "staff" &&
    a.personId === doc.ownerId &&
    doc.category === "employment"
  )
    return true;
  if (a.role === "hr")
    return (
      doc.ownerType === "staff" &&
      ["employment", "identity"].includes(doc.category)
    );
  if (a.role === "accountant") return doc.category === "finance";
  if (a.role === "nurse") return doc.category === "medical";
  if (a.role === "counsellor") return doc.category === "counselling";
  if (
    a.role === "teacher" &&
    doc.ownerType === "student" &&
    doc.category === "academic"
  )
    return currentYear.setup.allocations.some(
      (x) =>
        x.staffId === a.personId &&
        x.classSectionId ===
          currentYear.setup.students.find((s) => s.id === doc.ownerId)
            ?.classSectionId,
    );
  return false;
}
export function documentScope(d: PrivateDocument): DocumentUpload {
  return {
    yearId: d.academic_year_id,
    ownerType: d.owner_type,
    ownerId: d.owner_id,
    category: d.category,
    replacesId: d.replaces_id,
  };
}
export function canRevokeDocument(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  d: PrivateDocument,
  currentYear: SchoolYearWorkspace = y,
) {
  return (
    d.school_id === a.schoolId &&
    canAccessDocument(
      { ...y, locked: false },
      a,
      documentScope(d),
      true,
      currentYear,
    ) &&
    (["admin", "principal", "hr", "accountant", "nurse", "counsellor"].includes(
      a.role,
    ) ||
      d.created_by === a.id)
  );
}
