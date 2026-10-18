import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const studentEventSchema = z.strictObject({
  id: identifierSchema,
  studentId: identifierSchema,
  kind: z.enum([
    "enrolled",
    "class-changed",
    "transferred",
    "withdrawn",
    "guardian-linked",
    "document-issued",
  ]),
  date: localDateSchema,
  note: z.string().trim().min(2).max(500),
  actorId: identifierSchema,
  fromClassId: identifierSchema.optional(),
  toClassId: identifierSchema.optional(),
});
