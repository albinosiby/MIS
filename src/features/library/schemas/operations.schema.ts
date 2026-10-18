import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const booksValuesSchema = z.strictObject({
  isbn: z.string().trim().min(1).max(254),
  author: z.string().trim().min(1).max(254),
  category: z.string().trim().min(1).max(254),
});
export const booksRequestSchema = operationBaseSchema.extend({
  kind: z.literal("books"),
  status: z.enum(["active", "archived", "cancelled"]),
  values: booksValuesSchema,
});
export const copiesValuesSchema = z.strictObject({
  bookId: identifierSchema,
  barcode: z.string().trim().min(1).max(254),
  shelf: z.string().trim().min(1).max(254),
});
export const copiesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("copies"),
  status: z.enum(["available", "lost", "retired", "cancelled"]),
  values: copiesValuesSchema,
});
export const loansValuesSchema = z.strictObject({
  copyId: identifierSchema,
  dueDate: localDateSchema,
});
export const loansRequestSchema = operationBaseSchema.extend({
  kind: z.literal("loans"),
  status: z.enum(["issued", "returned", "cancelled"]),
  values: loansValuesSchema,
  studentId: identifierSchema,
});
export const reservationsValuesSchema = z.strictObject({
  bookId: identifierSchema,
});
export const reservationsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("reservations"),
  status: z.enum(["requested", "ready", "collected", "cancelled"]),
  values: reservationsValuesSchema,
  studentId: identifierSchema,
});
export const libraryFinesValuesSchema = z.strictObject({
  loanId: identifierSchema,
  amountMinor: z.number().int().min(1).max(100000000),
  reason: z.string().trim().min(1).max(4000),
});
export const libraryFinesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("library-fines"),
  status: z.enum(["outstanding", "settled", "cancelled"]),
  values: libraryFinesValuesSchema,
  studentId: identifierSchema,
});
