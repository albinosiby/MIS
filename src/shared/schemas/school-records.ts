import { z } from "zod";
import { studentSummarySchema, guardianSummarySchema } from "./people.ts";
import { emailSchema, identifierSchema, phoneSchema } from "./primitives.ts";

// Small operational records shared by setup and the future directories.
export const enrolledStudentSchema = studentSummarySchema.extend({
  academicYearId: identifierSchema,
  classSectionId: identifierSchema,
});
export const guardianContactSchema = guardianSummarySchema.extend({
  email: emailSchema,
  phone: phoneSchema,
});
