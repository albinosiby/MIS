import type { z } from "zod";
import type {
  portalLeaveSchema,
  portalSubmissionSchema,
  portalAttendanceSchema,
} from "../schemas/portal.schema.ts";
export type PortalLeave = z.infer<typeof portalLeaveSchema>;
export type PortalSubmission = z.infer<typeof portalSubmissionSchema>;
export type PortalAttendance = z.infer<typeof portalAttendanceSchema>;
