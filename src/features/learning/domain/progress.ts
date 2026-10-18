import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import {
  learningProgressRequestSchema,
  learningProgressSchema,
} from "../schemas/progress.schema.ts";
export function recordLearningProgress(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
): SchoolYearWorkspace {
  const r = learningProgressRequestSchema.parse(input),
    student = y.setup.students.find((s) => s.id === a.personId),
    resource = y.extensions.find(
      (x) =>
        x.kind === "resources" &&
        x.id === r.resourceId &&
        x.status === "published",
    );
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    a.role !== "student" ||
    !student ||
    !resource ||
    resource.values.classSectionId !== student.classSectionId ||
    y.records.studentProfiles.some(
      (p) => p.studentId === student.id && p.status !== "active",
    )
  )
    throw new Error(
      "An active student can report progress only for an assigned published resource.",
    );
  const old = y.workflows.learningProgress.find(
    (p) => p.studentId === student.id && p.resourceId === resource.id,
  );
  if (old?.state === "completed" && r.state !== "completed")
    throw new Error("Completed progress cannot be silently reset.");
  const saved = learningProgressSchema.parse({
    id: old?.id ?? crypto.randomUUID(),
    studentId: student.id,
    resourceId: resource.id,
    state: r.state,
    updatedAt: new Date().toISOString(),
    actorId: a.id,
  });
  return {
    ...y,
    workflows: {
      ...y.workflows,
      learningProgress: [
        ...y.workflows.learningProgress.filter((p) => p.id !== saved.id),
        saved,
      ],
    },
  };
}
