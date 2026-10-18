import type { z } from "zod";
import type {
  studentProfileSchema,
  busRouteSchema,
  certificateSchema,
  promotionSchema,
  enrolStudentRequestSchema,
} from "../schemas/students.schema.ts";
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type BusRoute = z.infer<typeof busRouteSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
export type EnrolStudentRequest = z.infer<typeof enrolStudentRequestSchema>;

export type GuardianLinkRequest = import("zod").z.infer<
  typeof import("../schemas/students.schema.ts").guardianLinkRequestSchema
>;

import type {studentEventSchema} from "../schemas/lifecycle.schema.ts";
export type StudentEvent=z.infer<typeof studentEventSchema>;
