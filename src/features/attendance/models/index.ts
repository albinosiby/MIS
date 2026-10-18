import type { z } from "zod";
import type {
  attendanceRecordSchema,
  leaveRequestSchema,
  attendanceBatchRequestSchema,
} from "../schemas/attendance.schema.ts";
export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type AttendanceBatchRequest = z.infer<
  typeof attendanceBatchRequestSchema
>;
