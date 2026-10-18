import type { z } from "zod";
import type {
  timetableSlotSchema,
  substitutionSchema,
  roomSchema,
  roomReservationSchema,
} from "../schemas/timetable.schema.ts";
export type TimetableSlot = z.infer<typeof timetableSlotSchema>;
export type Substitution = z.infer<typeof substitutionSchema>;
export type TimetableVersion = z.infer<typeof import("../schemas/publication.schema.ts").timetableVersionSchema>;
export type SubstitutionReview = z.infer<typeof import("../schemas/publication.schema.ts").substitutionReviewSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomReservation = z.infer<typeof roomReservationSchema>;

import type {timetableGenerateSchema} from "../schemas/generator.schema.ts";
export type TimetableGenerateRequest=z.infer<typeof timetableGenerateSchema>;
