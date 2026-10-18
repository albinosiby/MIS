import type { z } from "zod";
import type {
  academicEventSchema,
  noticeSchema,
  notificationSchema,
  exportJobSchema,
  reportScheduleSchema,
} from "../schemas/communication.schema.ts";
export type AcademicEvent = z.infer<typeof academicEventSchema>;
export type Notice = z.infer<typeof noticeSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type ExportJob = z.infer<typeof exportJobSchema>;
export type ReportSchedule = z.infer<typeof reportScheduleSchema>;
import type { conversationSchema, conversationParticipantSchema, conversationMessageSchema, conversationContactSchema, quietHoursSchema, conversationResponseSchema, inboxNotificationSchema } from "../schemas/conversation.schema.ts";
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationContact = z.infer<typeof conversationContactSchema>;
export type QuietHours = z.infer<typeof quietHoursSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type InboxNotification = z.infer<typeof inboxNotificationSchema>;
