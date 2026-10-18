import { z } from "zod";
import { identifierSchema } from "../../../shared/schemas/primitives.ts";
import { roleSchema } from "../../identity/schemas/identity.schema.ts";
export const conversationSchema = z.object({
  id: z.uuid(),
  school_id: identifierSchema,
  academic_year_id: identifierSchema,
  student_id: identifierSchema.nullable(),
  subject: z.string().trim().min(2).max(160),
  created_by: z.uuid(),
  state: z.enum(["open", "closed", "flagged"]),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const conversationParticipantSchema = z.object({
  conversation_id: z.uuid(),
  user_id: z.uuid(),
  last_read_at: z.iso.datetime({ offset: true }).nullable(),
  active: z.boolean(),
});
export const conversationMessageSchema = z.object({
  id: z.uuid(),
  conversation_id: z.uuid(),
  sender_id: z.uuid(),
  client_key: z.uuid(),
  body: z.string().trim().min(1).max(4000),
  attachment_ids: z.array(z.uuid()).max(5),
  status: z.enum(["queued", "sent", "withdrawn", "failed"]),
  created_at: z.iso.datetime({ offset: true }),
  sent_at: z.iso.datetime({ offset: true }).nullable(),
});
export const conversationCreateSchema = z.strictObject({
  yearId: identifierSchema,
  studentId: identifierSchema.nullable(),
  subject: z.string().trim().min(2).max(160),
  participantIds: z.array(z.uuid()).min(1).max(10),
  clientKey: z.uuid(),
});
export const messageSendSchema = z.strictObject({
  conversationId: z.uuid(),
  body: z.string().trim().min(1).max(4000),
  attachmentIds: z.array(z.uuid()).max(5).default([]),
  clientKey: z.uuid(),
});
/** Eligible contact projection; no private email/contact profile is exposed. */
export const conversationContactSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(160),
  role: roleSchema,
  personId: identifierSchema.nullable(),
  schoolId: identifierSchema,
});
export const quietHoursSchema = z
  .strictObject({
    enabled: z.boolean().default(false),
    start: z.number().int().min(0).max(23).default(22),
    end: z.number().int().min(0).max(23).default(7),
    timezone: z.string().max(80).default("Asia/Kolkata"),
  })
  .refine((v) => !v.enabled || v.start !== v.end, {
    message: "Quiet hours must have different start and end hours.",
  });
export const conversationResponseSchema = z.object({
  conversations: conversationSchema.array(),
  selected: conversationSchema.nullable(),
  messages: conversationMessageSchema.array(),
  contacts: conversationContactSchema.array(),
  participants: conversationParticipantSchema.array(),
  quietHours: quietHoursSchema,
});
export const inboxNotificationSchema = z.object({
  id: z.uuid(),
  school_id: identifierSchema,
  user_id: z.uuid(),
  title: z.string().max(160),
  body: z.string().max(2000),
  href: z.string().startsWith("/").max(300),
  source_key: z.string().max(250),
  created_at: z.iso.datetime({ offset: true }),
  read_at: z.iso.datetime({ offset: true }).nullable(),
});
