import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
export const timetableGenerateSchema = z.strictObject({
  maxPeriodsPerTeacherPerDay: z.number().int().min(1).max(12),
  requirements: z
    .array(
      z.strictObject({
        classSectionId: identifierSchema,
        subjectId: identifierSchema,
        staffId: identifierSchema,
        periodsPerWeek: z.number().int().min(1).max(40),
        room: z.string().trim().min(1).max(80),
      }),
    )
    .min(1)
    .max(300),
  days: z
    .array(
      z.enum([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ]),
    )
    .min(1)
    .max(6),
  unavailable: z
    .array(
      z.strictObject({
        staffId: identifierSchema,
        weekday: z.enum([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ]),
        periodId: identifierSchema,
      }),
    )
    .max(500)
    .default([]),
  replaceDrafts: z.boolean().default(false),
});
