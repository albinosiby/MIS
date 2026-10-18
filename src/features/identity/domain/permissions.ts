import type { Role } from "../models/index.ts";
/** School roles are server-owned Auth membership roles, not editable HR labels. */
export const schoolRoles = ["admin", "principal", "teacher", "staff", "accountant", "parent", "student", "driver", "librarian", "hr", "nurse", "counsellor", "transport", "inventory", "warden"] as const satisfies readonly Role[];
export function isSchoolRole(role: Role) { return (schoolRoles as readonly string[]).includes(role); }
export function personKindForRole(role: Role) {
  if (!isSchoolRole(role) || ["admin", "principal"].includes(role)) return null;
  return role === "parent" ? "guardian" : role === "student" ? "student" : "staff";
}
export function mayManageBilling(role: Role) { return ["admin", "principal", "accountant"].includes(role); }
export function mayManageEmployment(role: Role) { return ["admin", "principal", "hr"].includes(role); }
