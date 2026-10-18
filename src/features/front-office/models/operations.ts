import type { z } from "zod";
import type { visitorsRequestSchema } from "../schemas/operations.schema.ts";
export type VisitorsRequest = z.infer<typeof visitorsRequestSchema>;
import type { gatePassesRequestSchema } from "../schemas/operations.schema.ts";
export type GatePassesRequest = z.infer<typeof gatePassesRequestSchema>;
import type { appointmentsRequestSchema } from "../schemas/operations.schema.ts";
export type AppointmentsRequest = z.infer<typeof appointmentsRequestSchema>;
