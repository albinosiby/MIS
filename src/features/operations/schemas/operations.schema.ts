import { operationBaseSchema } from "./operation-base.schema.ts";
import { operationRequests } from "./request-registry.ts";
import { moduleDefinitions } from "../data/module-definitions.ts";
export const operationRecordSchema = operationBaseSchema.superRefine(
  (row, ctx) => {
    const def = moduleDefinitions.find((x) => x.kind === row.kind);
    if (!def) {
      ctx.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Unknown operational collection.",
      });
      return;
    }
    if (![...def.states, "cancelled"].includes(row.status))
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Invalid workflow state.",
      });
    if (def.student && !row.studentId)
      ctx.addIssue({
        code: "custom",
        path: ["studentId"],
        message: "Choose a student.",
      });
    if (def.staff && !row.staffId)
      ctx.addIssue({
        code: "custom",
        path: ["staffId"],
        message: "Choose a staff member.",
      });
    const parsed = operationRequests[row.kind].safeParse(row);
    if (!parsed.success)
      for (const i of parsed.error.issues)
        ctx.addIssue({
          code: "custom",
          path: [...i.path],
          message: i.message,
        });
    if (
      row.values.startDate &&
      row.values.endDate &&
      row.values.startDate > row.values.endDate
    )
      ctx.addIssue({
        code: "custom",
        path: ["values", "endDate"],
        message: "End date cannot precede start date.",
      });
    if (
      row.kind === "grading-scales" &&
      Number(row.values.minimum) > Number(row.values.maximum)
    )
      ctx.addIssue({
        code: "custom",
        path: ["values", "maximum"],
        message: "Grade boundaries are reversed.",
      });
    if (
      row.kind === "payroll" &&
      Number(row.values.deductionMinor) > Number(row.values.grossMinor)
    )
      ctx.addIssue({
        code: "custom",
        path: ["values", "deductionMinor"],
        message: "Deductions exceed gross pay.",
      });
    if (
      row.kind === "journals" &&
      row.values.debitAccount === row.values.creditAccount
    )
      ctx.addIssue({
        code: "custom",
        path: ["values", "creditAccount"],
        message: "Choose distinct debit and credit accounts.",
      });
  },
);
export const operationRequestSchema = operationRecordSchema;
