import type { z } from "zod";
import type {
  bankStatementSchema,
  bankImportSchema,
  bankMatchSchema,
  serviceChargeSchema,
} from "../schemas/bank-reconciliation.schema.ts";
export type BankStatement = z.infer<typeof bankStatementSchema>;
export type BankImport = z.infer<typeof bankImportSchema>;
export type BankMatch = z.infer<typeof bankMatchSchema>;
export type ServiceCharge = z.infer<typeof serviceChargeSchema>;
