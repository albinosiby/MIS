import { accountIdentitySchema } from "../schemas/identity.schema.ts";
export const testAccounts = accountIdentitySchema.array().parse(
  [
    ["admin", "Dr. Rajiv Sharma", null],
    ["principal", "School Principal", null],
    ["teacher", "Anita Nair", "staff-1"],
    ["staff", "Rahul Nair", "staff-2"],
    ["accountant", "Finance Officer", "staff-3"],
    ["parent", "Aarav’s Guardian", "guardian-1"],
    ["student", "Aarav Sharma", "student-1"],
    ["driver", "School Driver", "staff-4"],
    ["librarian", "School Librarian", "staff-5"],
    ["hr", "HR Manager", "staff-6"],
    ["nurse", "School Nurse", "staff-7"],
    ["counsellor", "School Counsellor", "staff-8"],
    ["transport", "Transport Manager", "staff-9"],
    ["inventory", "Store Manager", "staff-10"],
    ["warden", "Hostel Warden", "staff-11"],
    ["platform", "Platform Operator", null],
    ["group", "Group Director", null],
  ].map(([role, name, personId]) => ({
    id: `demo-${role}`,
    email: `${role}@greenfield.${["admin", "teacher", "staff", "parent", "student"].includes(String(role)) ? "test" : "demo"}`,
    name,
    role,
    schoolId: "school-greenfield",
    personId,
  })),
);
export const TEST_ACCOUNT_PASSWORD = "SchoolDemo123!";
