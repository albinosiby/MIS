/** Isolated synthetic fixture used for browser workflow and year-end recovery checks. */
import { writeFileSync } from "node:fs";
import { createWorkspace } from "../src/features/workspace/data/workspace-seed.ts";
import { workspaceSchema } from "../src/features/workspace/schemas/workspace.schema.ts";
import {
  scope,
  decideApproval,
  decideLeave,
} from "../src/features/workspace/domain/operations.ts";
import { completeSetupStep } from "../src/features/school-setup/domain/setup-workflow.ts";
import { reviewException } from "../src/features/school-setup/domain/review-exception.ts";
import { connectSetupUpdate } from "../src/features/workspace/domain/setup-bridge.ts";
import {
  autoScheduleExam,
  publishExam,
  saveMarks,
  completeExam,
} from "../src/features/exams/domain/exam-workflow.ts";
const root = createWorkspace();
let year = root.years[0],
  setup = structuredClone(year.setup);
for (const record of [...setup.exceptions]) {
  const result = reviewException(
    setup.exceptions,
    {
      ...scope(year),
      exceptionId: record.id,
      note: "Reviewed synthetic audit fixture evidence.",
    },
    scope(year),
  );
  if (!result.success) throw new Error("Could not prepare setup fixture.");
  setup = {
    ...setup,
    exceptions: result.records,
    reviews: [...setup.reviews, result.review],
  };
}
setup = completeSetupStep(setup, "data-ingestion", setup);
setup = completeSetupStep(setup, "portal-gateway", {
  ...setup,
  portal: {
    ...setup.portal,
    invitationsPrepared: true,
    acknowledgeSimulation: true,
  },
});
year = connectSetupUpdate(year, setup, "Prepared isolated audit workspace");
for (const approval of [...year.records.approvals])
  if (approval.status === "pending")
    year = decideApproval(
      year,
      approval.id,
      "approved",
      "Approved synthetic audit request.",
    );
for (const leave of [...year.records.leaves])
  if (leave.status === "pending")
    year = decideLeave(
      year,
      leave.id,
      "approved",
      "Approved synthetic audit leave.",
    );
for (const exam of [...year.records.exams]) {
  year = autoScheduleExam(year, exam.id);
  year = publishExam(year, exam.id);
  for (const classSectionId of exam.classSectionIds)
    for (const subjectId of exam.subjectIds)
      year = saveMarks(year, {
        ...scope(year),
        examId: exam.id,
        classSectionId,
        subjectId,
        entries: year.setup.students
          .filter((s) => s.classSectionId === classSectionId)
          .map((s) => ({ studentId: s.id, marks: 77 })),
      });
  year = completeExam(year, exam.id);
}
year.records.promotions = year.setup.students.map((s) => ({
  ...scope(year),
  id: "audit-promotion-" + s.id,
  studentId: s.id,
  targetClassId: s.classSectionId,
  decision: "retain",
  note: "Reviewed synthetic retention directive.",
}));
year.records.routes.push({
  ...year.records.routes[0],
  id: "audit-custom-route",
  name: "Audit custom bus route",
});
year.records.studentProfiles[0].routeId = "audit-custom-route";
root.years[0] = year;
const parsed = workspaceSchema.parse(root),
  output = process.argv[2] ?? "/tmp/mis-ui-audit.json";
writeFileSync(output, JSON.stringify(parsed, null, 2));
console.log(`Validated synthetic audit fixture: ${output}`);
