import { exceptionReviewSchema } from "../schemas/setup-wizard.schema.ts";
import type { ExceptionRecord } from "../models/index.ts";

// Structural validation plus contextual checks; server permission checks are still required.
export function reviewException(
  records: ExceptionRecord[],
  input: unknown,
  context: { schoolId: string; academicYearId: string },
) {
  const parsed = exceptionReviewSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, issues: parsed.error.issues };
  const review = parsed.data;
  const record = records.find(
    (item) =>
      item.id === review.exceptionId &&
      item.schoolId === context.schoolId &&
      item.academicYearId === context.academicYearId,
  );
  if (
    review.schoolId !== context.schoolId ||
    review.academicYearId !== context.academicYearId ||
    !record
  ) {
    return {
      success: false as const,
      issues: [
        {
          path: ["exceptionId"],
          message:
            "This exception is no longer available in the selected school and year",
        },
      ],
    };
  }
  return {
    success: true as const,
    review,
    records: records.filter((item) => item !== record),
  };
}
