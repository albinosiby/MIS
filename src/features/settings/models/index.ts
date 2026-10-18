import type { z } from "zod";
import type {
  preferenceSchema,
  approvalSchema,
  rolloverRequestSchema,
} from "../schemas/settings.schema.ts";
export type Preference = z.infer<typeof preferenceSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type RolloverRequest = z.infer<typeof rolloverRequestSchema>;

import type {advancedSettingsSchema, customFieldSchema, customValuesSchema, workflowApprovalSchema} from "../schemas/advanced.schema.ts";
export type AdvancedSettings=z.infer<typeof advancedSettingsSchema>;
export type CustomFieldDefinition=z.infer<typeof customFieldSchema>;
export type CustomRecordValues=z.infer<typeof customValuesSchema>;
export type WorkflowApproval=z.infer<typeof workflowApprovalSchema>;
