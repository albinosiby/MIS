import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const paymentAttemptsValuesSchema = z.strictObject({
  invoiceId: identifierSchema,
  amountMinor: z.number().int().min(1).max(100000000),
  method: z.enum(["UPI", "Card", "Net banking"]),
});
export const paymentAttemptsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("payment-attempts"),
  status: z.enum(["pending", "simulated-success", "failed", "cancelled"]),
  values: paymentAttemptsValuesSchema,
  studentId: identifierSchema,
});
export const refundsValuesSchema = z.strictObject({
  paymentId: identifierSchema,
  amountMinor: z.number().int().min(1).max(100000000),
  reason: z.string().trim().min(1).max(4000),
});
export const refundsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("refunds"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: refundsValuesSchema,
  studentId: identifierSchema,
});
export const reconciliationValuesSchema = z.strictObject({
  paymentId: identifierSchema,
  bankReference: z.string().trim().min(1).max(254),
  amountMinor: z.number().int().min(1).max(100000000),
});
export const reconciliationRequestSchema = operationBaseSchema.extend({
  kind: z.literal("reconciliation"),
  status: z.enum(["unmatched", "matched", "reconciled", "cancelled"]),
  values: reconciliationValuesSchema,
});
export const journalsValuesSchema = z.strictObject({
  debitAccount: z.string().trim().min(1).max(254),
  creditAccount: z.string().trim().min(1).max(254),
  amountMinor: z.number().int().min(1).max(100000000),
  memo: z.string().trim().min(1).max(4000),
});
export const journalsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("journals"),
  status: z.enum(["draft", "posted", "cancelled"]),
  values: journalsValuesSchema,
});
export const paymentPlansValuesSchema = z.strictObject({
  amountMinor: z.number().int().min(1).max(100000000),
  instalments: z.number().int().min(1).max(24),
  dueDate: localDateSchema,
});
export const paymentPlansRequestSchema = operationBaseSchema.extend({
  kind: z.literal("payment-plans"),
  status: z.enum(["draft", "submitted", "approved", "completed", "cancelled"]),
  values: paymentPlansValuesSchema,
  studentId: identifierSchema,
});
export const receiptTemplatesValuesSchema = z.strictObject({
  prefix: z.string().trim().min(1).max(254),
  heading: z.string().trim().min(1).max(254),
  footer: z.string().trim().min(1).max(4000),
});
export const receiptTemplatesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("receipt-templates"),
  status: z.enum(["draft", "published", "cancelled"]),
  values: receiptTemplatesValuesSchema,
});
export const gatewaysValuesSchema = z.strictObject({
  provider: z.enum(["Razorpay", "Stripe", "PayU", "Other"]),
  merchantReference: z.string().trim().min(1).max(254),
});
export const gatewaysRequestSchema = operationBaseSchema.extend({
  kind: z.literal("gateways"),
  status: z.enum(["unconfigured", "cancelled"]),
  values: gatewaysValuesSchema,
});

export const purchasePaymentsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("purchase-payments"),
  status: z.enum(["draft", "posted", "cancelled"]),
  values: z.strictObject({
    purchaseOrderId: identifierSchema,
    amountMinor: z.number().int().min(1).max(100000000),
    bankReference: z.string().trim().min(2).max(120),
  }),
});
