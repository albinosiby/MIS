import { z } from "zod";
import {
  scopedRecordSchema,
  attachmentSchema,
} from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  emailSchema,
  phoneSchema,
  localDateSchema,
  displayNameSchema,
} from "../../../shared/schemas/primitives.ts";
export const staffProfileSchema = scopedRecordSchema.extend({
  staffId: identifierSchema,
  email: emailSchema,
  phone: phoneSchema,
  department: displayNameSchema,
  joinedOn: localDateSchema,
  employment: z.enum(["Full-time", "Part-time", "Contract"]),
  roleId: identifierSchema,
  documents: z.array(attachmentSchema).max(20),
  bio: z.string().trim().max(1000),
});
export const roleSchema = scopedRecordSchema.extend({
  name: displayNameSchema,
  permissions: z
    .array(
      z.enum([
        "students:read",
        "students:write",
        "staff:read",
        "staff:write",
        "attendance:write",
        "academics:write",
        "exams:write",
        "fees:write",
        "notices:write",
        "settings:write",
        "audit:read",
      ]),
    )
    .max(11),
});
export const staffOnboardRequestSchema = staffProfileSchema
  .omit({ id: true, schoolId: true, academicYearId: true, staffId: true })
  .extend({ displayName: displayNameSchema, designation: displayNameSchema });
