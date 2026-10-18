import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { admissionStageSchema } from "./admissions.schema.ts";
export const admissionTransitionSchema = z.strictObject({
  id: identifierSchema,
  stage: admissionStageSchema,
});
