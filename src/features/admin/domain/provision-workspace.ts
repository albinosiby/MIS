import { workflowStateSchema } from "../../workspace/schemas/workflow-state.schema.ts";
import { institutionCreateSchema } from "../schemas/platform.schema.ts";
import { setupConfigSchema } from "../../school-setup/schemas/setup-config.schema.ts";
import {
  workspaceSchema,
  moduleRecordsSchema,
} from "../../workspace/schemas/workspace.schema.ts";
/** New institutions contain configuration only: never import example people or transactions. */
export function provisionWorkspace(input: unknown, schoolId: string) {
  const v = institutionCreateSchema.parse(input),
    yearId = `year-${v.requestId}`;
  const setup = setupConfigSchema.parse({
    version: 1,
    revision: 0,
    school: { ...v.school, id: schoolId },
    calendar: { year: { ...v.year, id: yearId, schoolId }, terms: [] },
    branding: { logo: null },
    classes: [],
    bells: [],
    fees: [],
    concessionPercent: 0,
    staff: [
      {
        id: `administrator-${v.requestId}`,
        schoolId,
        displayName: v.administratorName,
        designation: "Administrator",
      },
    ],
    allocations: [],
    students: [],
    guardians: [],
    relationships: [],
    exceptions: [],
    reviews: [],
    portal: {
      parentEnabled: false,
      staffEnabled: false,
      invitationsPrepared: false,
      acknowledgeSimulation: false,
    },
    completed: [],
    audit: [],
    notifications: [],
  });
  const empty = Object.fromEntries(
    Object.keys(moduleRecordsSchema.shape)
      .filter((k) => k !== "preferences")
      .map((k) => [k, []]),
  );
  const workflows = workflowStateSchema.parse({});
  workflows.advanced.timezone = v.school.timezone;
  return workspaceSchema.parse({
    version: 2,
    revision: 0,
    activeYearId: yearId,
    years: [
      {
        setup,
        records: {
          ...empty,
          preferences: {
            language: "English",
            dateFormat: "DD MMM YYYY",
            workingDays: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
            ],
            principalBio: "",
            qualification: "",
            emergencyAlerts: true,
            auditAlerts: true,
            weeklyDigest: false,
            schoolCode: "",
            letterheadFooter: "",
          },
        },
        workflows,
        extensions: [],
        locked: false,
      },
    ],
  });
}
