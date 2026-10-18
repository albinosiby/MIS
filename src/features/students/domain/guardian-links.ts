import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import { guardianLinkRequestSchema } from "../schemas/students.schema.ts";
import { schoolYearWorkspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
export function saveGuardianLink(y: SchoolYearWorkspace, input: unknown) {
  const value = guardianLinkRequestSchema.parse(input);
  if (
    value.schoolId !== y.setup.school.id ||
    value.academicYearId !== y.setup.calendar.year.id
  )
    throw new Error("Guardian link belongs to another school/year.");
  const { academicYearId, ...link } = value;
  return schoolYearWorkspaceSchema.parse({
    ...y,
    setup: {
      ...y.setup,
      relationships: [
        ...y.setup.relationships.filter(
          (r) =>
            !(
              r.studentId === link.studentId && r.guardianId === link.guardianId
            ),
        ),
        link,
      ],
      completed: y.setup.completed.slice(0, 6),
      portal: {
        ...y.setup.portal,
        invitationsPrepared: false,
        acknowledgeSimulation: false,
      },
    },
  });
}
