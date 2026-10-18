import { z } from "zod";
import { scopedRecordSchema } from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  displayNameSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const operationBaseSchema = scopedRecordSchema.extend({
  kind: z.string().min(1).max(80),
  title: displayNameSchema,
  date: localDateSchema,
  studentId: identifierSchema.nullable(),
  staffId: identifierSchema.nullable(),
  status: z.string().min(1).max(40),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
  createdBy: identifierSchema,
  history: z
    .array(
      z.strictObject({
        at: z.iso.datetime(),
        actorId: identifierSchema,
        action: z.string().max(200),
      }),
    )
    .max(1000),
});
