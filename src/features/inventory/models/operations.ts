import type { z } from "zod";
import type { vendorsRequestSchema } from "../schemas/operations.schema.ts";
export type VendorsRequest = z.infer<typeof vendorsRequestSchema>;
import type { itemsRequestSchema } from "../schemas/operations.schema.ts";
export type ItemsRequest = z.infer<typeof itemsRequestSchema>;
import type { purchaseOrdersRequestSchema } from "../schemas/operations.schema.ts";
export type PurchaseOrdersRequest = z.infer<typeof purchaseOrdersRequestSchema>;
import type { stockMovementsRequestSchema } from "../schemas/operations.schema.ts";
export type StockMovementsRequest = z.infer<typeof stockMovementsRequestSchema>;
import type { assetsRequestSchema } from "../schemas/operations.schema.ts";
export type AssetsRequest = z.infer<typeof assetsRequestSchema>;

import type {purchaseReceiptsRequestSchema} from "../schemas/operations.schema.ts";
export type PurchaseReceiptRequest=z.infer<typeof purchaseReceiptsRequestSchema>;
