import type { z } from "zod";
import type { clinicRequestSchema } from "../schemas/operations.schema.ts";
export type ClinicRequest = z.infer<typeof clinicRequestSchema>;
import type { medicationRequestSchema } from "../schemas/operations.schema.ts";
export type MedicationRequest = z.infer<typeof medicationRequestSchema>;
import type { immunisationsRequestSchema } from "../schemas/operations.schema.ts";
export type ImmunisationsRequest = z.infer<typeof immunisationsRequestSchema>;
