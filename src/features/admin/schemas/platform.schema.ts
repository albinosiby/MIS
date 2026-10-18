import { z } from "zod";
import { schoolProfileSchema } from "../../../shared/schemas/school.ts";
import { academicYearSchema } from "../../../shared/schemas/academics.ts";
import {
  identifierSchema,
  emailSchema,
  displayNameSchema,
} from "../../../shared/schemas/primitives.ts";
import { roleSchema } from "../../identity/schemas/identity.schema.ts";
export const temporaryPasswordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a symbol");
export const institutionStatusSchema = z.enum(["active", "suspended"]);
export const institutionCreateSchema = z.strictObject({
  requestId: z.uuid(),
  institutionType: z.enum(["school", "college"]),
  school: schoolProfileSchema.omit({ id: true }),
  year: z
    .strictObject({
      name: academicYearSchema.shape.name,
      startDate: academicYearSchema.shape.startDate,
      endDate: academicYearSchema.shape.endDate,
    })
    .refine(
      (v) =>
        academicYearSchema.safeParse({
          ...v,
          id: "new-year",
          schoolId: "new-school",
        }).success,
      { message: "Use valid academic year dates (up to 550 days)." },
    ),
  administratorName: displayNameSchema,
  administratorEmail: emailSchema,
  temporaryPassword: temporaryPasswordSchema,
});
export const schoolAccountRoleSchema = roleSchema.exclude([
  "platform",
  "group",
]);
export const accountCreateSchema = z
  .strictObject({
    requestId: z.uuid(),
    schoolId: identifierSchema,
    email: emailSchema,
    name: displayNameSchema,
    role: schoolAccountRoleSchema,
    personId: identifierSchema.nullable(),
    temporaryPassword: temporaryPasswordSchema,
  })
  .superRefine((v, ctx) => {
    if (["parent", "student"].includes(v.role) && !v.personId)
      ctx.addIssue({
        code: "custom",
        path: ["personId"],
        message: "Link an existing student or guardian for this portal role.",
      });
  });
export const institutionRowSchema = z.object({
  school_id: identifierSchema,
  institution_type: z.enum(["school", "college"]),
  status: institutionStatusSchema,
  contact_email: emailSchema,
  name: displayNameSchema,
  created_at: z.iso.datetime({ offset: true }),
});
export const platformUserSchema = z.object({
  user_id: z.uuid(),
  school_id: identifierSchema,
  display_name: displayNameSchema,
  email: emailSchema,
  role: schoolAccountRoleSchema,
  active: z.boolean(),
  person_id: identifierSchema.nullable(),
  must_change_password: z.boolean(),
});
export const ticketStatusSchema = z.enum([
  "open",
  "in-progress",
  "resolved",
  "closed",
]);
export const supportCreateSchema = z.strictObject({
  requestId: z.uuid(),
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  replyEmail: emailSchema,
  category: z.enum(["technical", "account", "data", "other"]),
});
export const ticketSchema = z.object({
  id: z.uuid(),
  school_id: identifierSchema,
  requester_id: z.uuid(),
  requester_name: displayNameSchema,
  reply_email: emailSchema,
  subject: z.string().max(160),
  description: z.string().max(4000),
  category: z.string(),
  status: ticketStatusSchema,
  version: z.number().int().nonnegative(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const ticketEventSchema = z.object({
  id: z.uuid(),
  ticket_id: z.uuid(),
  actor_id: z.uuid(),
  kind: z.enum(["created", "status", "internal-note", "manual-contact"]),
  note: z.string().max(2000),
  created_at: z.iso.datetime({ offset: true }),
});
export const auditEventSchema = z.object({
  id: z.number(),
  actor_id: z.uuid(),
  school_id: identifierSchema.nullable(),
  action: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});
export const platformCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("institution-create"),
    input: institutionCreateSchema,
  }),
  z.strictObject({
    type: z.literal("institution-status"),
    schoolId: identifierSchema,
    status: institutionStatusSchema,
  }),
  z.strictObject({
    type: z.literal("account-create"),
    input: accountCreateSchema,
  }),
  z.strictObject({
    type: z.literal("account-update"),
    schoolId: identifierSchema,
    userId: z.uuid(),
    role: schoolAccountRoleSchema,
    active: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("account-reset"),
    schoolId: identifierSchema,
    userId: z.uuid(),
    temporaryPassword: temporaryPasswordSchema,
  }),
  z.strictObject({
    type: z.literal("ticket-update"),
    ticketId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    status: ticketStatusSchema,
    note: z.string().trim().max(2000),
    kind: z.enum(["status", "internal-note", "manual-contact"]),
  }),
]);
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(100).default(""),
});
export const platformListSchema = z.object({
  institutions: z.array(institutionRowSchema),
  users: z.array(platformUserSchema),
  tickets: z.array(ticketSchema),
  audit: z.array(auditEventSchema),
  page: z.number(),
  hasMore: z.boolean(),
});
export const ticketDetailSchema = z.object({
  ticket: ticketSchema,
  events: z.array(ticketEventSchema),
});
export const supportListSchema = z.object({
  tickets: z.array(ticketSchema),
  page: z.number(),
  hasMore: z.boolean(),
});
export const inspectionSchema = z.object({
  status: institutionStatusSchema,
  institutionType: z.enum(["school", "college"]),
  school: schoolProfileSchema,
  yearId: identifierSchema,
  years: z.array(academicYearSchema),
  completed: z.number(),
  section: z.string(),
  sections: z.array(
    z.object({ key: z.string(), label: z.string(), count: z.number() }),
  ),
  rows: z.array(z.record(z.string(), z.unknown())),
  people: z.array(
    z.object({
      id: identifierSchema,
      name: displayNameSchema,
      kind: z.enum(["staff", "student", "guardian"]),
    }),
  ),
  page: z.number(),
  hasMore: z.boolean(),
});
export const platformFilesSchema = z.object({
  files: z.array(
    z.object({
      id: z.uuid(),
      filename: z.string(),
      category: z.string(),
      status: z.string(),
      academic_year_id: identifierSchema,
      version: z.number(),
    }),
  ),
  page: z.number(),
  hasMore: z.boolean(),
});
/** Provisioning recovery projection contains submitted fields, never password values. */
export const pendingRequestsSchema = z.object({
  requests: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["institution", "account"]),
      school_id: identifierSchema,
      payload: z.record(z.string(), z.unknown()),
      created_at: z.iso.datetime({ offset: true }),
    }),
  ),
  page: z.number(),
  hasMore: z.boolean(),
});
export const institutionCreateResponseSchema = z.object({
  schoolId: identifierSchema,
  userId: z.uuid(),
});
export const activationResponseSchema = z.object({
  href: z.string().regex(/^\/(?!\/)/),
});
