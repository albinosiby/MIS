import { z } from "zod";
import {
  schoolActor,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  supportCreateSchema,
  supportListSchema,
  ticketDetailSchema,
  listQuerySchema,
  ticketSchema,
} from "@/features/admin/schemas/platform.schema";
export async function GET(request: Request) {
  try {
    const actor = await schoolActor(),
      db = createSupabaseAdminClient(),
      q = new URL(request.url).searchParams;
    if (q.get("ticketId")) {
      const id = z.uuid().parse(q.get("ticketId"));
      const { data: ticket, error } = await db
        .from("mis_support_tickets")
        .select("*")
        .eq("id", id)
        .eq("school_id", actor.schoolId)
        .eq("requester_id", actor.id)
        .single();
      if (error || !ticket) throw new Error("Request unavailable.");
      const { data: events, error: e } = await db
        .from("mis_support_events")
        .select("*")
        .eq("ticket_id", id)
        .in("kind", ["created", "status"])
        .order("created_at")
        .limit(500);
      if (e) throw new Error("History unavailable.");
      // Internal notes and manually logged contacts remain operator-only.
      return privateJson(ticketDetailSchema.parse({ ticket, events }));
    }
    const { page } = listQuerySchema.parse(Object.fromEntries(q));
    const { data, error } = await db
      .from("mis_support_tickets")
      .select("*")
      .eq("school_id", actor.schoolId)
      .eq("requester_id", actor.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30);
    if (error) throw new Error("Support unavailable.");
    return privateJson(
      supportListSchema.parse({
        tickets: (data ?? []).slice(0, 30),
        page,
        hasMore: (data ?? []).length > 30,
      }),
    );
  } catch (e) {
    return apiFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await schoolActor(),
      input = supportCreateSchema.parse(await jsonBody(request)),
      { data, error } = await createSupabaseAdminClient().rpc(
        "mis_support_create",
        { p_actor: actor.id, p_school: actor.schoolId, p_input: input },
      );
    if (error)
      throw new Error(
        "Support request could not be saved. Please retry later.",
      );
    return privateJson(ticketSchema.parse(data));
  } catch (e) {
    return apiFailure(e);
  }
}
