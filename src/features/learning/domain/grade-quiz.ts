import { quizGradeRequestSchema } from "../schemas/progress.schema.ts";
import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
export function gradeQuizAttempt(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  input: unknown,
): SchoolYearWorkspace {
  const request = quizGradeRequestSchema.parse(input);
  if (
    y.locked ||
    a.schoolId !== y.setup.school.id ||
    !["admin", "principal", "teacher"].includes(a.role)
  )
    throw new Error("Quiz grading permission required.");
  const attempt = y.extensions.find(
      (r) => r.id === request.id && r.kind === "quiz-attempts",
    ),
    quiz = y.extensions.find(
      (r) => r.id === attempt?.values.quizId && r.kind === "quizzes",
    );
  if (
    !attempt ||
    !quiz ||
    !["submitted", "graded"].includes(attempt.status) ||
    !["published", "closed"].includes(quiz.status) ||
    request.score > Number(quiz.values.maxScore)
  )
    throw new Error(
      "Choose a submitted attempt and a score within the quiz maximum.",
    );
  if (
    a.role === "teacher" &&
    !y.setup.allocations.some(
      (x) =>
        x.staffId === a.personId &&
        x.classSectionId === quiz.values.classSectionId &&
        y.setup.students.some(
          (s) =>
            s.id === attempt.studentId && s.classSectionId === x.classSectionId,
        ),
    )
  )
    throw new Error("Quiz is outside your assigned classes.");
  const saved = {
    ...attempt,
    status: "graded",
    values: {
      ...attempt.values,
      score: request.score,
      feedback: request.feedback,
    },
    history: [
      ...attempt.history,
      {
        at: new Date().toISOString(),
        actorId: a.id,
        action: `Quiz score reviewed: ${attempt.values.score} → ${request.score}`,
      },
    ],
  };
  return {
    ...y,
    extensions: y.extensions.map((r) => (r.id === saved.id ? saved : r)),
  };
}
