import { consecutiveAbsences } from "../../attendance/domain/eligibility.ts";
import { mutationPolicySchema } from "../../identity/schemas/mutation-policy.schema.ts";
import { publishReport } from "../../reports/domain/report-builder.ts";
import { privateDocumentSchema } from "../../documents/schemas/private-document.schema.ts";
import {
  canAccessDocument,
  documentScope,
} from "../../documents/domain/document-access.ts";
/** Trusted worker implementation. Imported by the CLI worker, never by a browser component. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DurableJob } from "../models/index.ts";
import { durableJobSchema } from "../schemas/job.schema.ts";
import { z } from "zod";
import { workspaceSchema } from "../../workspace/schemas/workspace.schema.ts";
import { accountIdentitySchema } from "../../identity/schemas/identity.schema.ts";
import {
  conversationSchema,
  conversationMessageSchema,
  conversationParticipantSchema,
} from "../../communication/schemas/conversation.schema.ts";
import { canReadConversation } from "../../communication/domain/conversations.ts";
import { canReadPortalNotice } from "../../portals/domain/notice-access.ts";
import { publishNotice } from "../../workspace/domain/operations.ts";
import { appendAudit } from "../../school-setup/domain/setup-workflow.ts";
async function workspace(client: SupabaseClient, school: string) {
  const { data, error } = await client.rpc("mis_read_workspace", {
    p_school_id: school,
  });
  if (error) throw new Error("School read failed");
  const root = workspaceSchema.parse(data);
  if (root.years.some((y) => y.setup.school.id !== school))
    throw new Error("School scope mismatch");
  return root;
}
async function identities(client: SupabaseClient, school: string) {
  const { data, error } = await client
    .from("mis_effective_memberships")
    .select("user_id,role,person_id,display_name,school_id")
    .eq("school_id", school)
    .eq("active", true);
  if (error) throw new Error("Membership read failed");
  const { data: rawPolicies, error: policyError } = await client
    .from("mis_role_restrictions")
    .select("role,blocked")
    .eq("school_id", school);
  if (policyError) throw new Error("Role policies unavailable");
  const policies = mutationPolicySchema.array().parse(rawPolicies);
  return (data ?? []).map((row) =>
    accountIdentitySchema.parse({
      blockedMutations:
        policies.find((p) => p.role === row.role)?.blocked ?? [],
      id: row.user_id,
      role: row.role,
      personId: row.person_id,
      name: row.display_name,
      schoolId: row.school_id,
      email: "worker@internal.invalid",
    }),
  );
}
export async function finishJob(
  client: SupabaseClient,
  job: DurableJob,
  outcome: "completed" | "retry" | "cancelled" | "blocked",
  detail: string,
) {
  const { error } = await client.rpc("mis_finish_job", {
    p_id: job.id,
    p_lease: job.lease_token,
    p_outcome: outcome,
    p_detail: detail,
  });
  if (error) throw new Error("Job lease unavailable");
}
export async function processDurableJob(
  client: SupabaseClient,
  job: DurableJob,
) {
  const root = await workspace(client, job.school_id);
  const people = await identities(client, job.school_id);
  if (job.kind === "message-delivery") {
    const id = z.uuid().parse(job.payload.messageId);
    const { data: raw, error } = await client
      .from("mis_messages")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error("Message unavailable");
    const msg = conversationMessageSchema.parse(raw);
    const { data: rawThread, error: threadError } = await client
      .from("mis_conversations")
      .select("*")
      .eq("id", msg.conversation_id)
      .eq("school_id", job.school_id)
      .single();
    if (threadError) throw new Error("Conversation unavailable");
    const thread = conversationSchema.parse(rawThread);
    const { data: rawParticipants } = await client
      .from("mis_conversation_participants")
      .select("*")
      .eq("conversation_id", thread.id)
      .eq("active", true);
    const participantIds = conversationParticipantSchema
      .array()
      .parse(rawParticipants)
      .map((p) => p.user_id);
    const year = root.years.find(
      (y) => y.setup.calendar.year.id === thread.academic_year_id,
    );
    const sender = people.find(
      (a) =>
        a.id === msg.sender_id &&
        year &&
        canReadConversation(year, a, thread, participantIds),
    );
    if (
      !year ||
      thread.state !== "open" ||
      !sender ||
      sender.blockedMutations?.includes("communication") ||
      !canReadConversation(year, sender, thread, participantIds)
    ) {
      await finishJob(
        client,
        job,
        "cancelled",
        "Conversation or sender access revoked",
      );
      return;
    }
    const recipients = people.filter((a) =>
      canReadConversation(year, a, thread, participantIds),
    );
    if (msg.attachment_ids.length) {
      const { data: files, error: fileError } = await client
        .from("mis_documents")
        .select("*")
        .in("id", msg.attachment_ids)
        .eq("school_id", job.school_id)
        .eq("status", "ready");
      const documents = privateDocumentSchema.array().parse(files ?? []);
      if (
        fileError ||
        documents.length !== msg.attachment_ids.length ||
        documents.some(
          (d) =>
            !recipients.every((a) =>
              canAccessDocument(
                year,
                a,
                documentScope(d),
                false,
                root.years.find(
                  (y) => y.setup.calendar.year.id === root.activeYearId,
                )!,
              ),
            ),
        )
      ) {
        await finishJob(
          client,
          job,
          "cancelled",
          "Attachment or participant access changed",
        );
        return;
      }
    }
    const eligible = [...new Set(recipients.map((a) => a.id))];
    const { error: deliveryError } = await client.rpc("mis_deliver_message", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_recipients: eligible,
    });
    if (deliveryError) throw new Error("Message delivery failed");
    return;
  }
  const yearId = z.string().min(1).parse(job.payload.yearId);
  let year = root.years.find((y) => y.setup.calendar.year.id === yearId);
  if (!year) {
    await finishJob(client, job, "cancelled", "Academic year unavailable");
    return;
  }
  if (job.kind === "notice-delivery") {
    const noticeId = z.string().min(1).parse(job.payload.noticeId);
    let notice = year.records.notices.find((n) => n.id === noticeId);
    if (!notice || notice.status === "draft") {
      await finishJob(client, job, "cancelled", "Notice withdrawn");
      return;
    }
    if (notice.status === "scheduled") {
      const author = people.find(
        (a) =>
          a.id === job.created_by &&
          ["admin", "principal", "accountant"].includes(a.role) &&
          !a.blockedMutations?.includes("communication"),
      );
      if (!author || year.locked) {
        await finishJob(
          client,
          job,
          "cancelled",
          "Notice author unavailable or year archived",
        );
        return;
      }
      year = {
        ...publishNotice(year, noticeId),
        setup: appendAudit(year.setup, "Published scheduled notice", {
          accountId: author.id,
          role: author.role,
          displayName: author.name,
        }),
      };
      const next = workspaceSchema.parse({
        ...root,
        revision: root.revision + 1,
        years: root.years.map((y) =>
          y.setup.calendar.year.id === yearId ? year : y,
        ),
      });
      const { error } = await client.rpc("mis_commit_workspace", {
        p_school_id: job.school_id,
        p_expected_revision: root.revision,
        p_document: next,
        p_actor_id: author.id,
        p_action: "Publish scheduled notice",
      });
      if (error) throw new Error("Notice publication conflict");
      notice = year.records.notices.find((n) => n.id === noticeId)!;
    }
    const eligible = people
      .filter((a) => canReadPortalNotice(year!, a, notice!))
      .map((a) => a.id);
    const { error } = await client.rpc("mis_deliver_notification", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_recipients: eligible,
      p_title: notice.title,
      p_body: notice.body,
      p_href: "/communication/inbox",
    });
    if (error) throw new Error("Notice delivery failed");
    return;
  }
  if (job.kind === "attendance-alert") {
    const record = year.records.attendance.find(
      (a) =>
        a.id === job.payload.attendanceId &&
        a.personType === "student" &&
        a.status === "absent",
    );
    if (!record) {
      await finishJob(client, job, "cancelled", "Absence corrected");
      return;
    }
    const student = year.setup.students.find((s) => s.id === record.personId);
    const streak =
        record.periodId === null
          ? consecutiveAbsences(year, record.personId, record.date)
          : 0,
      escalated = streak >= year.workflows.advanced.absenceEscalationDays;
    const eligible = [
      ...new Set(
        people
          .filter(
            (a) =>
              (a.role === "parent" &&
                year!.setup.relationships.some(
                  (l) =>
                    l.guardianId === a.personId &&
                    l.studentId === record.personId &&
                    l.canReceiveNotices &&
                    l.canViewRecords,
                )) ||
              (escalated &&
                (["admin", "principal"].includes(a.role) ||
                  (a.role === "teacher" &&
                    year!.setup.allocations.some(
                      (x) =>
                        x.staffId === a.personId &&
                        x.classSectionId === student?.classSectionId,
                    )))),
          )
          .map((a) => a.id),
      ),
    ];
    const { error } = await client.rpc("mis_deliver_notification", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_recipients: eligible,
      p_title: escalated
        ? "Attendance follow-up required"
        : "Attendance update",
      p_body: `${student?.displayName ?? "Your child"} was marked absent on ${record.date}.${escalated ? ` ${streak} consecutive instructional days require follow-up.` : ""} Please contact the school if this needs correction.`,
      p_href: "/communication/inbox",
    });
    if (error) throw new Error("Absence notification failed");
    return;
  }
  if (job.kind === "report-export") {
    const scheduleId = z.string().parse(job.payload.scheduleId),
      date = z.iso.date().parse(job.payload.date),
      schedule = year.workflows.reportSchedules.find(
        (s) => s.id === scheduleId,
      ),
      author = people.find(
        (a) =>
          a.id === job.created_by && ["admin", "principal"].includes(a.role),
      );
    if (
      !schedule ||
      !schedule.enabled ||
      !author ||
      author.blockedMutations?.includes("publications") ||
      year.locked
    ) {
      await finishJob(
        client,
        job,
        "cancelled",
        "Schedule disabled or author/year unavailable",
      );
      return;
    }
    let publication = year.workflows.publications.find(
      (p) => p.snapshot.jobId === job.id,
    );
    if (!publication) {
      const updated = publishReport(year, author, schedule.reportId),
        created = updated.workflows.publications.at(-1)!;
      publication = {
        ...created,
        snapshot: { ...created.snapshot, jobId: job.id },
      };
      const tomorrow = new Date(
        new Date().toISOString().slice(0, 10) + "T00:00:00Z",
      );
      if (schedule.frequency === "monthly")
        tomorrow.setUTCMonth(tomorrow.getUTCMonth() + 1, 1);
      else
        tomorrow.setUTCDate(
          tomorrow.getUTCDate() + (schedule.frequency === "weekly" ? 7 : 1),
        );
      year = {
        ...updated,
        setup: appendAudit(updated.setup, "Generated scheduled report", {
          accountId: author.id,
          role: author.role,
          displayName: author.name,
        }),
        workflows: {
          ...updated.workflows,
          publications: updated.workflows.publications.map((p) =>
            p.id === publication!.id ? publication! : p,
          ),
          reportSchedules: updated.workflows.reportSchedules.map((s) =>
            s.id === schedule.id
              ? {
                  ...s,
                  lastRun: date,
                  nextRun: tomorrow.toISOString().slice(0, 10),
                }
              : s,
          ),
        },
      };
      const saved = workspaceSchema.parse({
        ...root,
        revision: root.revision + 1,
        years: root.years.map((y) =>
          y.setup.calendar.year.id === yearId ? year : y,
        ),
      });
      const { error } = await client.rpc("mis_commit_workspace", {
        p_school_id: job.school_id,
        p_expected_revision: root.revision,
        p_document: saved,
        p_actor_id: author.id,
        p_action: "Generate scheduled report",
      });
      if (error) throw new Error("Scheduled report conflict");
    }
    const eligible = people
      .filter(
        (a) =>
          schedule.recipientIds.includes(a.id) &&
          ["admin", "principal"].includes(a.role),
      )
      .map((a) => a.id);
    const { error } = await client.rpc("mis_deliver_notification", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_recipients: eligible,
      p_title: "Scheduled report ready",
      p_body: publication.title,
      p_href: `/documents/publications?year=${encodeURIComponent(yearId)}&publication=${publication.id}`,
    });
    if (error) throw new Error("Report notification failed");
    return;
  }
  await finishJob(client, job, "blocked", "Unknown job type");
}
export async function runJobBatch(client: SupabaseClient, limit = 1) {
  const { data, error } = await client.rpc("mis_claim_jobs", {
    p_limit: limit,
  });
  if (error) throw new Error("Job claim failed");
  const jobs = durableJobSchema.array().parse(data);
  for (const job of jobs) {
    try {
      await processDurableJob(client, job);
    } catch {
      await finishJob(
        client,
        job,
        "retry",
        "Processing failed; retry scheduled",
      );
    }
  }
  return jobs.length;
}

/** Bounded periodic discovery queues persisted schedules even when no browser is open. */
async function* schoolPages(client: SupabaseClient) {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client
      .from("mis_schools")
      .select("id")
      .order("id")
      .range(offset, offset + 99);
    if (error) throw new Error("Schedule discovery failed");
    const schools = z.array(z.object({ id: z.string().min(1) })).parse(data);
    for (const school of schools) yield school;
    if (schools.length < 100) return;
  }
}
export async function queueDueReports(client: SupabaseClient) {
  let queued = 0;
  for await (const school of schoolPages(client)) {
    const root = await workspace(client, school.id);
    for (const year of root.years.filter((y) => !y.locked)) {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: year.workflows.advanced.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      for (const schedule of year.workflows.reportSchedules.filter(
        (s) => s.enabled && s.nextRun <= today,
      )) {
        const { error } = await client.from("mis_jobs").upsert(
          {
            school_id: school.id,
            kind: "report-export",
            payload: {
              yearId: year.setup.calendar.year.id,
              scheduleId: schedule.id,
              date: schedule.nextRun,
            },
            dedupe_key: `report-schedule:${year.setup.calendar.year.id}:${schedule.id}:${schedule.nextRun}`,
            created_by: schedule.createdBy,
          },
          { onConflict: "school_id,dedupe_key", ignoreDuplicates: true },
        );
        if (error) throw new Error("Report queue failed");
        queued++;
      }
    }
  }
  return queued;
}
