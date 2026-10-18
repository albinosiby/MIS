import { z } from "zod";
import {
  countSchema,
  displayNameSchema,
  identifierSchema,
  localDateSchema,
} from "./primitives.ts";

const dateRange = { startDate: localDateSchema, endDate: localDateSchema };
export const academicYearSchema = z
  .strictObject({
    id: identifierSchema,
    schoolId: identifierSchema,
    name: displayNameSchema,
    ...dateRange,
  })
  .refine((value) => value.startDate < value.endDate, {
    path: ["endDate"],
    message: "Academic year must end after it starts",
  }).refine(v=>(Date.parse(v.endDate)-Date.parse(v.startDate))/86400000<=550,{path:["endDate"],message:"Academic year cannot span more than 550 days."});
export const academicTermSchema = z
  .strictObject({
    id: identifierSchema,
    schoolId: identifierSchema,
    academicYearId: identifierSchema,
    name: displayNameSchema,
    ...dateRange,
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "Term must not end before it starts",
  });
export const classSectionSchema = z.strictObject({
  id: identifierSchema,
  schoolId: identifierSchema,
  academicYearId: identifierSchema,
  grade: displayNameSchema,
  section: z.string().trim().min(1).max(40),
  capacity: countSchema.min(1),
});

export const academicCalendarSchema = z
  .strictObject({
    year: academicYearSchema,
    terms: z.array(academicTermSchema).max(24),
  })
  .superRefine(({ year, terms }, ctx) => {
    const ids = new Set<string>();
    terms.forEach((term, index) => {
      const add = (field: string, message: string) =>
        ctx.addIssue({
          code: "custom",
          path: ["terms", index, field],
          message,
        });
      if (ids.has(term.id)) add("id", "Term IDs must be unique");
      ids.add(term.id);
      if (term.schoolId !== year.schoolId)
        add("schoolId", "Term must belong to the same school");
      if (term.academicYearId !== year.id)
        add("academicYearId", "Term must belong to the selected academic year");
      if (term.startDate < year.startDate || term.endDate > year.endDate)
        add("startDate", "Term must be within the academic year");
      if (
        terms
          .slice(0, index)
          .some(
            (previous) =>
              term.startDate <= previous.endDate &&
              term.endDate >= previous.startDate,
          )
      )
        add("startDate", "Academic terms must not overlap");
    });
  });
