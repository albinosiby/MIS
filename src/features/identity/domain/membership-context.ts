import type { Role,MembershipContext } from "../models/index.ts";
export function selectMembershipContext(
  rows: MembershipContext[],
  userId: string,
  requested: string | null,
) {
  const own = rows.filter((r) => r.user_id === userId && r.active);
  return (
    own.find((r) => r.membership_id === requested) ??
    own.find((r) => r.membership_id.startsWith("primary:")) ??
    own[0] ??
    null
  );
}
export function mayAssignSchoolRole(actor: Role, target: Role) {
  return actor === "admin"
    ? !["platform", "group"].includes(target)
    : actor === "principal" &&
        !["admin", "principal", "platform", "group"].includes(target);
}
