import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
const money = z.number().int().min(-1000000000).max(1000000000);
export const bankLineSchema = z.strictObject({
  id: identifierSchema,
  date: localDateSchema,
  reference: z.string().trim().min(1).max(120),
  amountMinor: money.refine(
    (n) => n !== 0,
    "Statement amounts cannot be zero.",
  ),
});
export const bankImportSchema = z
  .strictObject({
    account: z.string().trim().min(2).max(80),
    from: localDateSchema,
    to: localDateSchema,
    openingMinor: money,
    closingMinor: money,
    lines: z
      .array(bankLineSchema.omit({ id: true }))
      .min(1)
      .max(300),
  })
  .superRefine((s, c) => {
    if (s.from > s.to || s.lines.some((l) => l.date < s.from || l.date > s.to))
      c.addIssue({
        code: "custom",
        message: "Every line must be within the statement dates.",
      });
    if (
      s.openingMinor + s.lines.reduce((sum, l) => sum + l.amountMinor, 0) !==
      s.closingMinor
    )
      c.addIssue({
        code: "custom",
        message:
          "Opening balance plus statement movements must equal closing balance.",
      });
    if (
      new Set(s.lines.map((l) => l.reference.toLowerCase())).size !==
      s.lines.length
    )
      c.addIssue({
        code: "custom",
        message: "Statement references must be unique.",
      });
  });
export const bankMatchSchema = z.strictObject({
  statementId: identifierSchema,
  lineId: identifierSchema,
  journalId: identifierSchema,
});
export const bankUnmatchSchema = z.strictObject({
  statementId: identifierSchema,
  lineId: identifierSchema,
  reason: z.string().trim().min(8).max(300),
});
export const bankVoidSchema = z.strictObject({
  statementId: identifierSchema,
  reason: z.string().trim().min(8).max(300),
});
export const bankCloseSchema = z.strictObject({
  statementId: identifierSchema,
});
export const bankStatementSchema = z.strictObject({
  id: identifierSchema,
  account: z.string().trim().min(2).max(80),
  from: localDateSchema,
  to: localDateSchema,
  openingMinor: money,
  closingMinor: money,
  lines: z.array(bankLineSchema).min(1).max(300),
  importedBy: identifierSchema,
  importedAt: z.iso.datetime(),
  matches: z
    .array(
      z.strictObject({
        lineId: identifierSchema,
        journalId: identifierSchema,
        matchedBy: identifierSchema,
        matchedAt: z.iso.datetime(),
        voidedAt: z.iso.datetime().nullable().default(null),
        voidedBy: identifierSchema.nullable().default(null),
        voidReason: z.string().max(300).default(""),
      }),
    )
    .max(1500),
  voidedAt: z.iso.datetime().nullable().default(null),
  voidedBy: identifierSchema.nullable().default(null),
  voidReason: z.string().max(300).default(""),
  closedBy: identifierSchema.nullable(),
  closedAt: z.iso.datetime().nullable(),
});
export const serviceChargeSchema = z
  .strictObject({
    allocationId: identifierSchema,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amountMinor: z.number().int().min(1).max(100000000),
    issuedOn: localDateSchema,
    dueDate: localDateSchema,
  })
  .refine(
    (r) => r.dueDate >= r.issuedOn,
    "Due date cannot precede issue date.",
  );

export const bankFineSchema = z.strictObject({ id: identifierSchema });
