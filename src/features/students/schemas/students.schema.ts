import { z } from "zod";
import { guardianRelationshipSchema } from "../../../shared/schemas/people.ts";
import {
  scopedRecordSchema,
  attachmentSchema,
} from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  localDateSchema,
  displayNameSchema,
} from "../../../shared/schemas/primitives.ts";
export const studentProfileSchema = scopedRecordSchema.extend({
  studentId: identifierSchema,
  dateOfBirth: localDateSchema,
  gender: z.enum(["Female", "Male", "Other", "Prefer not to say"]),
  address: z.string().trim().min(1).max(500),
  emergencyName: displayNameSchema,
  emergencyPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  bloodGroup: z.enum([
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-",
    "Unknown",
  ]),
  medicalNotes: z.string().trim().max(500),
  routeId: identifierSchema.nullable(),
  status: z.enum(["active", "transferred", "alumni"]),
  documents: z.array(attachmentSchema).max(20),
});
export const busRouteSchema = scopedRecordSchema.extend({
  name: displayNameSchema,
  vehicle: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(100),
  stops: z
    .array(
      z.strictObject({
        id: identifierSchema,
        name: displayNameSchema,
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .min(1)
    .max(30),
});
export const certificateSchema = scopedRecordSchema.extend({
  studentId: identifierSchema,
  type: z.enum([
    "Bonafide",
    "Transfer Certificate",
    "Study Certificate",
    "ID Card",
  ]),
  issuedOn: localDateSchema,
  status: z.enum(["draft", "issued"]),
  reference: identifierSchema,
});
export const promotionSchema = scopedRecordSchema.extend({
  studentId: identifierSchema,
  targetClassId: identifierSchema,
  decision: z.enum(["promote", "retain", "transfer"]),
  note: z.string().trim().max(500),
});
export const enrolStudentRequestSchema = z.strictObject({
  studentName: displayNameSchema,
  admissionNumber: identifierSchema,
  dateOfBirth: localDateSchema,
  gender: z.enum(["Female", "Male", "Other", "Prefer not to say"]),
  classSectionId: identifierSchema,
  address: z.string().trim().min(1).max(500),
  guardianName: displayNameSchema,
  email: z.email(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  existingGuardianId: identifierSchema.nullable(),
  emergencyName: displayNameSchema,
  emergencyPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  routeId: identifierSchema.nullable(),
  documents: z.array(attachmentSchema).max(20),
  generateInvoice: z.boolean(),
  inquiryId: identifierSchema.nullable(),
});

export const guardianLinkRequestSchema = guardianRelationshipSchema.extend({
  academicYearId: identifierSchema,
});
