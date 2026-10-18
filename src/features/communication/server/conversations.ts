import "server-only";
import { z } from "zod";
import type { AccountIdentity } from "../../identity/models";
import type { Workspace } from "../../workspace/models";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  conversationSchema,
  conversationParticipantSchema,
  conversationMessageSchema,
  conversationCreateSchema,
  messageSendSchema,
  conversationContactSchema,
  quietHoursSchema,
  conversationResponseSchema,
} from "../schemas/conversation.schema";
import {
  canContact,
  canReadConversation,
  nextMessageDelivery,
} from "../domain/conversations";
import { getPrivateDocument } from "../../documents/server/repository";
import {
  documentScope,
  canAccessDocument,
} from "../../documents/domain/document-access";
const contactRowSchema = z.object({
  user_id: z.uuid(),
  school_id: z.string(),
  display_name: z.string(),
  role: conversationContactSchema.shape.role,
  person_id: z.string().nullable(),
  active: z.boolean(),
});
async function schoolContacts(a: AccountIdentity) {
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_effective_memberships")
    .select("user_id,school_id,display_name,role,person_id,active")
    .eq("school_id", a.schoolId)
    .eq("active", true);
  if (error) throw new Error("School contacts unavailable.");
  return contactRowSchema
    .array()
    .parse(data)
    .map((m) =>
      conversationContactSchema.parse({
        id: m.user_id,
        name: m.display_name,
        role: m.role,
        personId: m.person_id,
        schoolId: m.school_id,
      }),
    );
}
export async function getQuietHours(a: AccountIdentity) {
  const { data, error } = await createSupabaseAdminClient()
    .from("mis_communication_settings")
    .select("enabled,quiet_start,quiet_end,timezone")
    .eq("school_id", a.schoolId)
    .maybeSingle();
  if (error) throw new Error("Communication settings unavailable.");
  return quietHoursSchema.parse(
    data
      ? {
          enabled: data.enabled,
          start: data.quiet_start,
          end: data.quiet_end,
          timezone: data.timezone,
        }
      : {},
  );
}
export async function accessibleConversation(
  a: AccountIdentity,
  root: Workspace,
  id: string,
) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("mis_conversations")
    .select("*")
    .eq("school_id", a.schoolId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Conversation unavailable.");
  const conversation = conversationSchema.parse(data);
  const { data: rows, error: failure } = await client
    .from("mis_conversation_participants")
    .select("*")
    .eq("conversation_id", id)
    .eq("active", true);
  if (failure) throw new Error("Conversation unavailable.");
  const participants = conversationParticipantSchema.array().parse(rows);
  const year = root.years.find(
    (y) => y.setup.calendar.year.id === conversation.academic_year_id,
  );
  if (
    !year ||
    !canReadConversation(
      year,
      a,
      conversation,
      participants.map((p) => p.user_id),
    )
  )
    throw new Error("Conversation unavailable.");
  return { conversation, participants, year };
}
export async function loadConversations(
  a: AccountIdentity,
  root: Workspace,
  yearId: string,
  selectedId: string | null,
  studentId: string | null,
) {
  const y = root.years.find((y) => y.setup.calendar.year.id === yearId);
  if (!y) throw new Error("Year unavailable.");
  const client = createSupabaseAdminClient();
  const { data: participation, error } = await client
    .from("mis_conversation_participants")
    .select("conversation_id")
    .eq("user_id", a.id)
    .eq("active", true)
    .limit(200);
  if (error) throw new Error("Inbox unavailable.");
  const ids = z
    .object({ conversation_id: z.uuid() })
    .array()
    .parse(participation)
    .map((p) => p.conversation_id);
  const { data: rows, error: failure } = ids.length
    ? await client
        .from("mis_conversations")
        .select("*")
        .eq("school_id", a.schoolId)
        .eq("academic_year_id", yearId)
        .in("id", ids)
        .order("updated_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  if (failure) throw new Error("Inbox unavailable.");
  const conversations = conversationSchema
    .array()
    .parse(rows)
    .filter((c) =>
      canReadConversation(y, a, c, ids.includes(c.id) ? [a.id] : []),
    );
  const selected = selectedId
    ? (conversations.find((c) => c.id === selectedId) ?? null)
    : (conversations[0] ?? null);
  if (selectedId && !selected) throw new Error("Conversation unavailable.");
  const context = selected
    ? await accessibleConversation(a, root, selected.id)
    : null;
  const { data: messages, error: msgError } = selected
    ? await client
        .from("mis_messages")
        .select("*")
        .eq("conversation_id", selected.id)
        .or(`status.eq.sent,sender_id.eq.${a.id}`)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  if (msgError) throw new Error("Messages unavailable.");
  const contacts = (await schoolContacts(a)).filter((c) =>
    canContact(y, a, c, studentId),
  );
  return conversationResponseSchema.parse({
    conversations,
    selected,
    messages: conversationMessageSchema.array().parse(messages).reverse(),
    contacts,
    participants: context?.participants ?? [],
    quietHours: await getQuietHours(a),
  });
}
export async function createConversation(
  a: AccountIdentity,
  root: Workspace,
  input: unknown,
) {
  const request = conversationCreateSchema.parse(input);
  const year = root.years.find(
    (y) => y.setup.calendar.year.id === request.yearId,
  );
  if (
    !year ||
    year.locked ||
    new Set(request.participantIds).size !== request.participantIds.length
  )
    throw new Error("Year or participants unavailable.");
  const contacts = await schoolContacts(a);
  const selected = request.participantIds.map((id) =>
    contacts.find((c) => c.id === id),
  );
  if (selected.some((c) => !c || !canContact(year, a, c, request.studentId)))
    throw new Error(
      "A selected participant is outside your current relationship permissions.",
    );
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_create_conversation",
    {
      p_actor: a.id,
      p_school: a.schoolId,
      p_year: request.yearId,
      p_student: request.studentId,
      p_subject: request.subject,
      p_participants: request.participantIds,
      p_key: request.clientKey,
    },
  );
  if (error)
    throw new Error("Conversation could not be created. Refresh and retry.");
  return conversationSchema.parse(data);
}
export async function sendConversationMessage(
  a: AccountIdentity,
  root: Workspace,
  input: unknown,
) {
  const request = messageSendSchema.parse(input);
  const { conversation, participants, year } = await accessibleConversation(
    a,
    root,
    request.conversationId,
  );
  if (year.locked || conversation.state !== "open")
    throw new Error("Conversation is read only.");
  const contacts = await schoolContacts(a);
  if (
    participants.some((p) => {
      const contact = contacts.find((c) => c.id === p.user_id);
      return (
        !contact ||
        !canReadConversation(year, { ...a, ...contact }, conversation, [
          contact.id,
        ])
      );
    })
  )
    throw new Error(
      "Participant permissions changed. Start a new permitted conversation.",
    );
  for (const id of request.attachmentIds) {
    const d = await getPrivateDocument(a, root, id);
    if (
      d.status !== "ready" ||
      d.academic_year_id !== year.setup.calendar.year.id ||
      (d.owner_type === "student" && d.owner_id !== conversation.student_id)
    )
      throw new Error("Attachment belongs to another record or year.");
    for (const p of participants) {
      const contact = contacts.find((c) => c.id === p.user_id);
      if (
        !contact ||
        !canReadConversation(year, { ...a, ...contact }, conversation, [
          contact.id,
        ]) ||
        !canAccessDocument(
          year,
          { ...a, ...contact },
          documentScope(d),
          false,
          root.years.find(
            (y) => y.setup.calendar.year.id === root.activeYearId,
          )!,
        )
      )
        throw new Error(
          "All participants must have current permission to this attachment.",
        );
    }
  }
  const runAt = nextMessageDelivery(new Date(), await getQuietHours(a));
  const { data, error } = await createSupabaseAdminClient().rpc(
    "mis_send_message",
    {
      p_actor: a.id,
      p_conversation: conversation.id,
      p_body: request.body,
      p_attachments: request.attachmentIds,
      p_key: request.clientKey,
      p_run_at: runAt,
    },
  );
  if (error)
    throw new Error(
      "Message could not be queued. Refresh, check quiet hours or retry later.",
    );
  return conversationMessageSchema.parse(data);
}
export async function updateConversation(
  a: AccountIdentity,
  root: Workspace,
  id: string,
  state?: "open" | "closed" | "flagged",
) {
  await accessibleConversation(a, root, id);
  if (state && state !== "flagged" && !["admin", "principal"].includes(a.role))
    throw new Error(
      "Only a participating administrator can reopen or close this conversation.",
    );
  const client = createSupabaseAdminClient();
  const { error } = state
    ? await client
        .from("mis_conversations")
        .update({ state, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("school_id", a.schoolId)
    : await client
        .from("mis_conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", id)
        .eq("user_id", a.id)
        .eq("active", true);
  if (error) throw new Error("Conversation could not be updated.");
}
