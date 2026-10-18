import { z } from "zod";
import { operationBaseSchema } from "../../operations/schemas/operation-base.schema.ts";
import {
  identifierSchema,
  localDateSchema,
} from "../../../shared/schemas/primitives.ts";
export const vehiclesValuesSchema = z.strictObject({
  registration: z.string().trim().min(1).max(254),
  capacity: z.number().int().min(1).max(100),
  insuranceUntil: localDateSchema,
});
export const vehiclesRequestSchema = operationBaseSchema.extend({
  kind: z.literal("vehicles"),
  status: z.enum(["active", "maintenance", "retired", "cancelled"]),
  values: vehiclesValuesSchema,
});
export const stopsValuesSchema = z.strictObject({
  routeId: identifierSchema,
  location: z.string().trim().min(1).max(4000),
  sequence: z.number().int().min(1).max(200),
  pickupTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM in 24-hour time."),
});
export const stopsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("stops"),
  status: z.enum(["active", "inactive", "cancelled"]),
  values: stopsValuesSchema,
});
export const driversValuesSchema = z.strictObject({
  vehicleId: identifierSchema,
  licence: z.string().trim().min(1).max(254),
  validUntil: localDateSchema,
});
export const driversRequestSchema = operationBaseSchema.extend({
  kind: z.literal("drivers"),
  status: z.enum(["active", "inactive", "cancelled"]),
  values: driversValuesSchema,
  staffId: identifierSchema,
});
export const tripsValuesSchema = z.strictObject({
  routeId: identifierSchema,
  vehicleId: identifierSchema,
  direction: z.enum(["Pickup", "Dropoff"]),
});
export const tripsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("trips"),
  status: z.enum(["planned", "started", "completed", "cancelled"]),
  values: tripsValuesSchema,
  staffId: identifierSchema,
});
export const boardingValuesSchema = z.strictObject({
  tripId: identifierSchema,
  stopId: identifierSchema,
});
export const boardingRequestSchema = operationBaseSchema.extend({
  kind: z.literal("boarding"),
  status: z.enum(["waiting", "boarded", "alighted", "cancelled"]),
  values: boardingValuesSchema,
  studentId: identifierSchema,
});
export const vehicleMaintenanceValuesSchema = z.strictObject({
  vehicleId: identifierSchema,
  work: z.string().trim().min(1).max(4000),
  costMinor: z.number().int().min(0).max(100000000),
});
export const vehicleMaintenanceRequestSchema = operationBaseSchema.extend({
  kind: z.literal("vehicle-maintenance"),
  status: z.enum(["scheduled", "in-progress", "completed", "cancelled"]),
  values: vehicleMaintenanceValuesSchema,
});
export const transportAlertsValuesSchema = z.strictObject({
  tripId: identifierSchema,
  severity: z.enum(["Information", "Delay", "Incident", "SOS"]),
  message: z.string().trim().min(1).max(4000),
});
export const transportAlertsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("transport-alerts"),
  status: z.enum(["open", "acknowledged", "resolved", "cancelled"]),
  values: transportAlertsValuesSchema,
});

export const transportAllocationsRequestSchema = operationBaseSchema.extend({
  kind: z.literal("transport-allocations"),
  status: z.enum(["draft", "active", "ended", "cancelled"]),
  values: z.strictObject({
    routeId: identifierSchema,
    stopId: identifierSchema,
    startDate: localDateSchema,
    endDate: localDateSchema,
  }),
  studentId: identifierSchema,
});
