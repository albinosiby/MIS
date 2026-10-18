import { z } from "zod";
import { identifierSchema, localDateSchema } from "../../../shared/schemas/primitives.ts";
import { timetableSlotSchema, substitutionSchema } from "./timetable.schema.ts";
export const timetablePublishRequestSchema = z.strictObject({ classSectionId: identifierSchema.optional() });
export const timetableVersionSchema = z.strictObject({
  id: identifierSchema, version: z.number().int().positive(),
  publishedBy: identifierSchema, publishedAt: z.iso.datetime(),
  slots: z.array(timetableSlotSchema.extend({
    className: z.string().min(1).max(200), subjectName: z.string().min(1).max(200),
    teacherName: z.string().min(1).max(200), periodName: z.string().min(1).max(200),
  })).min(1).max(5000),
});
export const substitutionRequestSchema = z.strictObject({
  slotId: identifierSchema, date: localDateSchema, substituteStaffId: identifierSchema,
  reason: z.string().trim().min(8).max(500),
});
export const substitutionDecisionSchema = z.strictObject({
  id: identifierSchema, decision: z.enum(["approved", "rejected", "published", "cancelled"]),
  note: z.string().trim().min(8).max(500),
});
export const substitutionReviewSchema = z.strictObject({
  id: identifierSchema, substitution: substitutionSchema,
  requestedBy: identifierSchema, requestedAt: z.iso.datetime(),
  status: z.enum(["submitted", "approved", "rejected", "published", "cancelled"]),
  decisions: z.array(z.strictObject({
    actorId: identifierSchema, at: z.iso.datetime(),
    decision: z.enum(["approved", "rejected", "published", "cancelled"]),
    note: z.string().trim().min(8).max(500),
  })).max(3),
});
