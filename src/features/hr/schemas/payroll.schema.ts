import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const deductionRuleSchema = z.strictObject({
  id: identifierSchema,
  label: z.string().trim().min(2).max(80),
  basis: z.enum(["fixed", "gross", "basic"]),
  amountMinor: z.number().int().min(0).max(100000000).default(0),
  rateBps: z.number().int().min(0).max(10000).default(0),
  employerOnly: z.boolean().default(false),
});
export const payrollPolicySchema = z
  .strictObject({
    country: z.literal("IN").default("IN"),
    state: z.string().trim().max(80).default(""),
    rules: z.array(deductionRuleSchema).max(20).default([]),
    approvedBySchool: z.boolean().default(false),
    leaveTypes: z
      .array(
        z.strictObject({
          name: z.string().trim().min(2).max(60),
          annualDays: z.number().int().min(0).max(366),
          paid: z.boolean(),
        }),
      )
      .max(20)
      .default([{ name: "Casual leave", annualDays: 12, paid: true }]),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.leaveTypes.map((t) => t.name.toLowerCase())).size !==
      v.leaveTypes.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["leaveTypes"],
        message: "Leave type names must be unique.",
      });
    if (new Set(v.rules.map((r) => r.id)).size !== v.rules.length)
      ctx.addIssue({
        code: "custom",
        path: ["rules"],
        message: "Deduction rule IDs must be unique.",
      });
  });
export const salaryPlanSchema = z
  .strictObject({
    staffId: identifierSchema,
    basicMinor: z.number().int().min(1).max(100000000),
    grossMinor: z.number().int().min(1).max(100000000),
    effectiveFrom: localDateSchema,
  })
  .refine((v) => v.basicMinor <= v.grossMinor, {
    message: "Basic salary cannot exceed gross salary.",
  });
export const payrollRunSchema = z.strictObject({
  id: identifierSchema,
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  status: z.enum(["draft", "reviewed", "finalised"]),
  createdBy: identifierSchema,
  reviewedBy: identifierSchema.nullable(),
  createdAt: z.iso.datetime(),
  finalisedAt: z.iso.datetime().nullable(),
  lines: z
    .array(
      z.strictObject({
        staffId: identifierSchema,
        grossMinor: z.number().int().nonnegative(),
        basicMinor: z.number().int().nonnegative(),
        unpaidDays: z.number().int().min(0).max(31),
        daysInMonth: z.number().int().min(28).max(31),
        deductions: z.array(
          z.strictObject({
            label: z.string(),
            amountMinor: z.number().int().nonnegative(),
            employerOnly: z.boolean(),
          }),
        ),
        netMinor: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(200),
});
export const employmentEventSchema = z.strictObject({
  id: identifierSchema,
  staffId: identifierSchema,
  kind: z.enum(["joined", "exited", "contract-renewed"]),
  date: localDateSchema,
  note: z.string().trim().min(8).max(500),
  actorId: identifierSchema,
});
