import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { operationRecordSchema } from "../schemas/operations.schema.ts";
/** Narrow migration projection. Unknown fields are preserved for the full workspace parser. */
const envelope = z.looseObject({
  years: z.array(
    z.looseObject({
      records: z.looseObject({
        invoices: z.array(
          z.looseObject({
            id: identifierSchema,
            studentId: identifierSchema,
            schoolId: identifierSchema,
            academicYearId: identifierSchema,
          }),
        ),
      }),
      extensions: z.array(z.unknown()).optional(),
    }),
  ),
});
/** Repair only this build's untouched generated fixture, never a user-authored payment attempt. */
export function repairFixtureLinks(input: unknown) {
  const parsed = envelope.safeParse(input);
  if (!parsed.success) return { value: input, changed: false };
  const value = parsed.data;
  let changed = false;
  for (const year of value.years) {
    if (!year.extensions) continue;
    year.extensions = year.extensions.map((raw) => {
      const result = operationRecordSchema.safeParse(raw);
      if (!result.success) return raw;
      const row = result.data;
      if (
        row.id !== "op-demo-payment-attempts" ||
        row.kind !== "payment-attempts" ||
        row.status !== "pending" ||
        row.createdBy !== "demo-admin" ||
        row.history.length !== 1 ||
        row.history[0].action !== "Created synthetic sample" ||
        row.values.amountMinor !== 1
      )
        return raw;
      const invoice = year.records.invoices.find(
        (i) =>
          i.id === row.values.invoiceId &&
          i.schoolId === row.schoolId &&
          i.academicYearId === row.academicYearId,
      );
      if (!invoice || invoice.studentId === row.studentId) return raw;
      changed = true;
      return { ...row, studentId: invoice.studentId };
    });
  }
  return { value: changed ? value : input, changed };
}
