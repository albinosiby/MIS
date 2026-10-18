import type { z } from "zod";
import type { vehiclesRequestSchema } from "../schemas/operations.schema.ts";
export type VehiclesRequest = z.infer<typeof vehiclesRequestSchema>;
import type { stopsRequestSchema } from "../schemas/operations.schema.ts";
export type StopsRequest = z.infer<typeof stopsRequestSchema>;
import type { driversRequestSchema } from "../schemas/operations.schema.ts";
export type DriversRequest = z.infer<typeof driversRequestSchema>;
import type { tripsRequestSchema } from "../schemas/operations.schema.ts";
export type TripsRequest = z.infer<typeof tripsRequestSchema>;
import type { boardingRequestSchema } from "../schemas/operations.schema.ts";
export type BoardingRequest = z.infer<typeof boardingRequestSchema>;
import type { vehicleMaintenanceRequestSchema } from "../schemas/operations.schema.ts";
export type VehicleMaintenanceRequest = z.infer<
  typeof vehicleMaintenanceRequestSchema
>;
import type { transportAlertsRequestSchema } from "../schemas/operations.schema.ts";
export type TransportAlertsRequest = z.infer<
  typeof transportAlertsRequestSchema
>;

import type {transportAllocationsRequestSchema} from "../schemas/operations.schema.ts";
export type TransportAllocationRequest=z.infer<typeof transportAllocationsRequestSchema>;
