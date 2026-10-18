import { z } from "zod";
import {
  scopedRecordSchema,
  weekdaySchema,
} from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  displayNameSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const timetableSlotSchema = scopedRecordSchema.extend({
  classSectionId: identifierSchema,
  staffId: identifierSchema,
  subjectId: identifierSchema,
  weekday: weekdaySchema,
  periodId: identifierSchema,
  room: displayNameSchema,
  status: z.enum(["draft", "published"]),
});
export const substitutionSchema = scopedRecordSchema.extend({
  slotId: identifierSchema,
  date: localDateSchema,
  absentStaffId: identifierSchema,
  substituteStaffId: identifierSchema,
  reason: z.string().trim().min(8).max(500),
  status: z.enum(["draft", "published"]),
});
export const roomSchema = scopedRecordSchema.extend({
  name: displayNameSchema,
  capacity: z.number().int().min(1).max(1000),
  type: z.enum(["Classroom", "Laboratory", "Auditorium", "Sports"]),
});
export const roomReservationSchema = scopedRecordSchema.extend({
  room: displayNameSchema,
  date: localDateSchema,
  periodId: identifierSchema,
  title: displayNameSchema,
});
