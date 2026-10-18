import { workflowStateSchema } from "../../workspace/schemas/workflow-state.schema.ts";
import type { Workspace } from "../../workspace/models/index.ts";
import { cloudProjectionSchema } from "../schemas/cloud.schema.ts";
/** Published school website projection. It contains no people, transactions or certificate registry. */
export function projectCloudPublicWorkspace(root: Workspace) {
  return cloudProjectionSchema.parse({
    ...root,
    years: root.years
      .filter((y) => y.setup.calendar.year.id === root.activeYearId)
      .map((y) => {
        const release = y.workflows.websiteReleases.find(
          (release) => release.id === y.workflows.activeWebsiteReleaseId,
        );
        const records = { ...y.records };
        for (const key of Object.keys(records))
          if (Array.isArray(records[key as keyof typeof records]))
            (records as Record<string, unknown>)[key] = [];
        records.preferences = {
          ...records.preferences,
          principalBio: "",
          qualification: "",
          emergencyAlerts: false,
          auditAlerts: false,
          weeklyDigest: false,
          schoolCode: "",
          letterheadFooter: "",
          demoMfa: false,
        };
        records.admissionForms = y.records.admissionForms;
        return {
          ...y,
          setup: {
            ...y.setup,
            school: release?.school ?? y.setup.school,
            students: [],
            staff: [],
            guardians: [],
            relationships: [],
            allocations: [],
            fees: [],
            exceptions: [],
            reviews: [],
            audit: [],
            notifications: [],
            completed: [],
          },
          records,
          workflows: workflowStateSchema.parse({}),
          extensions: release?.content ?? [],
        };
      }),
  });
}
