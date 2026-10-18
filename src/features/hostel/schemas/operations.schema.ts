import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const bedsValuesSchema = z.strictObject({
  building: z.string().trim().min(1).max(254),
  room: z.string().trim().min(1).max(254),
  bed: z.string().trim().min(1).max(254),
});
export const bedsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("beds"),
  status: z.enum(["available", "maintenance", "cancelled"]),
  values: bedsValuesSchema,
});
export const hostelAllocationsValuesSchema = z.strictObject({
  bedId: identifierSchema,
  startDate: localDateSchema,
  endDate: localDateSchema,
});
export const hostelAllocationsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("hostel-allocations"),
  status: z.enum(["draft", "active", "ended", "cancelled"]),
  values: hostelAllocationsValuesSchema,
  studentId: identifierSchema,
});
export const rollCallValuesSchema = z.strictObject({
  status: z.enum(["Present", "Absent", "On approved outpass"]),
  note: z.string().trim().min(1).max(4000),
});
export const rollCallRequestSchema = operationBaseSchema.extend({
  kind: z.literal("roll-call"),
  status: z.enum(["recorded", "cancelled"]),
  values: rollCallValuesSchema,
  studentId: identifierSchema,
});
export const outpassesValuesSchema = z.strictObject({
  startDate: localDateSchema,
  endDate: localDateSchema,
  destination: z.string().trim().min(1).max(4000),
  guardianApproval: z.enum(["Pending", "Granted", "Declined"]),
});
export const outpassesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("outpasses"),
  status: z.enum(["requested", "approved", "out", "returned", "cancelled"]),
  values: outpassesValuesSchema,
  studentId: identifierSchema,
});
export const hostelVisitorsValuesSchema = z.strictObject({
  visitor: z.string().trim().min(1).max(254),
  relationship: z.string().trim().min(1).max(254),
  purpose: z.string().trim().min(1).max(4000),
});
export const hostelVisitorsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("hostel-visitors"),
  status: z.enum(["checked-in", "checked-out", "cancelled"]),
  values: hostelVisitorsValuesSchema,
  studentId: identifierSchema,
});
export const messValuesSchema = z.strictObject({
  meal: z.enum(["Breakfast", "Lunch", "Dinner"]),
  menu: z.string().trim().min(1).max(4000),
  servings: z.number().int().min(1).max(5000),
});
export const messRequestSchema = operationBaseSchema.extend({
  kind: z.literal("mess"),
  status: z.enum(["planned", "served", "cancelled"]),
  values: messValuesSchema,
});
