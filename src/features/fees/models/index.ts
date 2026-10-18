import type { z } from "zod";
import type {
  invoiceLineSchema,
  invoiceSchema,
  paymentSchema,
  generateInvoicesRequestSchema,
} from "../schemas/fees.schema.ts";
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type GenerateInvoicesRequest = z.infer<
  typeof generateInvoicesRequestSchema
>;
import type { z as LedgerZ } from "zod";
import type { ledgerEntrySchema,feePlanSchema } from "../schemas/ledger.schema.ts";
export type LedgerEntry=LedgerZ.infer<typeof ledgerEntrySchema>;
export type FeePlan=LedgerZ.infer<typeof feePlanSchema>;

export type * from "./bank-reconciliation.ts";
