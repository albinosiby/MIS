import type { SchoolYearWorkspace } from "../models/index.ts";
import type { SetupConfig } from "../../school-setup/models/index.ts";
import { setupConfigSchemaFor } from "../../school-setup/schemas/setup-config.schema.ts";
/** Retain the legacy setup log while connecting newly prepared messages to the operational noticeboard. */
export function connectSetupUpdate(
  current: SchoolYearWorkspace,
  input: SetupConfig,
  action: string,
) {
  const setup = setupConfigSchemaFor(new Set(current.records.studentProfiles.filter(p=>p.status!=="active").map(p=>p.studentId))).parse(input),
    fresh = setup.notifications.filter(
      (n) => !current.setup.notifications.some((old) => old.id === n.id),
    );
  const scope = {
    schoolId: setup.school.id,
    academicYearId: setup.calendar.year.id,
  };
  return {
    ...current,
    setup,
    records: {
      ...current.records,
      notices: [
        ...current.records.notices,
        ...fresh.map((n) => ({
          ...scope,
          id: "setup-" + n.id,
          title: "School setup · Guardian notification",
          body: `${action}. Prepared for ${n.recipients.length} permitted guardian recipients. Simulation only.`,
          priority: "normal" as const,
          audience: "guardians" as const,
          classSectionIds: [],
          channels: ["App" as const],
          status: "published" as const,
          scheduledFor: null,
          recipientIds: n.recipients,
          acknowledgedIds: [],
        })),
      ],
      notifications: [
        ...current.records.notifications,
        ...fresh.map((n) => ({
          ...scope,
          id: "setup-" + n.id,
          title: "Setup notification prepared",
          body: `${n.recipients.length} guardian recipients · simulation only`,
          category: "general" as const,
          createdAt: n.at,
          read: false,
          href: "/communication",
        })),
      ].slice(-2000),
    },
  };
}
