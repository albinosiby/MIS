import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const ledgerAccountSchema = z.enum([
  "Cash",
  "Bank",
  "Fee receivable",
  "Fee income",
  "Concessions",
  "Refunds",
  "Payroll expense",
  "Payroll payable",
  "Deductions payable",
  "Employer contribution expense",
  "Inventory expense",
  "Operating expense",
  "Trade payable",
  "Opening balance",
]);
export const ledgerEntrySchema = z
  .strictObject({
    id: identifierSchema,
    sourceKey: z.string().min(1).max(250),
    date: localDateSchema,
    memo: z.string().trim().min(2).max(300),
    postedBy: identifierSchema,
    postedAt: z.iso.datetime(),
    reversesId: identifierSchema.nullable(),
    lines: z
      .array(
        z.strictObject({
          account: ledgerAccountSchema,
          debitMinor: z.number().int().nonnegative().max(1000000000),
          creditMinor: z.number().int().nonnegative().max(1000000000),
        }),
      )
      .min(2)
      .max(10),
  })
  .superRefine((v, ctx) => {
    const debit = v.lines.reduce((s, l) => s + l.debitMinor, 0),
      credit = v.lines.reduce((s, l) => s + l.creditMinor, 0);
    if (
      !debit ||
      debit !== credit ||
      v.lines.some((l) => l.debitMinor > 0 === l.creditMinor > 0)
    )
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message:
          "Journal must balance and each line has either debit or credit.",
      });
  });
export const feePlanSchema = z.strictObject({
  id: identifierSchema,
  studentId: identifierSchema,
  name: z.string().trim().min(2).max(80),
  instalments: z
    .array(
      z.strictObject({
        dueDate: localDateSchema,
        amountMinor: z.number().int().min(1).max(100000000),
      }),
    )
    .min(1)
    .max(24),
  lateFeeMinorPerDay: z.number().int().min(0).max(100000),
  lateFeeCapMinor: z.number().int().min(0).max(10000000),
});
