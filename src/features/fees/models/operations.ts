import type { z } from "zod";
import type { paymentAttemptsRequestSchema } from "../schemas/operations.schema.ts";
export type PaymentAttemptsRequest = z.infer<
  typeof paymentAttemptsRequestSchema
>;
import type { refundsRequestSchema } from "../schemas/operations.schema.ts";
export type RefundsRequest = z.infer<typeof refundsRequestSchema>;
import type { reconciliationRequestSchema } from "../schemas/operations.schema.ts";
export type ReconciliationRequest = z.infer<typeof reconciliationRequestSchema>;
import type { journalsRequestSchema } from "../schemas/operations.schema.ts";
export type JournalsRequest = z.infer<typeof journalsRequestSchema>;
import type { paymentPlansRequestSchema } from "../schemas/operations.schema.ts";
export type PaymentPlansRequest = z.infer<typeof paymentPlansRequestSchema>;
import type { receiptTemplatesRequestSchema } from "../schemas/operations.schema.ts";
export type ReceiptTemplatesRequest = z.infer<
  typeof receiptTemplatesRequestSchema
>;
import type { gatewaysRequestSchema } from "../schemas/operations.schema.ts";
export type GatewaysRequest = z.infer<typeof gatewaysRequestSchema>;

import type {purchasePaymentsRequestSchema} from "../schemas/operations.schema.ts";
export type PurchasePaymentRequest=z.infer<typeof purchasePaymentsRequestSchema>;
