import type { AccountIdentity } from "../../identity/models/index.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type {
  Conversation,
  ConversationContact,
  QuietHours,
} from "../models/index.ts";
import { isSchoolRole } from "../../identity/domain/permissions.ts";
/** Thread participants and current child/teaching relationships are independent checks. */
export function mayDiscussStudent(
  y: SchoolYearWorkspace,
  actor: Pick<AccountIdentity, "role" | "personId" | "schoolId">,
  studentId: string | null,
) {
  if (!isSchoolRole(actor.role) || actor.schoolId !== y.setup.school.id)
    return false;
  if (studentId === null) return !["parent", "student"].includes(actor.role);
  const student = y.setup.students.find((s) => s.id === studentId);
  if (!student) return false;
  if (actor.role === "parent")
    return y.setup.relationships.some(
      (l) =>
        l.guardianId === actor.personId &&
        l.studentId === studentId &&
        l.canViewRecords,
    );
  if (actor.role === "student") return actor.personId === studentId;
  if (actor.role === "teacher")
    return y.setup.allocations.some(
      (a) =>
        a.staffId === actor.personId &&
        a.classSectionId === student.classSectionId,
    );
  return ["admin", "principal", "staff"].includes(actor.role);
}
export function canContact(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  contact: ConversationContact,
  studentId: string | null,
) {
  if (
    contact.id === actor.id ||
    contact.schoolId !== actor.schoolId ||
    !mayDiscussStudent(y, actor, studentId) ||
    !mayDiscussStudent(y, contact, studentId)
  )
    return false;
  if (["parent", "student"].includes(actor.role))
    return ["admin", "principal", "teacher"].includes(contact.role);
  if (["parent", "student"].includes(contact.role))
    return ["admin", "principal", "teacher"].includes(actor.role);
  return true;
}
export function canReadConversation(
  y: SchoolYearWorkspace,
  actor: AccountIdentity,
  conversation: Conversation,
  participantIds: string[],
) {
  return (
    conversation.school_id === actor.schoolId &&
    conversation.academic_year_id === y.setup.calendar.year.id &&
    participantIds.includes(actor.id) &&
    mayDiscussStudent(y, actor, conversation.student_id)
  );
}
/** Find the next permitted instant using timezone-local hours, including DST transitions. */
export function nextMessageDelivery(now: Date, quiet: QuietHours) {
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: quiet.timezone,
    hour: "2-digit",
    hourCycle: "h23",
  });
  if (!quiet.enabled) return now.toISOString();
  const inside = (date: Date) => {
    const hour = Number(format.format(date));
    return quiet.start < quiet.end
      ? hour >= quiet.start && hour < quiet.end
      : hour >= quiet.start || hour < quiet.end;
  };
  if (!inside(now)) return now.toISOString();
  // Minute increments avoid assuming every local day has 24 hours.
  for (let minute = 1; minute <= 24 * 60; minute++) {
    const next = new Date(now.getTime() + minute * 60_000);
    if (!inside(next)) {
      next.setUTCSeconds(0, 0);
      return next.toISOString();
    }
  }
  throw new Error("Quiet hours could not be resolved.");
}
