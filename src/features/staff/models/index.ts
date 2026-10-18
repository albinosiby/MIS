import type { z } from "zod";
import type {
  staffProfileSchema,
  roleSchema,
  staffOnboardRequestSchema,
} from "../schemas/staff.schema.ts";
export type StaffProfile = z.infer<typeof staffProfileSchema>;
export type Role = z.infer<typeof roleSchema>;
export type StaffOnboardRequest = z.infer<typeof staffOnboardRequestSchema>;
