import type { z } from "zod";
import type {
  operationRecordSchema,
  operationRequestSchema,
} from "../schemas/operations.schema.ts";
/** Common table/workflow projection. Feature-specific request models live in each module’s models/operations.ts. */
export type OperationRecord = z.infer<typeof operationRecordSchema>;
export type OperationRequest = z.input<typeof operationRequestSchema>;
