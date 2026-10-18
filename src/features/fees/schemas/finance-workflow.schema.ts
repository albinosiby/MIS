import { z } from "zod";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const lateFeeRuleRequestSchema = z
  .strictObject({
    planId: identifierSchema,
    dailyMinor: z.number().int().min(0).max(100000),
    capMinor: z.number().int().min(0).max(10000000),
  })
  .refine((v) => v.dailyMinor === 0 || v.capMinor >= v.dailyMinor, {
    message: "Set a cap at least as large as the daily charge.",
  });
export const assessLateChargeSchema = z.strictObject({
  planId: identifierSchema,
});
export const ledgerStatementSchema = z
  .strictObject({ from: localDateSchema, to: localDateSchema })
  .refine((v) => v.from <= v.to, { message: "Choose an ordered date range." });
