import type { z } from "zod";
import type {
  moduleRecordsSchema,
  schoolYearWorkspaceSchema,
  workspaceSchema,
} from "../schemas/workspace.schema.ts";
export type ModuleRecords = z.infer<typeof moduleRecordsSchema>;
export type SchoolYearWorkspace = z.infer<typeof schoolYearWorkspaceSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
import type { z as WorkflowZ } from "zod";
import type { workflowStateSchema } from "../schemas/workflow-state.schema.ts";
export type WorkflowState = WorkflowZ.infer<typeof workflowStateSchema>;

export type WorkflowCommand = import("zod").z.infer<typeof import("../schemas/workflow-command.schema.ts").workflowCommandSchema>;
