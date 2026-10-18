import { assertMutationPermission } from "@/features/identity/domain/mutation-policy";
import { z } from "zod";
import {
  schoolContext,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import {
  loadConversations,
  createConversation,
  sendConversationMessage,
  updateConversation,
} from "@/features/communication/server/conversations";
import {
  conversationCreateSchema,
  messageSendSchema,
  quietHoursSchema,
} from "@/features/communication/schemas/conversation.schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const requestSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("create"),
    input: conversationCreateSchema,
  }),
  z.strictObject({ type: z.literal("send"), input: messageSendSchema }),
  z.strictObject({ type: z.literal("read"), id: z.uuid() }),
  z.strictObject({
    type: z.literal("state"),
    id: z.uuid(),
    state: z.enum(["open", "closed", "flagged"]),
  }),
  z.strictObject({ type: z.literal("quiet-hours"), input: quietHoursSchema }),
]);
export async function GET(request: Request) {
  try {
    const { actor, root } = await schoolContext();
    const url = new URL(request.url);
    const year = z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/)
      .parse(url.searchParams.get("year"));
    const id = url.searchParams.get("thread");
    if (id) z.uuid().parse(id);
    const student = url.searchParams.get("student");
    if (student)
      z.string()
        .regex(/^[A-Za-z0-9_-]{1,128}$/)
        .parse(student);
    return privateJson(await loadConversations(actor, root, year, id, student));
  } catch (e) {
    return apiFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { actor, root } = await schoolContext();
    const input = requestSchema.parse(await jsonBody(request));
    assertMutationPermission(actor, "communication");
    if (input.type === "create")
      return privateJson(
        { conversation: await createConversation(actor, root, input.input) },
        201,
      );
    if (input.type === "send")
      return privateJson(
        { message: await sendConversationMessage(actor, root, input.input) },
        201,
      );
    if (input.type === "quiet-hours") {
      if (!["admin", "principal"].includes(actor.role))
        throw new Error("Administrator required.");
      new Intl.DateTimeFormat("en", { timeZone: input.input.timezone }).format(
        new Date(),
      );
      const { error } = await createSupabaseAdminClient()
        .from("mis_communication_settings")
        .upsert({
          school_id: actor.schoolId,
          enabled: input.input.enabled,
          quiet_start: input.input.start,
          quiet_end: input.input.end,
          timezone: input.input.timezone,
        });
      if (error) throw new Error("Quiet hours could not be saved.");
      return privateJson({ ok: true });
    }
    await updateConversation(
      actor,
      root,
      input.id,
      input.type === "state" ? input.state : undefined,
    );
    return privateJson({ ok: true });
  } catch (e) {
    return apiFailure(e);
  }
}
