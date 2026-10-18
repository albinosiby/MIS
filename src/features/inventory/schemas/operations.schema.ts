import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const vendorsValuesSchema = z.strictObject({
  contact: z.string().trim().min(1).max(254),
  email: z.email().max(254),
  address: z.string().trim().min(1).max(4000),
});
export const vendorsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("vendors"),
  status: z.enum(["active", "inactive", "cancelled"]),
  values: vendorsValuesSchema,
});
export const itemsValuesSchema = z.strictObject({
  sku: z.string().trim().min(1).max(254),
  unit: z.enum(["Each", "Box", "Pack", "Litre", "Kg"]),
  reorderLevel: z.number().int().min(0).max(100000000),
});
export const itemsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("items"),
  status: z.enum(["active", "archived", "cancelled"]),
  values: itemsValuesSchema,
});
export const purchaseOrdersValuesSchema = z.strictObject({
  vendorId: identifierSchema,
  itemId: identifierSchema,
  quantity: z.number().int().min(1).max(100000000),
  amountMinor: z.number().int().min(1).max(100000000),
});
export const purchaseOrdersRequestSchema = operationBaseSchema.extend({
  kind: z.literal("purchase-orders"),
  status: z.enum(["draft", "submitted", "approved", "received", "cancelled"]),
  values: purchaseOrdersValuesSchema,
});
export const stockMovementsValuesSchema = z.strictObject({
  itemId: identifierSchema,
  direction: z.enum(["Receipt", "Issue", "Return"]),
  quantity: z.number().int().min(1).max(100000000),
  department: z.string().trim().min(1).max(254),
});
export const stockMovementsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("stock-movements"),
  status: z.enum(["draft", "posted", "cancelled"]),
  values: stockMovementsValuesSchema,
});
export const assetsValuesSchema = z.strictObject({
  assetTag: z.string().trim().min(1).max(254),
  department: z.string().trim().min(1).max(254),
  costMinor: z.number().int().min(0).max(100000000),
});
export const assetsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("assets"),
  status: z.enum(["active", "maintenance", "retired", "cancelled"]),
  values: assetsValuesSchema,
});

export const purchaseReceiptsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("purchase-receipts"),
  status: z.enum(["draft", "posted", "cancelled"]),
  values: z.strictObject({
    purchaseOrderId: identifierSchema,
    quantity: z.number().int().min(1).max(100000000),
    deliveryReference: z.string().trim().min(2).max(120),
  }),
});
