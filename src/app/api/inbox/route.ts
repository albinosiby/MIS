import { z } from "zod";
import {
  schoolContext,
  jsonBody,
  apiFailure,
  privateJson,
} from "@/shared/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { inboxNotificationSchema } from "@/features/communication/schemas/conversation.schema";
import { accessibleConversation } from "@/features/communication/server/conversations";
import { canReadPortalNotice } from "@/features/portals/domain/notice-access";
export async function GET() {
  try {
    const { actor, root } = await schoolContext();
    const { data, error } = await createSupabaseAdminClient()
      .from("mis_inbox_notifications")
      .select("*")
      .eq("school_id", actor.schoolId)
      .eq("user_id", actor.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Inbox unavailable.");
    const rows = inboxNotificationSchema.array().parse(data);
    const visible = [];
    for (const row of rows) {
      if (row.source_key.startsWith("message:")) {
        try {
          const thread = new URL(row.href, "http://local").searchParams.get(
            "thread",
          );
          if (!thread) continue;
          await accessibleConversation(actor, root, thread);
        } catch {
          continue;
        }
      }
      if (row.source_key.startsWith("notice:")) {
        const [, yearId, id] = row.source_key.split(":");
        const y = root.years.find((y) => y.setup.calendar.year.id === yearId);
        const notice = y?.records.notices.find((n) => n.id === id);
        if (!y || !notice || !canReadPortalNotice(y, actor, notice)) continue;
      }
      if (row.source_key.startsWith("absence:")) {
        const [, yearId, id] = row.source_key.split(":");
        const y = root.years.find((y) => y.setup.calendar.year.id === yearId);
        const absence = y?.records.attendance.find(
          (a) => a.id === id && a.status === "absent",
        );
        if (!absence || !y) continue;
        const student = y.setup.students.find((s) => s.id === absence.personId);
        const permitted =
          (actor.role === "parent" &&
            y.setup.relationships.some(
              (l) =>
                l.guardianId === actor.personId &&
                l.studentId === absence.personId &&
                l.canReceiveNotices &&
                l.canViewRecords,
            )) ||
          ["admin", "principal"].includes(actor.role) ||
          (actor.role === "teacher" &&
            y.setup.allocations.some(
              (x) =>
                x.staffId === actor.personId &&
                x.classSectionId === student?.classSectionId,
            ));
        if (!permitted) continue;
      }
      if (
        row.source_key.startsWith("report-schedule:") &&
        !["admin", "principal"].includes(actor.role)
      )
        continue;
      visible.push(row);
    }
    return privateJson({ notifications: visible });
  } catch (e) {
    return apiFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { actor } = await schoolContext();
    const input = z
      .strictObject({ id: z.uuid() })
      .parse(await jsonBody(request));
    const { data, error } = await createSupabaseAdminClient()
      .from("mis_inbox_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("school_id", actor.schoolId)
      .eq("user_id", actor.id)
      .select("id")
      .single();
    if (error || !data) throw new Error("Notification unavailable.");
    return privateJson({ ok: true });
  } catch (e) {
    return apiFailure(e);
  }
}
