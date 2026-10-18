import type { z } from "zod";
import type { clubsRequestSchema } from "../schemas/operations.schema.ts";
export type ClubsRequest = z.infer<typeof clubsRequestSchema>;
import type { activityEnrolmentsRequestSchema } from "../schemas/operations.schema.ts";
export type ActivityEnrolmentsRequest = z.infer<
  typeof activityEnrolmentsRequestSchema
>;
import type { tripsEventsRequestSchema } from "../schemas/operations.schema.ts";
export type TripsEventsRequest = z.infer<typeof tripsEventsRequestSchema>;
import type { achievementsRequestSchema } from "../schemas/operations.schema.ts";
export type AchievementsRequest = z.infer<typeof achievementsRequestSchema>;
