import { substitutionSchema } from "./timetable.schema.ts";
/** Assignment input carries explicit ownership; identity and permissions remain server concerns. */
export const substitutionAssignmentSchema = substitutionSchema
  .omit({ id: true, absentStaffId: true, status: true })
  .strict();
