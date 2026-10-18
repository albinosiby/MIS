import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const contractsValuesSchema = z.strictObject({
  designation: z.string().trim().min(1).max(254),
  startDate: localDateSchema,
  endDate: localDateSchema,
  terms: z.string().trim().min(1).max(4000),
});
export const contractsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("contracts"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: contractsValuesSchema,
  staffId: identifierSchema,
});
export const payrollValuesSchema = z.strictObject({
  period: z.string().trim().min(1).max(254),
  grossMinor: z.number().int().min(0).max(100000000),
  deductionMinor: z.number().int().min(0).max(100000000),
});
export const payrollRequestSchema = operationBaseSchema.extend({
  kind: z.literal("payroll"),
  status: z.enum(["draft", "reviewed", "approved", "finalised", "cancelled"]),
  values: payrollValuesSchema,
  staffId: identifierSchema,
});
export const expensesValuesSchema = z.strictObject({
  category: z.enum(["Travel", "Supplies", "Training", "Other"]),
  amountMinor: z.number().int().min(1).max(100000000),
  reason: z.string().trim().min(1).max(4000),
});
export const expensesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("expenses"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: expensesValuesSchema,
  staffId: identifierSchema,
});
export const appraisalsValuesSchema = z.strictObject({
  objectives: z.string().trim().min(1).max(4000),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().min(1).max(4000),
});
export const appraisalsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("appraisals"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: appraisalsValuesSchema,
  staffId: identifierSchema,
});
export const trainingValuesSchema = z.strictObject({
  provider: z.string().trim().min(1).max(254),
  hours: z.number().int().min(1).max(300),
  outcome: z.string().trim().min(1).max(4000),
});
export const trainingRequestSchema = operationBaseSchema.extend({
  kind: z.literal("training"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: trainingValuesSchema,
  staffId: identifierSchema,
});
export const vacanciesValuesSchema = z.strictObject({
  department: z.string().trim().min(1).max(254),
  description: z.string().trim().min(1).max(4000),
  closingDate: localDateSchema,
});
export const vacanciesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("vacancies"),
  status: z.enum(["draft", "open", "closed", "cancelled"]),
  values: vacanciesValuesSchema,
});
export const applicantsValuesSchema = z.strictObject({
  vacancyId: identifierSchema,
  email: z.email().max(254),
  experience: z.string().trim().min(1).max(4000),
});
export const applicantsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("applicants"),
  status: z.enum([
    "applied",
    "shortlisted",
    "interviewed",
    "offered",
    "hired",
    "cancelled",
  ]),
  values: applicantsValuesSchema,
});
