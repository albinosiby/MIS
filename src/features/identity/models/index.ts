import type { z } from "zod";
import type {
  accountIdentitySchema,
  roleSchema,
  localSessionSchema,
} from "../schemas/identity.schema.ts";
export type AccountIdentity = z.infer<typeof accountIdentitySchema>;
export type Role = z.infer<typeof roleSchema>;
export type LocalSession = z.infer<typeof localSessionSchema>;

import type {membershipContextSchema, schoolContextsResponseSchema, roleGrantListResponseSchema} from "../schemas/membership-context.schema.ts";
export type MembershipContext=z.infer<typeof membershipContextSchema>;
export type SchoolContextsResponse=z.infer<typeof schoolContextsResponseSchema>;
export type RoleGrantListResponse=z.infer<typeof roleGrantListResponseSchema>;

import type {mfaSummarySchema, mfaEnrollmentSchema} from "../schemas/mfa.schema.ts";
export type MfaSummary=z.infer<typeof mfaSummarySchema>;
export type MfaEnrollment=z.infer<typeof mfaEnrollmentSchema>;

import type {mutationPolicySchema} from "../schemas/mutation-policy.schema.ts";
export type MutationPolicy=z.infer<typeof mutationPolicySchema>;
