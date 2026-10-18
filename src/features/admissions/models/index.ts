import type { z } from "zod";
import type {
  admissionStageSchema,
  inquirySchema,
  admissionFormSchema,
  reenrolmentSchema,
} from "../schemas/admissions.schema.ts";
export type AdmissionStage = z.infer<typeof admissionStageSchema>;
export type Inquiry = z.infer<typeof inquirySchema>;
export type AdmissionForm = z.infer<typeof admissionFormSchema>;
export type Reenrolment = z.infer<typeof reenrolmentSchema>;
export type AdmissionDecision = z.infer<typeof import("../schemas/completion.schema.ts").admissionDecisionSchema>;
export type AdmissionHandoff = z.infer<typeof import("../schemas/completion.schema.ts").admissionHandoffSchema>;
export type ContinuationRequest = z.infer<typeof import("../schemas/completion.schema.ts").continuationRequestSchema>;
export type WithdrawalRequest = z.infer<typeof import("../schemas/completion.schema.ts").withdrawalRequestSchema>;

export type AdmissionTransition = z.infer<
  typeof import("../schemas/admission-command.schema.ts").admissionTransitionSchema
>;
