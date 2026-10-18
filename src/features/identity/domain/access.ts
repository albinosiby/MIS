import type { Role } from "../models/index.ts";
export function roleHome(role: Role) {
  const operations: Partial<Record<Role, string>> = {
    nurse: "/health",
    counsellor: "/wellbeing",
    librarian: "/library",
    hr: "/hr",
    transport: "/transport",
    inventory: "/inventory",
    warden: "/hostel",
  };
  if (operations[role]) return operations[role]!;
  return role === "admin" || role === "principal"
    ? "/dashboard"
    : role === "accountant"
      ? "/fees"
      : `/${role === "staff" ? "staff-portal" : role}`;
}
const areaGrants: Partial<Record<Role, string[]>> = {
  accountant: ["fees", "profile", "notifications", "support"],
  hr: ["hr", "staff", "attendance", "profile", "notifications", "support"],
  librarian: ["library", "profile", "notifications", "support"],
  nurse: ["health", "profile", "notifications", "support"],
  counsellor: ["wellbeing", "profile", "notifications", "support"],
  transport: ["transport", "profile", "notifications", "support"],
  inventory: ["inventory", "profile", "notifications", "support"],
  warden: ["hostel", "profile", "notifications", "support"],
};
export function canAccess(role: Role, path: string) {
  const clean = path.split("?")[0];
  const area = clean.split("/")[1];
  if (
    role === "teacher" &&
    [
      "/exams/reviews",
      "/timetable/versions",
      "/timetable/substitutions",
    ].includes(clean)
  )
    return true;
  if (
    [
      "account",
      "select-school",
      "select-role",
      "access-denied",
      "workspace",
    ].includes(area)
  )
    return true;
  if (area === "support") return !["platform", "group"].includes(role);
  if (clean === "/communication/inbox")
    return !["platform", "group"].includes(role);
  if (clean === "/documents/issue")
    return ["admin", "principal"].includes(role);
  if (["/documents/files", "/documents/publications"].includes(clean))
    return !["platform", "group"].includes(role);
  if (role === "hr" && area === "staff")
    return [
      "/staff",
      "/staff/new",
      "/staff/profile",
      "/staff/documentation",
      "/staff/onboarding",
    ].includes(clean);
  if (role === "hr" && area === "attendance")
    return ["/attendance/staff", "/attendance/leave"].includes(clean);
  if (role === "platform") return area === "platform";
  if (role === "group") return area === "group";
  if (["teacher", "staff-portal", "parent", "student", "driver"].includes(area))
    return area === (role === "staff" ? "staff-portal" : role);
  if (role === "admin" || role === "principal")
    return !["platform", "group"].includes(area);
  const portal = role === "staff" ? "staff-portal" : role;
  return area === portal || (areaGrants[role]?.includes(area) ?? false);
}
export function safeReturnPath(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n]/.test(value)
    ? value
    : "/dashboard";
}
