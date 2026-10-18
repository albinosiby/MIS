import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
import { certificateSchema } from "../../students/schemas/students.schema.ts";
export const certificateBulkSchema = z.strictObject({
  studentIds: z.array(identifierSchema).min(1).max(200),
  templateId: identifierSchema,
  type: certificateSchema.shape.type,
  issuedOn: localDateSchema,
});
