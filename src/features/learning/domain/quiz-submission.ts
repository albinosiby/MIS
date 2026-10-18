import type { SchoolYearWorkspace } from "../../workspace/models/index.ts";
import type { AccountIdentity } from "../../identity/models/index.ts";
import type { OperationRecord } from "../../operations/models/index.ts";
import { exactQuizScore } from "./quiz-scoring.ts";
/** Students author responses; school reviewers can grade them through a separate command. */
export function prepareQuizSubmission(
  y: SchoolYearWorkspace,
  a: AccountIdentity,
  row: OperationRecord,
  previous: OperationRecord | undefined,
): OperationRecord {
  if (row.kind !== "quiz-attempts") return row;
  if (row.status === "graded")
    throw new Error("Use the reviewed quiz grading action.");
  if (
    previous &&
    (previous.studentId !== row.studentId ||
      previous.values.quizId !== row.values.quizId ||
      previous.status === "graded")
  )
    throw new Error(
      "Submitted quiz ownership and reviewed attempts cannot be rewritten.",
    );
  if (row.status === "cancelled") {
    if (
      a.role === "student" ||
      row.values.response !== previous?.values.response
    )
      throw new Error(
        "School reviewers must cancel an unchanged ungraded attempt.",
      );
    return row;
  }
  if (
    a.role !== "student" ||
    a.personId !== row.studentId ||
    (previous && previous.createdBy !== a.id)
  )
    throw new Error("Only the linked student can submit a quiz response.");
  const quiz = y.extensions.find(
      (q) =>
        q.kind === "quizzes" &&
        q.id === row.values.quizId &&
        q.status === "published",
    ),
    student = y.setup.students.find((s) => s.id === row.studentId);
  if (
    !quiz ||
    !student ||
    student.classSectionId !== quiz.values.classSectionId ||
    Number(row.values.score) !== 0 ||
    y.records.studentProfiles.some(
      (p) => p.studentId === student.id && p.status !== "active",
    )
  )
    throw new Error("Choose an assigned open quiz and an active enrolment.");
  if (
    !previous &&
    y.extensions.filter(
      (r) =>
        r.kind === "quiz-attempts" &&
        r.studentId === student.id &&
        r.values.quizId === quiz.id &&
        r.status !== "cancelled",
    ).length >= Number(quiz.values.maxAttempts ?? 1)
  )
    throw new Error("This quiz's attempt allowance has been reached.");
  if (quiz.values.gradingMode !== "Exact answer") return row;
  const score = exactQuizScore(
    String(quiz.values.answer),
    String(row.values.response),
    Number(quiz.values.maxScore),
  );
  return {
    ...row,
    status: "graded",
    values: {
      ...row.values,
      score,
      feedback: "Scored using the published exact-answer rule.",
    },
    history: [
      ...row.history,
      {
        at: new Date().toISOString(),
        actorId: a.id,
        action: `Exact-answer scoring: ${score}/${quiz.values.maxScore}`,
      },
    ],
  };
}
