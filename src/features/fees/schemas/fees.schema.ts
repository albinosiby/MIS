import { z } from "zod";
import { scopedRecordSchema } from "../../../shared/schemas/workflow.ts";
import {
  identifierSchema,
  displayNameSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const invoiceLineSchema = z.strictObject({
  id: identifierSchema,
  name: displayNameSchema,
  amountMinor: z.number().int().min(0).max(100000000),
});
export const invoiceSchema = scopedRecordSchema
  .extend({
    studentId: identifierSchema,
    reference: identifierSchema,
    period: z.string().trim().min(1).max(80).default("Term fees"),
    issuedOn: localDateSchema,
    dueDate: localDateSchema,
    lines: z.array(invoiceLineSchema).min(1).max(50),
    concessionMinor: z.number().int().nonnegative(),
    status: z.enum(["issued", "void"]),
  })
  .superRefine((v, ctx) => {
    if (v.dueDate < v.issuedOn)
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must follow invoice date",
      });
    if (v.concessionMinor > v.lines.reduce((s, l) => s + l.amountMinor, 0))
      ctx.addIssue({
        code: "custom",
        path: ["concessionMinor"],
        message: "Concession exceeds invoice total",
      });
  });
export const paymentSchema = scopedRecordSchema.extend({
  invoiceId: identifierSchema,
  refundedMinor: z.number().int().min(0).max(100000000).default(0),
  amountMinor: z.number().int().min(1).max(100000000),
  paidOn: localDateSchema,
  method: z.enum(["Cash", "UPI", "Card", "Bank transfer"]),
  reference: identifierSchema,
  idempotencyKey: identifierSchema,
  status: z.enum(["completed", "reversed"]),
  note: z.string().trim().max(300),
}).refine(v=>v.refundedMinor<=v.amountMinor,{path:["refundedMinor"],message:"Refunds cannot exceed the collection."});
export const generateInvoicesRequestSchema = z
  .strictObject({
    schoolId: identifierSchema,
    academicYearId: identifierSchema,
    studentIds: z.array(identifierSchema).min(1).max(2000),
    feeHeadIds: z.array(identifierSchema).min(1).max(50),
    period: z.string().trim().min(1).max(80),
    issuedOn: localDateSchema,
    dueDate: localDateSchema,
    concessionPercent: z.number().min(0).max(100),
  })
  .refine((v) => v.issuedOn <= v.dueDate, {
    path: ["dueDate"],
    message: "Due date must not precede issue date",
  });
