import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const messageTemplatesValuesSchema = z.strictObject({
  channel: z.enum(["In-app", "Email", "SMS", "WhatsApp"]),
  body: z.string().trim().min(1).max(4000),
});
export const messageTemplatesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("message-templates"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: messageTemplatesValuesSchema,
});
export const messagesValuesSchema = z.strictObject({
  body: z.string().trim().min(1).max(4000),
  recipientRole: z.enum(["teacher", "parent", "student", "staff"]),
});
export const messagesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("messages"),
  status: z.enum(["sent", "read", "cancelled"]),
  values: messagesValuesSchema,
  studentId: identifierSchema,
  staffId: identifierSchema,
});
export const deliveriesValuesSchema = z.strictObject({
  channel: z.enum(["Email", "SMS", "WhatsApp", "Push"]),
  recipient: z.string().trim().min(1).max(254),
  body: z.string().trim().min(1).max(4000),
});
export const deliveriesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("deliveries"),
  status: z.enum(["queued", "simulated-delivery", "failed", "cancelled"]),
  values: deliveriesValuesSchema,
});
export const ptmValuesSchema = z.strictObject({
  meetingDate: localDateSchema,
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM in 24-hour time."),
  minutes: z.number().int().min(5).max(60),
});
export const ptmRequestSchema = operationBaseSchema.extend({
  kind: z.literal("ptm"),
  status: z.enum(["available", "booked", "completed", "cancelled"]),
  values: ptmValuesSchema,
  studentId: identifierSchema,
  staffId: identifierSchema,
});
export const surveysValuesSchema = z.strictObject({
  question: z.string().trim().min(1).max(4000),
  response: z.string().trim().min(1).max(4000),
});
export const surveysRequestSchema = operationBaseSchema.extend({
  kind: z.literal("surveys"),
  status: z.enum(["draft", "open", "closed", "cancelled"]),
  values: surveysValuesSchema,
  studentId: identifierSchema,
});
export const consentsValuesSchema = z.strictObject({
  purpose: z.string().trim().min(1).max(4000),
  response: z.enum(["Pending", "Granted", "Declined"]),
});
export const consentsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("consents"),
  status: z.enum(["requested", "responded", "cancelled"]),
  values: consentsValuesSchema,
  studentId: identifierSchema,
});
